import type { AnalysisRow } from "@entities/analysis/api"

export const getNumericMetrics = (rows: AnalysisRow[]): string[] => {
  const metricNames = new Set<string>()
  for (const row of rows) {
    Object.entries(row).forEach(([key, value]) => {
      if (key === "path" || key === "group" || key === "student") {
        return
      }
      if (typeof value === "number") {
        metricNames.add(key)
      }
    })
  }
  return Array.from(metricNames)
}

export const toChartData = (rows: AnalysisRow[], metricName: string) =>
  rows.map((row) => ({
    path: row.path,
    value: typeof row[metricName] === "number" ? Number(row[metricName]) : 0
  }))
