import type { AnalysisRow } from "../../api"
import { extractYear, getScopeDisplayName, getScopePath } from "./utils"

export type MetricYearPoint = {
  year: string
  specialty: string
  value: number
}

export const extractMetricYearPoints = (
  rows: AnalysisRow[],
  metric: string,
  analysisDepth?: number,
  gitYearResolver?: (pathValue: string) => string | null
): MetricYearPoint[] =>
  rows
    .map((row) => {
      const rawValue = row[metric]
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        return null
      }
      const resolvedYear = extractYear(row, gitYearResolver)
      if (resolvedYear === "Без года") {
        return null
      }
      const scopePath = getScopePath(row.path, analysisDepth)
      return {
        year: resolvedYear,
        specialty: getScopeDisplayName(scopePath || "Без подпапки") || "Без подпапки",
        value: rawValue
      }
    })
    .filter((item): item is MetricYearPoint => Boolean(item))

export const getYearChartSpecialties = (
  rows: AnalysisRow[],
  metrics: string[],
  analysisDepth?: number,
  gitYearResolver?: (pathValue: string) => string | null
): string[] => {
  const specialties = new Set<string>()
  for (const metric of metrics) {
    for (const point of extractMetricYearPoints(rows, metric, analysisDepth, gitYearResolver)) {
      specialties.add(point.specialty)
    }
  }
  return Array.from(specialties).sort((a, b) => a.localeCompare(b))
}
