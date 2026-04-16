import { buildCsv } from "@shared/lib"

export const toMetricsCsv = (rows: Array<Record<string, unknown>>, metrics: string[]): string => {
  const headers = ["path", ...metrics]
  const dataRows = rows.map((row) => [
    String(row.path || ""),
    ...metrics.map((metric) => String(row[metric] ?? ""))
  ])
  return buildCsv(headers, dataRows)
}
