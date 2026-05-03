import type { ClusteredMetricRow } from "@entities/clusterizing"
import { Button, Group, Stack, Text, TextInput } from "@mantine/core"
import { type VirtualizedColumn, VirtualizedTable } from "@shared/ui"
import { type Control, Controller } from "react-hook-form"

import type { ClusterizingResultForm } from "../../lib/hooks/useClusterizingResult"

type Props = {
  columns: Array<VirtualizedColumn<ClusteredMetricRow>>
  control: Control<ClusterizingResultForm>
  filteredRows: ClusteredMetricRow[]
  metricsCount: number
  onDownload: () => void
}

export function ClusterTablePanel({
  columns,
  control,
  filteredRows,
  metricsCount,
  onDownload
}: Props) {
  return (
    <Stack gap="md">
      <Group align="flex-end" grow justify="space-between">
        <Controller
          control={control}
          name="pathFilter"
          render={({ field }) => (
            <TextInput
              label="Поиск по пути"
              placeholder="Введите часть пути"
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
            />
          )}
        />
        <Button
          disabled={!filteredRows.length}
          style={{ alignSelf: "flex-end", flexGrow: 0 }}
          onClick={onDownload}
        >
          Скачать CSV
        </Button>
      </Group>
      {filteredRows.length ? (
        <VirtualizedTable
          columns={columns}
          data={filteredRows}
          getRowKey={(row) => `${row.runId}:${row.path}:${row.cluster}`}
          maxHeight={620}
          minTableWidth={Math.max(760, 430 + metricsCount * 160)}
          rowHeight={46}
        />
      ) : (
        <Text c="dimmed">Строки не найдены.</Text>
      )}
    </Stack>
  )
}
