import type { ClusteredMetricRow, ExcludedMetricRow } from "@entities/clusterizing"
import { Button, Card, Group, Stack, Text } from "@mantine/core"
import { DataTable, type VirtualizedColumn } from "@shared/ui"

type Props<T extends ClusteredMetricRow | ExcludedMetricRow> = {
  columns: Array<VirtualizedColumn<T>>
  data: T[]
  emptyText: string
  getRowKey: (row: T) => string
  minTableWidth: number
  onDownload: () => void
  title: string
}

export function ClusterExceptionRowsCard<T extends ClusteredMetricRow | ExcludedMetricRow>({
  columns,
  data,
  emptyText,
  getRowKey,
  minTableWidth,
  onDownload,
  title
}: Props<T>) {
  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{title}</Text>
          <Button disabled={!data.length} size="xs" onClick={onDownload}>
            Скачать CSV
          </Button>
        </Group>
        <DataTable
          columns={columns}
          data={data}
          emptyText={emptyText}
          getRowKey={getRowKey}
          maxHeight={420}
          minTableWidth={minTableWidth}
          rowHeight={46}
        />
      </Stack>
    </Card>
  )
}
