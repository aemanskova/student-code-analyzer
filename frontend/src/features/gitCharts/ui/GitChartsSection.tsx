import type { GitAnalysisRow } from "@entities/analysis/api"
import { Grid, MultiSelect, Select, Stack, useMantineColorScheme } from "@mantine/core"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import {
  BOXPLOT_CHARTS,
  type GitPathMetricKey,
  type GitScatterMetricKey,
  HISTO_CHARTS
} from "../model/chartConfig"
import {
  ALL_GIT_METRICS_OPTION,
  BOXPLOT_METRICS,
  GIT_METRIC_OPTIONS,
  GIT_PATH_COLORS_DARK,
  GIT_PATH_COLORS_LIGHT,
  HISTO_METRICS
} from "../model/constants"
import { buildGitChartsDataset, getPathColorMap } from "../model/gitCharts"
import { ChartCard, HorizontalBarChart, MetricGroupsBoxPlot, ScatterChart } from "./components"

type Props = {
  rows: GitAnalysisRow[]
  analysisDepth?: number
}

type GitChartsForm = {
  chartMode: "boxplot" | "histo"
  selectedMetrics: string[]
}

const areArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const DEFAULT_SELECTED_GIT_METRICS = [ALL_GIT_METRICS_OPTION]

export function GitChartsSection({ rows, analysisDepth }: Props) {
  const form = useForm<GitChartsForm>({
    defaultValues: {
      chartMode: "histo",
      selectedMetrics: [ALL_GIT_METRICS_OPTION]
    }
  })
  const chartMode = useWatch({ control: form.control, name: "chartMode" }) || "histo"
  const selectedMetrics =
    useWatch({ control: form.control, name: "selectedMetrics" }) || DEFAULT_SELECTED_GIT_METRICS
  const { colorScheme } = useMantineColorScheme()
  const chartData = useMemo(() => buildGitChartsDataset(rows), [rows])
  const availableMetrics = useMemo(
    () => (chartMode === "boxplot" ? BOXPLOT_METRICS : HISTO_METRICS),
    [chartMode]
  )

  const metricOptions = useMemo(
    () =>
      GIT_METRIC_OPTIONS.filter(
        (option) =>
          option.value === ALL_GIT_METRICS_OPTION || availableMetrics.includes(option.value)
      ),
    [availableMetrics]
  )
  const selectedMetricSet = useMemo(() => {
    const metrics = selectedMetrics.includes(ALL_GIT_METRICS_OPTION)
      ? availableMetrics
      : selectedMetrics.filter((metric) => availableMetrics.includes(metric))
    return new Set(metrics)
  }, [availableMetrics, selectedMetrics])

  useEffect(() => {
    if (selectedMetrics.includes(ALL_GIT_METRICS_OPTION)) {
      return
    }
    const filteredMetrics = selectedMetrics.filter((metric) => availableMetrics.includes(metric))
    const nextMetrics = filteredMetrics.length ? filteredMetrics : [ALL_GIT_METRICS_OPTION]
    if (!areArraysEqual(selectedMetrics, nextMetrics)) {
      form.setValue("selectedMetrics", nextMetrics)
    }
  }, [availableMetrics, form, selectedMetrics])

  const handleMetricChange = (values: string[]) => {
    const normalizedValues = values.filter(
      (value) => value === ALL_GIT_METRICS_OPTION || availableMetrics.includes(value)
    )
    if (!normalizedValues.length) {
      form.setValue("selectedMetrics", [ALL_GIT_METRICS_OPTION])
      return
    }

    const hadAllBefore = selectedMetrics.includes(ALL_GIT_METRICS_OPTION)
    const hasAllNow = normalizedValues.includes(ALL_GIT_METRICS_OPTION)
    if (hasAllNow && normalizedValues.length === 1) {
      form.setValue("selectedMetrics", [ALL_GIT_METRICS_OPTION])
      return
    }
    if (hasAllNow && normalizedValues.length > 1) {
      form.setValue(
        "selectedMetrics",
        hadAllBefore
          ? normalizedValues.filter((value) => value !== ALL_GIT_METRICS_OPTION)
          : [ALL_GIT_METRICS_OPTION]
      )
      return
    }
    form.setValue("selectedMetrics", normalizedValues)
  }
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
    const palette = colorScheme === "dark" ? GIT_PATH_COLORS_DARK : GIT_PATH_COLORS_LIGHT
    return getPathColorMap(chartRows, analysisDepth, palette)
  }, [analysisDepth, chartData, colorScheme])

  if (!rows.length) {
    return null
  }

  const getPathMetricData = (key: GitPathMetricKey) => chartData[key]
  const getScatterData = (key: GitScatterMetricKey) => chartData[key]

  const show = (metric: string) => selectedMetricSet.has(metric)

  return (
    <Stack gap="md">
      <Stack gap="md">
        <Controller
          control={form.control}
          name="chartMode"
          render={({ field }) => (
            <Select
              data={[
                { value: "histo", label: "Гисто/точечные" },
                { value: "boxplot", label: "Боксплоты" }
              ]}
              label="Формат графиков"
              value={field.value}
              w={280}
              onChange={(value) => field.onChange((value as "boxplot" | "histo") || "histo")}
            />
          )}
        />
        <Controller
          control={form.control}
          name="selectedMetrics"
          render={({ field }) => (
            <MultiSelect
              clearable={!field.value.includes(ALL_GIT_METRICS_OPTION)}
              data={metricOptions}
              label="Метрики для графиков (Git)"
              placeholder="Выберите метрики"
              searchable
              value={field.value}
              w={520}
              onChange={handleMetricChange}
            />
          )}
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
