import { type ClusterizationListItem } from "@entities/clusterizing"
import { DataTable, type VirtualizedColumn } from "@shared/ui"
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

  return (
    <DataTable
      columns={columns}
      data={pageRows}
      disableVerticalScroll
      emptyText={
        rows.length
          ? "По заданным фильтрам записи не найдены."
          : "Выполненные кластеризации не найдены."
      }
      fullWidth
      getRowKey={(row) => row.jobId}
      isLoading={isLoading || isFetching}
      maxHeight={tableHeight}
      overscan={120}
      pagination={{
        page: safePage,
        total: totalPages,
        onChange: (value) => form.setValue("page", value)
      }}
      rowHeight={rowHeight}
    />
  )
}
