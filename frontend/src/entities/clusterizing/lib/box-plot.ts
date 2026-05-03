import type { ClusteredMetricRow } from "../api"
import { toNumericMetricValue } from "./metric-values"

export type BoxPlotValue = {
  cluster: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) {
    return 0
  }

  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  const next = sorted[base + 1]

  if (next === undefined) {
    return sorted[base] ?? 0
  }

  return (sorted[base] ?? 0) + rest * (next - (sorted[base] ?? 0))
}

export const buildBoxPlotData = (metric: string, rows: ClusteredMetricRow[]): BoxPlotValue[] => {
  const valuesByCluster = new Map<string, number[]>()

  for (const row of rows) {
    const value = toNumericMetricValue(row.metrics[metric])
    if (value === null) {
      continue
    }

    const cluster = String(row.cluster)
    const values = valuesByCluster.get(cluster) || []
    values.push(value)
    valuesByCluster.set(cluster, values)
  }

  return Array.from(valuesByCluster.entries())
    .map(([cluster, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return {
        cluster,
        min: sorted[0] ?? 0,
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1] ?? 0
      }
    })
    .sort((a, b) => Number(a.cluster) - Number(b.cluster))
}

export const formatChartNumber = (value: number): string =>
  Math.abs(value) >= 1000
    ? value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
    : value.toFixed(2)
