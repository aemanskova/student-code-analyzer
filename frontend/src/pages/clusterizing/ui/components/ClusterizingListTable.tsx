import { type ClusterizationListItem } from "@entities/clusterizing"
import { Group, Loader, Pagination } from "@mantine/core"
import { EmptyState, type VirtualizedColumn, VirtualizedTable } from "@shared/ui"
import { type UseFormReturn } from "react-hook-form"

import { type ClusterizingListFiltersForm } from "../../lib/hooks/useClusterizingList"

type Props = {
  columns: Array<VirtualizedColumn<ClusterizationListItem>>
  form: UseFormReturn<ClusterizingListFiltersForm>
  isFetching: boolean
  isLoading: boolean
  pageRows: ClusterizationListItem[]
  rows: ClusterizationListItem[]
  safePage: number
  totalPages: number
}

export function ClusterizingListTable({
  columns,
  form,
  isFetching,
  isLoading,
  pageRows,
  rows,
  safePage,
  totalPages
}: Props) {
  const rowHeight = 52
  const tableHeight = 46 + pageRows.length * rowHeight + 8

  if (isLoading || isFetching) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (!rows.length) {
    return <EmptyState text="Выполненные кластеризации не найдены." />
  }

  if (!pageRows.length) {
    return <EmptyState text="По заданным фильтрам записи не найдены." />
  }

  return (
    <>
      <VirtualizedTable
        columns={columns}
        data={pageRows}
        disableVerticalScroll
        fullWidth
        getRowKey={(row) => row.jobId}
        maxHeight={tableHeight}
        overscan={120}
        rowHeight={rowHeight}
      />
      <Pagination
        total={totalPages}
        value={safePage}
        onChange={(value) => form.setValue("page", value)}
      />
    </>
  )
}
