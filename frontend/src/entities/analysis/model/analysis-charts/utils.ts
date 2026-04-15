import type { AnalysisRow, GitAnalysisRow } from "@entities/analysis/api"
import { deviation, mean } from "d3-array"

export const normalizePath = (pathValue: string): string =>
  String(pathValue || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+|\/+$/g, "")

const parseYearFromDate = (value: unknown): string | null => {
  const fromText = parseYearValue(value)
  if (fromText) {
    return fromText
  }

  if (typeof value !== "string") {
    return null
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }
  return String(parsedDate.getUTCFullYear())
}

export const toSegments = (pathValue: string): string[] =>
  normalizePath(pathValue)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

const getScopeDepth = (analysisDepth?: number): number => {
  if (typeof analysisDepth !== "number") {
    return 2
  }
  if (analysisDepth < 2) {
    return 1
  }
  return analysisDepth - 1
}

export const getScopePath = (pathValue: string, analysisDepth?: number): string => {
  const segments = toSegments(pathValue)
  if (!segments.length) {
    return ""
  }

  const scopeDepth = getScopeDepth(analysisDepth)
  return segments.slice(0, Math.min(scopeDepth, segments.length)).join("/")
}

export const getScopeDisplayName = (scopePath: string): string => {
  const segments = toSegments(scopePath)
  if (segments.length <= 1) {
    return segments[0] || scopePath
  }
  return segments.slice(1).join("/")
}

export const parseYearValue = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value)
    if (year >= 1900 && year <= 2100) {
      return String(year)
    }
  }

  if (typeof value === "string") {
    const match = value.match(/\b(19|20)\d{2}\b/)
    if (match) {
      return match[0]
    }
  }

  return null
}

export const extractYear = (
  row: AnalysisRow,
  gitYearResolver?: (pathValue: string) => string | null
): string => {
  const directYear = parseYearValue(row.year)
  if (directYear) {
    return directYear
  }
  const directYearRu = parseYearValue((row as Record<string, unknown>)["год"])
  if (directYearRu) {
    return directYearRu
  }

  for (const [key, value] of Object.entries(row)) {
    if (!/year|год/i.test(key)) {
      continue
    }
    const year = parseYearValue(value)
    if (year) {
      return year
    }
  }

  const source = `${row.path || ""} ${row.group || ""} ${row.student || ""}`
  const fromPath = parseYearValue(source)
  if (fromPath) {
    return fromPath
  }

  const fromGit = gitYearResolver?.(String(row.path || ""))
  return fromGit || "Без года"
}

export const quantile = (values: number[], q: number): number => {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  const high = Math.ceil(position)
  if (low === high) {
    return sorted[low]
  }
  const lowValue = sorted[low]
  const highValue = sorted[high]
  const weight = position - low
  return lowValue + (highValue - lowValue) * weight
}

const gaussianKernel = (bandwidth: number) => (value: number) => {
  const scale = value / bandwidth
  return Math.exp(-0.5 * scale * scale) / Math.sqrt(2 * Math.PI)
}

export const kernelDensityEstimator = (samples: number[], bandwidth: number, xs: number[]) => {
  if (!samples.length || bandwidth <= 0) {
    return xs.map((x) => ({ x, y: 0 }))
  }

  const kernel = gaussianKernel(bandwidth)
  return xs.map((x) => ({
    x,
    y: mean(samples, (sample) => kernel(x - sample)) || 0
  }))
}

export const calculateBandwidth = (values: number[], safeMin: number, safeMax: number) => {
  const std = deviation(values) || 0
  return std > 0 ? 1.06 * std * Math.pow(values.length, -1 / 5) : (safeMax - safeMin) / 20
}

export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0"
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("ru-RU")
  }
  return String(Math.round(value * 100) / 100)
}

export const buildGitYearResolver = (
  gitRows: GitAnalysisRow[],
  analysisDepth?: number,
  selectedScope?: string | null
): ((pathValue: string) => string | null) => {
  const yearCountByPath = new Map<string, Map<string, number>>()
  const yearCountByScope = new Map<string, Map<string, number>>()
  const globalYearCounts = new Map<string, number>()

  const addCount = (container: Map<string, Map<string, number>>, key: string, year: string) => {
    if (!key) {
      return
    }
    const byYear = container.get(key) || new Map<string, number>()
    byYear.set(year, (byYear.get(year) || 0) + 1)
    container.set(key, byYear)
  }

  for (const row of gitRows) {
    const parsedYear = parseYearFromDate(row.date)
    if (!parsedYear) {
      continue
    }
    const normalizedPath = normalizePath(row.path)
    const scope = getScopePath(normalizedPath, analysisDepth)

    if (selectedScope && scope !== selectedScope) {
      continue
    }

    addCount(yearCountByPath, normalizedPath, parsedYear)
    addCount(yearCountByScope, scope, parsedYear)
    globalYearCounts.set(parsedYear, (globalYearCounts.get(parsedYear) || 0) + 1)
  }

  const pickMostFrequent = (map: Map<string, number>): string | null => {
    let bestYear: string | null = null
    let bestCount = -1
    for (const [year, count] of map.entries()) {
      if (count > bestCount) {
        bestCount = count
        bestYear = year
      }
    }
    return bestYear
  }

  return (pathValue: string) => {
    const normalizedPath = normalizePath(pathValue)
    const direct = yearCountByPath.get(normalizedPath)
    if (direct) {
      const picked = pickMostFrequent(direct)
      if (picked) {
        return picked
      }
    }

    const pathSegments = toSegments(normalizedPath)
    for (let end = pathSegments.length; end > 0; end -= 1) {
      const candidate = pathSegments.slice(0, end).join("/")
      const fromCandidate = yearCountByPath.get(candidate)
      if (fromCandidate) {
        const picked = pickMostFrequent(fromCandidate)
        if (picked) {
          return picked
        }
      }
    }

    const scope = getScopePath(normalizedPath, analysisDepth)
    const fromScope = yearCountByScope.get(scope)
    if (fromScope) {
      const picked = pickMostFrequent(fromScope)
      if (picked) {
        return picked
      }
    }

    return pickMostFrequent(globalYearCounts)
  }
}
