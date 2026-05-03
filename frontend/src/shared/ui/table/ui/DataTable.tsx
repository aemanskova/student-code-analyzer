import { Group, Loader, Pagination, Stack } from "@mantine/core"

import { EmptyState } from "../../empty"
import type { VirtualizedColumn } from "./VirtualizedTable"
import { VirtualizedTable } from "./VirtualizedTable"

type Props<T> = {
  columns: Array<VirtualizedColumn<T>>
  data: T[]
  emptyText: string
  getRowKey: (row: T, index: number) => string
  isLoading?: boolean
  maxHeight: number | string
  minTableWidth?: number
  fullWidth?: boolean
  disableVerticalScroll?: boolean
  rowHeight?: number
  overscan?: number
  pagination?: {
    page: number
    total: number
    onChange: (value: number) => void
  }
}

export function DataTable<T>({
  columns,
  data,
  disableVerticalScroll,
  emptyText,
  fullWidth,
  getRowKey,
  isLoading = false,
  maxHeight,
  minTableWidth,
  overscan,
  pagination,
  rowHeight
}: Props<T>) {
  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (!data.length) {
    return <EmptyState text={emptyText} />
  }

  return (
    <Stack gap="md">
      <VirtualizedTable
        columns={columns}
        data={data}
        disableVerticalScroll={disableVerticalScroll}
        fullWidth={fullWidth}
        getRowKey={getRowKey}
        maxHeight={maxHeight}
        minTableWidth={minTableWidth}
        overscan={overscan}
        rowHeight={rowHeight}
      />
      {pagination ? (
        <Pagination
          total={pagination.total}
          value={pagination.page}
          onChange={pagination.onChange}
        />
      ) : null}
    </Stack>
  )
}
