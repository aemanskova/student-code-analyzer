import { GitAnalysisTable } from "@entities/analysis"
import { GitChartsSection } from "@features/gitCharts"
import { Button, Group, Skeleton, Stack, Tabs, Text, TextInput } from "@mantine/core"
import { ChartLineUp, Table as TableIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { useGitResults } from "../model/useGitResults"
import { useGitRunView } from "../model/useGitRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export function GitResultsSection({ runId, analysisDepth, selectedLevels }: Props) {
  const [contentTab, setContentTab] = useState<string | null>("charts")
  const { isViewLoading, rows } = useGitRunView({ analysisDepth, runId, selectedLevels })

  const { pathFilter, setPathFilter, filteredRows, hasRows, hasFilteredRows, downloadGitCsv } =
    useGitResults(rows)

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
              <Group align="flex-end" justify="space-between" grow>
                <TextInput
                  disabled={!hasRows}
                  label="Поиск по пути"
                  placeholder="Введите часть пути репозитория"
                  value={pathFilter}
                  onChange={(event) => setPathFilter(event.currentTarget.value)}
                />
                <Button
                  disabled={!hasFilteredRows}
                  onClick={downloadGitCsv}
                  style={{ alignSelf: "flex-end", flexGrow: 0 }}
                >
                  Скачать CSV
                </Button>
              </Group>

              {hasFilteredRows ? (
                <GitAnalysisTable rows={filteredRows} />
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
