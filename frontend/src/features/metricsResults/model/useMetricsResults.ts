import type { AnalysisRow } from "@entities/analysis/api"
import { downloadCsvFile } from "@shared/lib"
import { usePathFilter } from "@shared/lib/hooks/usePathFilter"
import { useCallback } from "react"

import { toMetricsCsv } from "./utils"

export const useMetricsResults = (rows: AnalysisRow[], metrics: string[]) => {
  const { control, pathFilter, setPathFilter, filteredRows, hasRows, hasFilteredRows } =
    usePathFilter(rows, (row) => row.path)

  const downloadMetricsCsv = useCallback(() => {
    if (!filteredRows.length || !metrics.length) {
      return
    }

    const csv = toMetricsCsv(filteredRows as Array<Record<string, unknown>>, metrics)
    downloadCsvFile(`analysis_metrics_${Date.now()}.csv`, csv)
  }, [filteredRows, metrics])

  return {
    control,
    pathFilter,
    setPathFilter,
    filteredRows,
    hasRows,
    hasFilteredRows,
    downloadMetricsCsv
  }
}
