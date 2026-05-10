import { GIT_COLUMN_OPTIONS, GitAnalysisTable } from "@entities/analysis"
import type { GitAnalysisRow } from "@entities/analysis/api"
import { buildGitChartsDataset, GIT_METRIC_OPTIONS, GitChartsSection } from "@features/gitCharts"
import { Button, Card, Group, Skeleton, Stack, Tabs, Text, TextInput } from "@mantine/core"
import { ChartLineUp, Table as TableIcon } from "@phosphor-icons/react"
import { buildCsv, downloadCsvFile, toDisplayValue } from "@shared/lib"
import { AllOptionsMultiSelect, DataTable, type VirtualizedColumn } from "@shared/ui"
import { type ReactNode, useCallback, useMemo, useState } from "react"
import { Controller } from "react-hook-form"

import { useGitResults } from "../model/useGitResults"
import { useGitRunView } from "../model/useGitRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

const ALL_GIT_TABLE_METRICS = "__all__"
const PROCESS_METRICS = GIT_METRIC_OPTIONS.filter((option) => option.value !== "__all__")

type ProcessMetricRow = {
  path: string
  totalCommitCount: number
  meaningfulCommitCount: number
  activeDays: number
  nightCommitPct: number
  medianCommitSize: number
  developmentDurationDays: number
  codeChurn: number
  churnRatio: number
  commitsVsChurn: string
  commitsVsChurnPct: string
}

const toPathValueMap = (items: Array<{ path: string; value: number }>) =>
  new Map(items.map((item) => [item.path, item.value]))

const toScatterValueMap = (items: Array<{ path: string; x: number; y: number }>) =>
  new Map(items.map((item) => [item.path, `${item.x} / ${item.y}`]))

const buildProcessMetricRows = (rows: GitAnalysisRow[]) => {
  const dataset = buildGitChartsDataset(rows)
  const totalCommitCount = toPathValueMap(dataset.totalCommitCount)
  const meaningfulCommitCount = toPathValueMap(dataset.meaningfulCommitCount)
  const activeDays = toPathValueMap(dataset.activeDays)
  const nightCommitPct = toPathValueMap(dataset.nightCommitPct)
  const medianCommitSize = toPathValueMap(dataset.medianCommitSize)
  const developmentDurationDays = toPathValueMap(dataset.developmentDurationDays)
  const codeChurn = toPathValueMap(dataset.codeChurn)
  const churnRatio = toPathValueMap(dataset.churnRatio)
  const commitsVsChurn = toScatterValueMap(dataset.commitsVsChurn)
  const commitsVsChurnPct = toScatterValueMap(dataset.commitsVsChurnPct)
  const paths = Array.from(new Set(rows.map((row) => row.path))).sort((a, b) => a.localeCompare(b))

  return paths.map((path) => ({
    path,
    totalCommitCount: totalCommitCount.get(path) || 0,
    meaningfulCommitCount: meaningfulCommitCount.get(path) || 0,
    activeDays: activeDays.get(path) || 0,
    nightCommitPct: nightCommitPct.get(path) || 0,
    medianCommitSize: medianCommitSize.get(path) || 0,
    developmentDurationDays: developmentDurationDays.get(path) || 0,
    codeChurn: codeChurn.get(path) || 0,
    churnRatio: churnRatio.get(path) || 0,
    commitsVsChurn: commitsVsChurn.get(path) || "0 / 0",
    commitsVsChurnPct: commitsVsChurnPct.get(path) || "0 / 0"
  }))
}

const toProcessMetricsCsv = (rows: ProcessMetricRow[]) =>
  buildCsv(
    ["path", ...PROCESS_METRICS.map((metric) => metric.value)],
    rows.map((row) => [
      row.path,
      ...PROCESS_METRICS.map((metric) => String(row[metric.value as keyof ProcessMetricRow] ?? ""))
    ])
  )

type GitTableCardProps = {
  children: ReactNode
  disabled?: boolean
  onDownload: () => void
  title: string
}

function GitTableCard({ children, disabled, onDownload, title }: GitTableCardProps) {
  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{title}</Text>
          <Button disabled={disabled} size="xs" onClick={onDownload}>
            Скачать CSV
          </Button>
        </Group>
        {children}
      </Stack>
    </Card>
  )
}

