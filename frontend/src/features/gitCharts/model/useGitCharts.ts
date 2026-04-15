import type { GitAnalysisRow } from "@entities/analysis/api"
import { useMemo, useState } from "react"

import {
  buildGitChartsDataset,
  filterByScope,
  getPathColorMap,
  getScopeOptions,
  type GitChartsDataset,
  type GroupScopeOption
} from "./gitCharts"

type UseGitChartsResult = {
  scope: string | null
  setScope: (value: string | null) => void
  scopeOptions: GroupScopeOption[]
  rowsForCharts: GitAnalysisRow[]
  chartData: GitChartsDataset
  colorByPath: Map<string, string>
}

export const useGitCharts = (
  rows: GitAnalysisRow[],
  analysisDepth?: number
): UseGitChartsResult => {
  const scopeOptions = useMemo(() => getScopeOptions(rows, analysisDepth), [rows, analysisDepth])
  const [scope, setScope] = useState<string | null>(null)

  const rowsForCharts = useMemo(
    () => filterByScope(rows, scope, analysisDepth),
    [rows, scope, analysisDepth]
  )

  const chartData = useMemo(() => buildGitChartsDataset(rowsForCharts), [rowsForCharts])

  const colorByPath = useMemo(() => {
    const chartRows: Array<{ path: string }> = []

    chartData.totalCommitCount.forEach((item) => chartRows.push({ path: item.path }))
    chartData.meaningfulCommitCount.forEach((item) => chartRows.push({ path: item.path }))
    chartData.activeDays.forEach((item) => chartRows.push({ path: item.path }))
    chartData.nightCommitPct.forEach((item) => chartRows.push({ path: item.path }))
    chartData.medianCommitSize.forEach((item) => chartRows.push({ path: item.path }))
    chartData.developmentDurationDays.forEach((item) => chartRows.push({ path: item.path }))
    chartData.codeChurn.forEach((item) => chartRows.push({ path: item.path }))
    chartData.churnRatio.forEach((item) => chartRows.push({ path: item.path }))
    chartData.commitsVsChurn.forEach((item) => chartRows.push({ path: item.path }))
    chartData.commitsVsChurnPct.forEach((item) => chartRows.push({ path: item.path }))
    chartData.commitSizeBoxPlot.forEach((item) => chartRows.push({ path: item.path }))

    return getPathColorMap(chartRows, analysisDepth)
  }, [chartData, analysisDepth])

  return {
    scope,
    setScope,
    scopeOptions,
    rowsForCharts,
    chartData,
    colorByPath
  }
}
