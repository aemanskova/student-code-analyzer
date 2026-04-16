import type { GitAnalysisRow } from "@entities/analysis/api"
import { scaleOrdinal } from "d3-scale"
import { schemeTableau10 } from "d3-scale-chromatic"

export type GitPathMetric = {
  path: string
  value: number
}

export type GitScatterPoint = {
  path: string
  x: number
  y: number
}

export type GitBoxPlotPoint = {
  path: string
  q1: number
  median: number
  q3: number
  min: number
  max: number
}

export type GitChartsDataset = {
  totalCommitCount: GitPathMetric[]
  meaningfulCommitCount: GitPathMetric[]
  activeDays: GitPathMetric[]
  nightCommitPct: GitPathMetric[]
  medianCommitSize: GitPathMetric[]
  developmentDurationDays: GitPathMetric[]
  codeChurn: GitPathMetric[]
  churnRatio: GitPathMetric[]
  commitsVsChurn: GitScatterPoint[]
  commitsVsChurnPct: GitScatterPoint[]
  commitSizeBoxPlot: GitBoxPlotPoint[]
}

export type GroupScopeOption = {
  value: string
  label: string
}

const MEANINGFUL_LINES_THRESHOLD = 15
const NIGHT_HOUR_START = 0
const NIGHT_HOUR_END = 5

const metadataIgnoredRegex = /rename|copy|mode change/i

