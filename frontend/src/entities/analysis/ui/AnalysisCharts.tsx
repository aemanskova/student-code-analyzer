import type { AnalysisRow, GitAnalysisRow } from "@entities/analysis/api"
import { Card, Grid, MultiSelect, Stack, Tabs, Text } from "@mantine/core"
import { CalendarDots, ChartBar } from "@phosphor-icons/react"
import { useMemo, useState } from "react"

import {
  ALL_METRICS_OPTION,
  buildGitYearResolver,
  useMetricSelection
} from "../model/analysis-charts"
import { getNumericMetrics } from "../model/helpers"
import { MetricHistogram, MetricYearViolinChart } from "./analysis-charts"

type Props = {
  rows: AnalysisRow[]
  gitRows?: GitAnalysisRow[]
  selectedMetrics: string[]
  analysisDepth?: number
}

export function AnalysisCharts({ rows, gitRows = [], selectedMetrics, analysisDepth }: Props) {
  const [chartTab, setChartTab] = useState<string | null>("distribution")
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

  const {
    handleChange,
    metrics,
    metricOptions,
    selectedMetrics: selectedChartMetrics
  } = useMetricSelection({ availableMetrics })

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
      <MultiSelect
        clearable={!selectedChartMetrics.includes(ALL_METRICS_OPTION)}
        data={metricOptions}
        label="Метрики для графиков"
        placeholder="Выберите метрики"
        searchable
        value={selectedChartMetrics}
        w={520}
        onChange={handleChange}
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
