import type { GitAnalysisRow } from "@entities/analysis/api"
import { Grid, MultiSelect, Select, Stack } from "@mantine/core"
import { useMemo, useState } from "react"

import {
  BOXPLOT_CHARTS,
  type GitPathMetricKey,
  type GitScatterMetricKey,
  HISTO_CHARTS
} from "../model/chartConfig"
import { ALL_GIT_METRICS_OPTION, BOXPLOT_METRICS, HISTO_METRICS } from "../model/constants"
import { buildGitChartsDataset, getPathColorMap } from "../model/gitCharts"
import { useGitMetricSelection } from "../model/useGitMetricSelection"
import { ChartCard, HorizontalBarChart, MetricGroupsBoxPlot, ScatterChart } from "./components"

type Props = {
  rows: GitAnalysisRow[]
  analysisDepth?: number
}

export function GitChartsSection({ rows, analysisDepth }: Props) {
  const [chartMode, setChartMode] = useState<"boxplot" | "histo">("histo")
  const chartData = useMemo(() => buildGitChartsDataset(rows), [rows])
  const availableMetrics = useMemo(
    () => (chartMode === "boxplot" ? BOXPLOT_METRICS : HISTO_METRICS),
    [chartMode]
  )

  const { handleChange, metricOptions, selectedMetricSet, selectedMetrics } = useGitMetricSelection(
    {
      availableMetrics
    }
  )

  const colorByPath = useMemo(() => {
    const chartRows: Array<{ path: string }> = [
      ...chartData.totalCommitCount,
      ...chartData.meaningfulCommitCount,
      ...chartData.activeDays,
      ...chartData.nightCommitPct,
      ...chartData.medianCommitSize,
      ...chartData.developmentDurationDays,
      ...chartData.codeChurn,
      ...chartData.churnRatio,
      ...chartData.commitsVsChurn,
      ...chartData.commitsVsChurnPct
    ]
    return getPathColorMap(chartRows, analysisDepth)
  }, [analysisDepth, chartData])

  if (!rows.length) {
    return null
  }

  const getPathMetricData = (key: GitPathMetricKey) => chartData[key]
  const getScatterData = (key: GitScatterMetricKey) => chartData[key]

  const show = (metric: string) => selectedMetricSet.has(metric)

  return (
    <Stack gap="md">
      <Stack gap="sm">
        <Select
          data={[
            { value: "histo", label: "Гисто/точечные" },
            { value: "boxplot", label: "Боксплоты" }
          ]}
          label="Формат графиков"
          value={chartMode}
          w={280}
          onChange={(value) => setChartMode((value as "boxplot" | "histo") || "histo")}
        />
        <MultiSelect
          clearable={!selectedMetrics.includes(ALL_GIT_METRICS_OPTION)}
          data={metricOptions}
          label="Метрики для графиков (Git)"
          placeholder="Выберите метрики"
          searchable
          value={selectedMetrics}
          w={520}
          onChange={handleChange}
        />
      </Stack>

      {chartMode === "boxplot" ? (
        <Grid>
          {BOXPLOT_CHARTS.filter((chart) => show(chart.key)).map((chart) => (
            <Grid.Col key={chart.key} span={{ base: 12, sm: 6, lg: 4 }}>
              <ChartCard title={chart.title}>
                <MetricGroupsBoxPlot
                  analysisDepth={analysisDepth}
                  data={getPathMetricData(chart.key)}
                  metric={chart.key}
                />
              </ChartCard>
            </Grid.Col>
          ))}
        </Grid>
      ) : (
        <Grid>
          {HISTO_CHARTS.filter((chart) => show(chart.key)).map((chart) => {
            if (chart.key === "commitsVsChurn" || chart.key === "commitsVsChurnPct") {
              return (
                <Grid.Col key={chart.key} span={{ base: 12, sm: 6, lg: 4 }}>
                  <ChartCard title={chart.title}>
                    <ScatterChart
                      colorByPath={colorByPath}
                      data={getScatterData(chart.key)}
                      xLabel={chart.xLabel || ""}
                      yLabel={chart.yLabel || ""}
                    />
                  </ChartCard>
                </Grid.Col>
              )
            }

            return (
              <Grid.Col key={chart.key} span={{ base: 12, sm: 6, lg: 4 }}>
                <ChartCard title={chart.title}>
                  <HorizontalBarChart
                    colorByPath={colorByPath}
                    data={getPathMetricData(chart.key as GitPathMetricKey)}
                    xLabel={chart.xLabel || ""}
                  />
                </ChartCard>
              </Grid.Col>
            )
          })}
        </Grid>
      )}
    </Stack>
  )
}
