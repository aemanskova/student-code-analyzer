import { AnalysisCharts, AnalysisTable } from "@entities/analysis"
import { Button, Group, Skeleton, Stack, Tabs, Text, TextInput } from "@mantine/core"
import { ChartLineUp, Table as TableIcon } from "@phosphor-icons/react"
import { useMemo, useState } from "react"

import { useMetricsResults } from "../model/useMetricsResults"
import { useMetricsRunView } from "../model/useMetricsRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export function MetricsResultsSection({ runId, analysisDepth, selectedLevels }: Props) {
  const [contentTab, setContentTab] = useState<string | null>("charts")
  const { isViewLoading, rows, gitRows, metrics } = useMetricsRunView({
    analysisDepth,
    runId,
    selectedLevels
  })

  const { pathFilter, setPathFilter, filteredRows, hasRows, hasFilteredRows, downloadMetricsCsv } =
    useMetricsResults(rows, metrics)

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
            <Stack gap="sm">
              <Skeleton h={22} radius="sm" w={260} />
              <Skeleton h={280} radius="md" />
              <Skeleton h={280} radius="md" />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel pt="md" value="table">
            <Stack gap="sm">
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
              <Group align="flex-end" justify="space-between" grow>
                <TextInput
                  disabled={!hasRows}
                  label="Поиск по пути"
                  placeholder="Введите часть пути (например, group1/student2)"
                  value={pathFilter}
                  onChange={(event) => setPathFilter(event.currentTarget.value)}
                />
                <Button
                  disabled={!hasFilteredRows}
                  onClick={downloadMetricsCsv}
                  style={{ alignSelf: "flex-end", flexGrow: 0 }}
                >
                  Скачать CSV
                </Button>
              </Group>

              {hasFilteredRows ? (
                <AnalysisTable metrics={metrics} rows={filteredRows} />
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
