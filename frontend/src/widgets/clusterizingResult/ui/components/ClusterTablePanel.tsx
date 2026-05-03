import type { ClusteredMetricRow } from "@entities/clusterizing"
import { Button, Group, Stack, TextInput } from "@mantine/core"
import { AllOptionsMultiSelect, DataTable, type VirtualizedColumn } from "@shared/ui"
import { type Control, Controller } from "react-hook-form"

import {
  ALL_CLUSTER_TABLE_METRICS,
  type ClusterizingResultForm
} from "../../lib/hooks/useClusterizingResult"

type Props = {
  columns: Array<VirtualizedColumn<ClusteredMetricRow>>
  control: Control<ClusterizingResultForm>
  filteredRows: ClusteredMetricRow[]
  metricsCount: number
  onDownload: () => void
  tableMetricOptions: Array<{ value: string; label: string }>
}

export function ClusterTablePanel({
  columns,
  control,
  filteredRows,
  metricsCount,
  onDownload,
  tableMetricOptions
}: Props) {
  return (
    <Stack gap="md">
      <Group align="flex-start" justify="space-between">
        <Stack gap="sm">
          <Controller
            control={control}
            name="pathFilter"
            render={({ field }) => (
              <TextInput
                label="Поиск по пути"
                placeholder="Введите часть пути"
                value={field.value}
                w={520}
                onChange={(event) => field.onChange(event.currentTarget.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="selectedTableMetrics"
            render={({ field }) => (
              <AllOptionsMultiSelect
                allLabel="Все метрики"
                allValue={ALL_CLUSTER_TABLE_METRICS}
                label="Метрики для таблицы"
                options={tableMetricOptions}
                searchable
                value={field.value}
                w={520}
                onChange={field.onChange}
              />
            )}
          />
        </Stack>
        <Button disabled={!filteredRows.length} onClick={onDownload}>
          Скачать CSV
        </Button>
      </Group>
      <DataTable
        columns={columns}
        data={filteredRows}
        emptyText="Строки не найдены."
        getRowKey={(row) => `${row.runId}:${row.path}:${row.cluster}`}
        maxHeight={620}
        minTableWidth={Math.max(760, 430 + metricsCount * 160)}
        rowHeight={46}
      />
    </Stack>
  )
}
