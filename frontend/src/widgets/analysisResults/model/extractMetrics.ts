import type { AnalysisRow } from "@entities/analysis/api"

const NON_METRIC_FIELDS = new Set(["runId", "createdAt", "path", "group", "student"])

export const extractMetrics = (rows: AnalysisRow[]): string[] => {
  if (!rows.length) {
    return []
  }

  return Object.keys(rows[0]).filter((key) => !NON_METRIC_FIELDS.has(key))
}