const normalizePath = (pathValue: string): string =>
  String(pathValue || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")

const toSegments = (pathValue: string): string[] =>
  normalizePath(pathValue)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

const getPathScope = (pathValue: string, scopeDepth: number): string => {
  const segments = toSegments(pathValue)
  if (!segments.length) {
    return ""
  }

  const depth = Math.max(1, Math.trunc(scopeDepth || 1))
  return segments.slice(0, Math.min(depth, segments.length)).join("/")
}

export const getScopePathValue = (pathValue: string, analysisDepth?: number): string => {
  const scopeDepth = getScopeDepth(analysisDepth)
  return getPathScope(pathValue, scopeDepth)
}

export const getScopeDisplayName = (scopePath: string): string => {
  const segments = toSegments(scopePath)
  if (segments.length <= 1) {
    return segments[0] || scopePath
  }
  return segments.slice(1).join("/")
}

const createNestedNumberMap = () => new Map<string, Map<string, number>>()

const incrementNested = (
  target: Map<string, Map<string, number>>,
  path: string,
  hash: string,
  value: number
) => {
  const byHash = target.get(path) || new Map<string, number>()
  byHash.set(hash, (byHash.get(hash) || 0) + value)
  target.set(path, byHash)
}

const collectCommitTotals = (rows: GitAnalysisRow[]): Map<string, number> => {
  const unique = new Map<string, Set<string>>()

  for (const row of rows) {
    const path = row.path
    const hashes = unique.get(path) || new Set<string>()
    hashes.add(row.hash)
    unique.set(path, hashes)
  }

  const result = new Map<string, number>()
  for (const [path, hashes] of unique.entries()) {
    result.set(path, hashes.size)
  }

  return result
}

const collectCommitLineDiff = (rows: GitAnalysisRow[]): Map<string, Map<string, number>> => {
  const diffByPathHash = createNestedNumberMap()

  for (const row of rows) {
    incrementNested(
      diffByPathHash,
      row.path,
      row.hash,
      Number(row.added || 0) + Number(row.deleted || 0)
    )
  }

  return diffByPathHash
}

const toPathMetric = (source: Map<string, number>): GitPathMetric[] =>
  Array.from(source.entries())
    .map(([path, value]) => ({ path, value }))
    .sort((a, b) => a.value - b.value)

const uniqueCommitRows = (
  rows: GitAnalysisRow[]
): Array<Pick<GitAnalysisRow, "path" | "hash" | "date">> => {
  const seen = new Set<string>()
  const result: Array<Pick<GitAnalysisRow, "path" | "hash" | "date">> = []

  for (const row of rows) {
    const key = `${row.path}|${row.hash}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({ path: row.path, hash: row.hash, date: row.date })
  }

  return result
}

const safeDate = (value: string): Date | null => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getCommitSizes = (
  rows: GitAnalysisRow[]
): Array<{ path: string; hash: string; commitSize: number }> => {
  const byPathHash = createNestedNumberMap()

  for (const row of rows) {
    if (row.filetype !== "text") {
      continue
    }
    if (metadataIgnoredRegex.test(String(row.extraMetadata || ""))) {
      continue
    }

    incrementNested(
      byPathHash,
      row.path,
      row.hash,
      Number(row.added || 0) + Number(row.deleted || 0)
    )
  }

  const result: Array<{ path: string; hash: string; commitSize: number }> = []

  for (const [path, byHash] of byPathHash.entries()) {
    for (const [hash, commitSize] of byHash.entries()) {
      result.push({ path, hash, commitSize })
    }
  }

  return result
}

const quantile = (values: number[], q: number): number => {
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

const median = (values: number[]): number => quantile(values, 0.5)

const toRounded = (value: number, precision = 3): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export const getScopeDepth = (analysisDepth?: number): number => {
  if (typeof analysisDepth !== "number") {
    return 2
  }
  if (analysisDepth < 2) {
    return 1
  }
  return analysisDepth - 1
}

export const getScopeOptions = (
  rows: GitAnalysisRow[],
  analysisDepth?: number
): GroupScopeOption[] => {
  const scopeDepth = getScopeDepth(analysisDepth)
  const values = new Set<string>()

  for (const row of rows) {
    const scope = getPathScope(row.path, scopeDepth)
    if (scope) {
      values.add(scope)
    }
  }

  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b))
  const displayCount = new Map<string, number>()

  for (const value of sorted) {
    const display = getScopeDisplayName(value)
    displayCount.set(display, (displayCount.get(display) || 0) + 1)
  }

  return sorted.map((value) => {
    const display = getScopeDisplayName(value)
    const isDuplicated = (displayCount.get(display) || 0) > 1
    return {
      value,
      label: isDuplicated ? value : display
    }
  })
}

export const filterByScope = (
  rows: GitAnalysisRow[],
  selectedScope: string | null,
  analysisDepth?: number
): GitAnalysisRow[] => {
  if (!selectedScope) {
    return rows
  }

  const scopeDepth = getScopeDepth(analysisDepth)
  return rows.filter((row) => getPathScope(row.path, scopeDepth) === selectedScope)
}

export const getPathColorMap = (
  rows: Array<{ path: string }>,
  analysisDepth?: number,
  palette?: string[]
): Map<string, string> => {
  const scopeDepth = getScopeDepth(analysisDepth)
  const scopeSet = new Set<string>()

  for (const row of rows) {
    scopeSet.add(getPathScope(row.path, scopeDepth) || row.path)
  }

  const scopes = Array.from(scopeSet).sort((a, b) => a.localeCompare(b))
  const range = palette?.length ? palette : schemeTableau10
  const colorScale = scaleOrdinal<string, string>(range).domain(scopes)

  const colorMap = new Map<string, string>()
  for (const row of rows) {
    const scope = getPathScope(row.path, scopeDepth) || row.path
    colorMap.set(row.path, colorScale(scope))
  }

  return colorMap
}

export const buildGitChartsDataset = (rows: GitAnalysisRow[]): GitChartsDataset => {
  const totalCommitMap = collectCommitTotals(rows)
  const commitLineDiff = collectCommitLineDiff(rows)

  const meaningfulCommitMap = new Map<string, number>()
  for (const [path, byHash] of commitLineDiff.entries()) {
    let meaningfulCount = 0
    for (const totalDiff of byHash.values()) {
      if (totalDiff >= MEANINGFUL_LINES_THRESHOLD) {
        meaningfulCount += 1
      }
    }
    meaningfulCommitMap.set(path, meaningfulCount)
  }

  const uniqueCommits = uniqueCommitRows(rows)

  const activeDaysMap = new Map<string, Set<string>>()
  const nightCounters = new Map<string, { total: number; night: number }>()
  const durationMap = new Map<string, { min: number; max: number }>()

  for (const commitRow of uniqueCommits) {
    const parsedDate = safeDate(commitRow.date)
    if (!parsedDate) {
      continue
    }

    const dayKey = parsedDate.toISOString().slice(0, 10)
    const daySet = activeDaysMap.get(commitRow.path) || new Set<string>()
    daySet.add(dayKey)
    activeDaysMap.set(commitRow.path, daySet)

    const hour = parsedDate.getUTCHours()
    const isNight = hour >= NIGHT_HOUR_START && hour <= NIGHT_HOUR_END
    const counters = nightCounters.get(commitRow.path) || { total: 0, night: 0 }
    counters.total += 1
    if (isNight) {
      counters.night += 1
    }
    nightCounters.set(commitRow.path, counters)

    const stamp = parsedDate.getTime()
    const duration = durationMap.get(commitRow.path)
    if (!duration) {
      durationMap.set(commitRow.path, { min: stamp, max: stamp })
    } else {
      duration.min = Math.min(duration.min, stamp)
      duration.max = Math.max(duration.max, stamp)
      durationMap.set(commitRow.path, duration)
    }
  }

  const activeDaysNumeric = new Map<string, number>()
  for (const [path, days] of activeDaysMap.entries()) {
    activeDaysNumeric.set(path, days.size)
  }

  const nightPctMap = new Map<string, number>()
  for (const [path, counters] of nightCounters.entries()) {
    const pct = counters.total > 0 ? (100 * counters.night) / counters.total : 0
    nightPctMap.set(path, toRounded(pct, 2))
  }

  const durationDaysMap = new Map<string, number>()
  for (const [path, duration] of durationMap.entries()) {
    const diff = Math.floor((duration.max - duration.min) / (1000 * 60 * 60 * 24))
    durationDaysMap.set(path, Math.max(0, diff))
  }

  const commitSizes = getCommitSizes(rows)
  const commitSizeByPath = new Map<string, number[]>()
  for (const item of commitSizes) {
    const values = commitSizeByPath.get(item.path) || []
    values.push(item.commitSize)
    commitSizeByPath.set(item.path, values)
  }

  const medianCommitSizeMap = new Map<string, number>()
  const boxPlot: GitBoxPlotPoint[] = []
  for (const [path, values] of commitSizeByPath.entries()) {
    const sorted = [...values].sort((a, b) => a - b)
    if (!sorted.length) {
      continue
    }

    const minValue = sorted[0]
    const maxValue = sorted[sorted.length - 1]
    const q1 = quantile(sorted, 0.25)
    const medianValue = quantile(sorted, 0.5)
    const q3 = quantile(sorted, 0.75)

    medianCommitSizeMap.set(path, toRounded(median(sorted), 2))
    boxPlot.push({
      path,
      q1: toRounded(q1, 2),
      median: toRounded(medianValue, 2),
      q3: toRounded(q3, 2),
      min: toRounded(minValue, 2),
      max: toRounded(maxValue, 2)
    })
  }

  const codeChurnMap = new Map<string, { added: number; deleted: number }>()
  for (const row of rows) {
    if (row.filetype !== "text") {
      continue
    }
    if (metadataIgnoredRegex.test(String(row.extraMetadata || ""))) {
      continue
    }

    const current = codeChurnMap.get(row.path) || { added: 0, deleted: 0 }
    current.added += Number(row.added || 0)
    current.deleted += Number(row.deleted || 0)
    codeChurnMap.set(row.path, current)
  }

  const churnMap = new Map<string, number>()
  const churnRatioMap = new Map<string, number>()
  for (const [path, values] of codeChurnMap.entries()) {
    churnMap.set(path, values.deleted)
    churnRatioMap.set(path, values.added > 0 ? toRounded(values.deleted / values.added, 4) : 0)
  }

  const commitsVsChurn: GitScatterPoint[] = []
  const commitsVsChurnPct: GitScatterPoint[] = []

  for (const [path, totalCommits] of totalCommitMap.entries()) {
    const churn = churnMap.get(path)
    const churnRatio = churnRatioMap.get(path)
    if (typeof churn === "number") {
      commitsVsChurn.push({ path, x: totalCommits, y: churn })
    }
    if (typeof churnRatio === "number") {
      commitsVsChurnPct.push({ path, x: totalCommits, y: toRounded(churnRatio * 100, 2) })
    }
  }

  boxPlot.sort((a, b) => a.median - b.median)

  return {
    totalCommitCount: toPathMetric(totalCommitMap),
    meaningfulCommitCount: toPathMetric(meaningfulCommitMap),
    activeDays: toPathMetric(activeDaysNumeric),
    nightCommitPct: toPathMetric(nightPctMap),
    medianCommitSize: toPathMetric(medianCommitSizeMap),
    developmentDurationDays: toPathMetric(durationDaysMap),
    codeChurn: toPathMetric(churnMap),
    churnRatio: toPathMetric(churnRatioMap),
    commitsVsChurn,
    commitsVsChurnPct,
    commitSizeBoxPlot: boxPlot
  }
}
