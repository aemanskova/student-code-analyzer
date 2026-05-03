import type { AnalysisRow, GitAnalysisRow } from "@entities/analysis/api"
import { Card, Grid, Stack, Tabs, Text } from "@mantine/core"
import { CalendarDots, ChartBar } from "@phosphor-icons/react"
import { AllOptionsMultiSelect } from "@shared/ui"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { ALL_METRICS_OPTION, buildGitYearResolver } from "../model/analysis-charts"
import { getNumericMetrics } from "../model/helpers"
import { MetricHistogram, MetricYearViolinChart } from "./analysis-charts"

type Props = {
  rows: AnalysisRow[]
  gitRows?: GitAnalysisRow[]
  selectedMetrics: string[]
  analysisDepth?: number
}

type AnalysisChartsForm = {
  selectedMetrics: string[]
}

const areArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const DEFAULT_SELECTED_CHART_METRICS = [ALL_METRICS_OPTION]

export function AnalysisCharts({ rows, gitRows = [], selectedMetrics, analysisDepth }: Props) {
  const [chartTab, setChartTab] = useState<string | null>("distribution")
  const form = useForm<AnalysisChartsForm>({
    defaultValues: {
      selectedMetrics: [ALL_METRICS_OPTION]
    }
  })
  const selectedChartMetrics =
    useWatch({ control: form.control, name: "selectedMetrics" }) ||
    DEFAULT_SELECTED_CHART_METRICS
  const gitYearResolver = useMemo(
    () => buildGitYearResolver(gitRows, analysisDepth, null),
    [analysisDepth, gitRows]
  )

  const availableMetrics = useMemo(() => {
    const numericMetrics = getNumericMetrics(rows)
    if (!selectedMetrics.length) {
      return numericMetrics
    }
    return selectedMetrics.filter((metric) => numericMetrics.includes(metric))
  }, [rows, selectedMetrics])

  const metricOptions = useMemo(
    () => availableMetrics.map((metric) => ({ value: metric, label: metric })),
    [availableMetrics]
  )
  const metrics = useMemo(() => {
    if (selectedChartMetrics.includes(ALL_METRICS_OPTION)) {
      return availableMetrics
    }
    return selectedChartMetrics.filter((metric) => availableMetrics.includes(metric))
  }, [availableMetrics, selectedChartMetrics])

  useEffect(() => {
    if (selectedChartMetrics.includes(ALL_METRICS_OPTION)) {
      return
    }
    const filteredMetrics = selectedChartMetrics.filter((metric) =>
      availableMetrics.includes(metric)
    )
    const nextMetrics = filteredMetrics.length ? filteredMetrics : [ALL_METRICS_OPTION]
    if (!areArraysEqual(selectedChartMetrics, nextMetrics)) {
      form.setValue("selectedMetrics", nextMetrics)
    }
  }, [availableMetrics, form, selectedChartMetrics])

  const handleMetricChange = (values: string[]) => {
    const normalizedValues = values.filter(
      (value) => value === ALL_METRICS_OPTION || availableMetrics.includes(value)
    )
    if (!normalizedValues.length) {
      form.setValue("selectedMetrics", [ALL_METRICS_OPTION])
      return
    }

    const hadAllBefore = selectedChartMetrics.includes(ALL_METRICS_OPTION)
    const hasAllNow = normalizedValues.includes(ALL_METRICS_OPTION)
    if (hasAllNow && normalizedValues.length === 1) {
      form.setValue("selectedMetrics", [ALL_METRICS_OPTION])
      return
    }
    if (hasAllNow && normalizedValues.length > 1) {
      form.setValue(
        "selectedMetrics",
        hadAllBefore
          ? normalizedValues.filter((value) => value !== ALL_METRICS_OPTION)
          : [ALL_METRICS_OPTION]
      )
      return
    }
    form.setValue("selectedMetrics", normalizedValues)
  }

  if (!rows.length) {
    return <Text c="dimmed">Нет данных для построения графиков</Text>
  }

  if (!availableMetrics.length) {
    return <Text c="dimmed">Нет числовых метрик для построения гистограмм</Text>
  }

  if (!metrics.length) {
    return <Text c="dimmed">Выберите хотя бы одну метрику.</Text>
  }

  return (
    <Stack gap="md">
      <Controller
        control={form.control}
        name="selectedMetrics"
        render={({ field }) => (
          <AllOptionsMultiSelect
            allLabel="Все метрики"
            allValue={ALL_METRICS_OPTION}
            label="Метрики для графиков"
            options={metricOptions}
            placeholder="Выберите метрики"
            searchable
            value={field.value}
            w={520}
            onChange={(value) => handleMetricChange(value)}
          />
        )}
      />

      <Tabs keepMounted={false} value={chartTab} onChange={setChartTab}>
        <Tabs.List>
          <Tabs.Tab leftSection={<ChartBar size={16} />} value="distribution">
            Распределение показателей
          </Tabs.Tab>
          <Tabs.Tab leftSection={<CalendarDots size={16} />} value="years">
            Динамика по годам
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel pt="md" value="distribution">
          <Grid>
            {metrics.map((metric) => (
              <Grid.Col key={`hist:${metric}`} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card withBorder>
                  <Stack gap="md">
                    <Text fw={600} size="sm">
                      {metric}
                    </Text>
                    <MetricHistogram metric={metric} rows={rows} />
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel pt="md" value="years">
          <Grid>
            {metrics.map((metric) => (
              <Grid.Col key={`year:${metric}`} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card withBorder>
                  <Stack gap="md">
                    <Text fw={600} size="sm">
                      {metric}
                    </Text>
                    <MetricYearViolinChart
                      analysisDepth={analysisDepth}
                      gitYearResolver={gitYearResolver}
                      metric={metric}
                      rows={rows}
                    />
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