export function GitResultsSection({ runId, analysisDepth, selectedLevels }: Props) {
  const [contentTab, setContentTab] = useState<string | null>("charts")
  const [selectedProcessMetrics, setSelectedProcessMetrics] = useState<string[]>([
    ALL_GIT_TABLE_METRICS
  ])
  const { isViewLoading, rows } = useGitRunView({ analysisDepth, runId, selectedLevels })

  const visibleProcessMetrics = selectedProcessMetrics.includes(ALL_GIT_TABLE_METRICS)
    ? PROCESS_METRICS
    : PROCESS_METRICS.filter((metric) =>
        selectedProcessMetrics.some((selectedMetric) => selectedMetric === metric.value)
      )
  const processColumns = useMemo<Array<VirtualizedColumn<ProcessMetricRow>>>(
    () => [
      { key: "path", title: "Репозиторий", minWidth: 240, render: (row) => row.path },
      ...visibleProcessMetrics.map((metric) => ({
        key: metric.value,
        title: metric.label,
        minWidth: 170,
        render: (row: ProcessMetricRow) =>
          toDisplayValue(row[metric.value as keyof ProcessMetricRow])
      }))
    ],
    [visibleProcessMetrics]
  )

  const { control, filteredRows, hasRows, hasFilteredRows, downloadGitCsv } = useGitResults(rows)
  const processMetricRows = useMemo(() => buildProcessMetricRows(filteredRows), [filteredRows])
  const hasProcessMetricRows = processMetricRows.length > 0
  const downloadProcessMetricsCsv = useCallback(() => {
    if (!processMetricRows.length) {
      return
    }
    downloadCsvFile(
      `analysis_git_process_metrics_${Date.now()}.csv`,
      toProcessMetricsCsv(processMetricRows)
    )
  }, [processMetricRows])

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
            <GitChartsSection
              analysisDepth={analysisDepth}
              rows={filteredRows}
              runId={runId}
              selectedLevels={selectedLevels}
            />
          </Tabs.Panel>

          <Tabs.Panel pt="md" value="table">
            <Stack gap="md">
              <Controller
                control={control}
                name="pathFilter"
                render={({ field }) => (
                  <TextInput
                    disabled={!hasRows}
                    label="Папка"
                    placeholder="Введите название папки"
                    value={field.value}
                    w={520}
                    onChange={(event) => field.onChange(event.currentTarget.value)}
                  />
                )}
              />

              <GitTableCard
                disabled={!hasProcessMetricRows}
                title="Процессные метрики"
                onDownload={downloadProcessMetricsCsv}
              >
                <Stack gap="sm">
                  <AllOptionsMultiSelect
                    allLabel="Все метрики"
                    allValue={ALL_GIT_TABLE_METRICS}
                    disabled={!hasRows}
                    label="Метрики"
                    options={PROCESS_METRICS}
                    searchable
                    value={selectedProcessMetrics}
                    w={520}
                    onChange={setSelectedProcessMetrics}
                  />
                  {hasProcessMetricRows ? (
                    <DataTable
                      columns={processColumns}
                      data={processMetricRows}
                      emptyText="Процессные Git-метрики отсутствуют."
                      getRowKey={(row) => row.path}
                      maxHeight={420}
                      minTableWidth={Math.max(760, 240 + visibleProcessMetrics.length * 170)}
                      rowHeight={46}
                    />
                  ) : (
                    <Text c="dimmed">По заданному фильтру процессные метрики не найдены.</Text>
                  )}
                </Stack>
              </GitTableCard>

              <GitTableCard
                disabled={!hasFilteredRows}
                title="История изменений"
                onDownload={downloadGitCsv}
              >
                {hasFilteredRows ? (
                  <GitAnalysisTable
                    columns={GIT_COLUMN_OPTIONS.map((option) => option.value)}
                    rows={filteredRows}
                  />
                ) : (
                  <Text c="dimmed">По заданному фильтру git-строки не найдены.</Text>
                )}
              </GitTableCard>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
