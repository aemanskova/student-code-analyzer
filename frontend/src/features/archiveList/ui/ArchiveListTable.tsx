import type { AnalysisListItem } from "@entities/analysis/api"
import { ActionIcon, Anchor, Group, Loader, Pagination, Stack, Tooltip } from "@mantine/core"
import { Trash } from "@phosphor-icons/react"
import { EmptyState } from "@shared/ui"
import { type VirtualizedColumn, VirtualizedTable } from "@shared/ui/table"
import { NavLink } from "react-router"

type Props = {
  rows: AnalysisListItem[]
  page: number
  totalPages: number
  isInitialLoading: boolean
  isUpdating: boolean
  onPageChange: (value: number) => void
  onDeleteRun: (runId: string, path: string) => void
}

export const ArchiveListTable = ({
  rows,
  page,
  totalPages,
  isInitialLoading,
  isUpdating,
  onPageChange,
  onDeleteRun
}: Props) => {
  if (isInitialLoading || isUpdating) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  const columns: Array<VirtualizedColumn<AnalysisListItem>> = [
    {
      key: "path",
      title: "Папка анализа",
      minWidth: 360,
      render: (row) => (
        <Anchor
          c="myColor.6"
          component={NavLink}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
          to={`/archive/${encodeURIComponent(row.path)}?direction=${encodeURIComponent(row.direction)}&runId=${encodeURIComponent(row.runId)}`}
        >
          {row.path}
        </Anchor>
      )
    },
    {
      key: "direction",
      title: "Направление",
      minWidth: 180,
      render: (row) => row.direction
    },
    {
      key: "date",
      title: "Дата",
      minWidth: 220,
      render: (row) => new Date(row.date).toLocaleString()
    },
    {
      key: "actions",
      title: "",
      minWidth: 72,
      render: (row) => (
        <Tooltip label="Удалить отчет">
          <ActionIcon color="red" variant="subtle" onClick={() => onDeleteRun(row.runId, row.path)}>
            <Trash size={16} />
          </ActionIcon>
        </Tooltip>
      )
    }
  ]
  const headerHeight = 46
  const rowHeight = 52
  const tableBottomBuffer = 8
  const tableHeight = headerHeight + rows.length * rowHeight + tableBottomBuffer

  return (
    <>
      {rows.length ? (
        <Stack gap="md">
          <VirtualizedTable
            columns={columns}
            data={rows}
            disableVerticalScroll
            getRowKey={(row) => `${row.runId}:${row.path}:${row.date}:${row.direction}`}
            fullWidth
            maxHeight={tableHeight}
            overscan={120}
            rowHeight={rowHeight}
          />
          <Pagination total={totalPages} value={page} onChange={onPageChange} />
        </Stack>
      ) : (
        <EmptyState text="По заданным фильтрам записи не найдены." />
      )}
    </>
  )
}
