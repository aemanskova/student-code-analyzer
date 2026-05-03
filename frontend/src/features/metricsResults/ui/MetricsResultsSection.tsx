import { AnalysisCharts, AnalysisTable } from "@entities/analysis"
import { Button, Group, Skeleton, Stack, Tabs, Text, TextInput } from "@mantine/core"
import { ChartLineUp, Table as TableIcon } from "@phosphor-icons/react"
import { AllOptionsMultiSelect } from "@shared/ui"
import { useMemo, useState } from "react"
import { Controller } from "react-hook-form"

import { useMetricsResults } from "../model/useMetricsResults"
import { useMetricsRunView } from "../model/useMetricsRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

const ALL_TABLE_METRICS = "__all__"

export function MetricsResultsSection({ runId, analysisDepth, selectedLevels }: Props) {
  const [contentTab, setContentTab] = useState<string | null>("charts")
  const [selectedTableMetrics, setSelectedTableMetrics] = useState<string[]>([ALL_TABLE_METRICS])
  const { isViewLoading, rows, gitRows, metrics } = useMetricsRunView({
    analysisDepth,
    runId,
    selectedLevels
  })

  const visibleTableMetrics = useMemo(
    () =>
      selectedTableMetrics.includes(ALL_TABLE_METRICS)
        ? metrics
        : selectedTableMetrics.filter((metric) => metrics.includes(metric)),
    [metrics, selectedTableMetrics]
  )
  const metricOptions = useMemo(
    () => metrics.map((metric) => ({ value: metric, label: metric })),
    [metrics]
  )

  const { control, filteredRows, hasRows, hasFilteredRows, downloadMetricsCsv } =
    useMetricsResults(rows, visibleTableMetrics)

  const chart = useMemo(
    () => (
      <AnalysisCharts
        analysisDepth={analysisDepth}
        gitRows={gitRows}
        rows={rows}
        selectedMetrics={metrics}
      />
    ),
    [analysisDepth, gitRows, metrics, rows]
  )

  const showEmptyMetrics = !isViewLoading && !hasRows

  return (
    <Stack gap="md">
      {isViewLoading ? (
        <Tabs keepMounted={false} value={contentTab} onChange={setContentTab}>
          <Tabs.List>
            <Tabs.Tab leftSection={<ChartLineUp size={16} />} value="charts">
              Дэшборд
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TableIcon size={16} />} value="table">
              Таблица
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel pt="md" value="charts">
            <Stack gap="md">
              <Skeleton h={22} radius="sm" w={260} />
              <Skeleton h={280} radius="md" />
              <Skeleton h={280} radius="md" />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="table">
            <Stack gap="md">
              <Skeleton h={52} radius="sm" />
              <Skeleton h={320} radius="md" />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Tabs keepMounted={false} value={contentTab} onChange={setContentTab}>
          <Tabs.List>
            <Tabs.Tab leftSection={<ChartLineUp size={16} />} value="charts">
              Дэшборд
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TableIcon size={16} />} value="table">
              Таблица
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel pt="md" value="charts">
            {chart}
          </Tabs.Panel>

          <Tabs.Panel pt="md" value="table">
            <Stack gap="md">
              <Group align="flex-start" justify="space-between">
                <Stack gap="sm">
                  <Controller
                    control={control}
                    name="pathFilter"
                    render={({ field }) => (
                      <TextInput
                        disabled={!hasRows}
                        label="Поиск по пути"
                        placeholder="Введите часть пути (например, group1/student2)"
                        value={field.value}
                        w={520}
                        onChange={(event) => field.onChange(event.currentTarget.value)}
                      />
                    )}
                  />
                  <AllOptionsMultiSelect
                    allLabel="Все метрики"
                    allValue={ALL_TABLE_METRICS}
                    disabled={!hasRows}
                    label="Метрики для таблицы"
                    options={metricOptions}
                    searchable
                    value={selectedTableMetrics}
                    w={520}
                    onChange={setSelectedTableMetrics}
                  />
                </Stack>
                <Button disabled={!hasFilteredRows} onClick={downloadMetricsCsv}>
                  Скачать CSV
                </Button>
              </Group>

              {hasFilteredRows ? (
                <AnalysisTable metrics={visibleTableMetrics} rows={filteredRows} />
              ) : showEmptyMetrics ? (
                <Text c="dimmed">
                  Результаты пока не готовы или запуск не содержит строк для выбранных метрик.
                </Text>
              ) : (
                <Text c="dimmed">По заданному фильтру строки не найдены.</Text>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
