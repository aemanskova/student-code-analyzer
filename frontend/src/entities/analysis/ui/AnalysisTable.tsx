import type { AnalysisRow } from "@entities/analysis/api"
import { DataTable, type VirtualizedColumn } from "@shared/ui/table"

type Props = {
  rows: AnalysisRow[]
  metrics: string[]
}

export function AnalysisTable({ rows, metrics }: Props) {
  const columns: Array<VirtualizedColumn<AnalysisRow>> = [
    {
      key: "path",
      title: "Путь",
      minWidth: 260,
      render: (row) => row.path
    },
    ...metrics.map((metric) => ({
      key: metric,
      title: metric,
      minWidth: 140,
      render: (row: AnalysisRow) => String(row[metric] ?? "")
    }))
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyText="Нет строк для отображения."
      getRowKey={(row) => row.path}
      maxHeight={480}
      // minTableWidth={Math.max(900, 260 + metrics.length * 140)}
      overscan={120}
      rowHeight={42}
    />
  )
}
