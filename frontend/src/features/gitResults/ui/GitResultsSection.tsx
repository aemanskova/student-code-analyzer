import { GIT_COLUMN_OPTIONS, GitAnalysisTable } from "@entities/analysis"
import { GitChartsSection } from "@features/gitCharts"
import { Button, Group, MultiSelect, Skeleton, Stack, Tabs, Text, TextInput } from "@mantine/core"
import { ChartLineUp, Table as TableIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { Controller } from "react-hook-form"

import { useGitResults } from "../model/useGitResults"
import { useGitRunView } from "../model/useGitRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export function GitResultsSection({ runId, analysisDepth, selectedLevels }: Props) {
  const [contentTab, setContentTab] = useState<string | null>("charts")
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    GIT_COLUMN_OPTIONS.map((option) => option.value)
  )
  const { isViewLoading, rows } = useGitRunView({ analysisDepth, runId, selectedLevels })

  const { control, filteredRows, hasRows, hasFilteredRows, downloadGitCsv } = useGitResults(rows)

  if (!isViewLoading && !hasRows) {
    return null
  }

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
              <Skeleton h={22} radius="sm" w={210} />
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
            <GitChartsSection analysisDepth={analysisDepth} rows={filteredRows} />
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
                        placeholder="Введите часть пути репозитория"
                        value={field.value}
                        w={520}
                        onChange={(event) => field.onChange(event.currentTarget.value)}
                      />
                    )}
                  />
                  <MultiSelect
                    data={GIT_COLUMN_OPTIONS}
                    disabled={!hasRows}
                    label="Столбцы таблицы"
                    searchable
                    value={selectedColumns}
                    w={520}
                    onChange={setSelectedColumns}
                  />
                </Stack>
                <Button disabled={!hasFilteredRows} onClick={downloadGitCsv}>
                  Скачать CSV
                </Button>
              </Group>

              {hasFilteredRows ? (
                <GitAnalysisTable columns={selectedColumns} rows={filteredRows} />
              ) : (
                <Text c="dimmed">По заданному фильтру git-строки не найдены.</Text>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
