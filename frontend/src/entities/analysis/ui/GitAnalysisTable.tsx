import type { GitAnalysisRow } from "@entities/analysis/api"
import { Text } from "@mantine/core"
import { type VirtualizedColumn, VirtualizedTable } from "@shared/ui/table"

type Props = {
  columns?: string[]
  rows: GitAnalysisRow[]
}

const GIT_COLUMNS: Array<VirtualizedColumn<GitAnalysisRow>> = [
  { key: "path", title: "Репозиторий", minWidth: 180, render: (row) => row.path },
  { key: "branch", title: "Ветка", minWidth: 120, render: (row) => row.branch },
  { key: "hash", title: "Хеш", minWidth: 100, render: (row) => row.hash },
  { key: "date", title: "Дата", minWidth: 180, render: (row) => row.date },
  { key: "author", title: "Автор", minWidth: 160, render: (row) => row.author },
  { key: "filename", title: "Файл", minWidth: 240, render: (row) => row.filename },
  { key: "filetype", title: "Тип", minWidth: 100, render: (row) => row.filetype },
  { key: "changes", title: "Изменение", minWidth: 120, render: (row) => row.changes },
  { key: "added", title: "Добавлено", minWidth: 100, render: (row) => row.added },
  { key: "deleted", title: "Удалено", minWidth: 100, render: (row) => row.deleted },
  { key: "extraMetadata", title: "Мета", minWidth: 180, render: (row) => row.extraMetadata },
  { key: "message", title: "Сообщение", minWidth: 320, render: (row) => row.message }
]

export function GitAnalysisTable({ columns, rows }: Props) {
  if (!rows.length) {
    return <Text c="dimmed">Git-метрики отсутствуют.</Text>
  }

  const visibleColumns = columns?.length
    ? GIT_COLUMNS.filter((column) => columns.includes(column.key))
    : GIT_COLUMNS

  return (
    <VirtualizedTable
      columns={visibleColumns}
      data={rows}
      getRowKey={(row) => `${row.path}:${row.branch}:${row.hash}:${row.filename}`}
      maxHeight={520}
      minTableWidth={Math.max(760, visibleColumns.length * 150)}
      overscan={160}
      rowHeight={42}
    />
  )
}
