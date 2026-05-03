import type { ClusteredMetricRow, ClusterMetricValue } from "../api"

export const toMetricDisplayValue = (value: unknown): string | number => {
  if (value === null || value === undefined || value === "") {
    return "-"
  }
  if (typeof value === "boolean") {
    return value ? "Да" : "Нет"
  }
  return value as string | number
}

export const toNumericMetricValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const getNumericMetrics = (rows: ClusteredMetricRow[], metrics: string[]): string[] =>
  metrics.filter((metric) => rows.some((row) => toNumericMetricValue(row.metrics[metric]) !== null))

export const getMetricCsvValue = (metrics: Record<string, ClusterMetricValue>, metric: string) =>
  String(metrics[metric] ?? "")
