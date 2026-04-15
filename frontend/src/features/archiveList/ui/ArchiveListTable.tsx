import type { AnalysisListItem } from "@entities/analysis/api"
import { ActionIcon, Box, Pagination, Table, Tooltip } from "@mantine/core"
import { Trash } from "@phosphor-icons/react"
import { EmptyState } from "@shared/ui"
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

const SKELETON_ROWS = Array.from({ length: 8 }, (_, index) => index)

const RowSkeleton = () => (
  <Table.Tr>
    <Table.Td>
      <Box h={12} style={{ background: "var(--mantine-color-gray-2)", borderRadius: 6 }} w="70%" />
    </Table.Td>
    <Table.Td>
      <Box h={12} style={{ background: "var(--mantine-color-gray-2)", borderRadius: 6 }} w="55%" />
    </Table.Td>
    <Table.Td>
      <Box h={12} style={{ background: "var(--mantine-color-gray-2)", borderRadius: 6 }} w="60%" />
    </Table.Td>
    <Table.Td>
      <Box h={12} style={{ background: "var(--mantine-color-gray-2)", borderRadius: 6 }} w={20} />
    </Table.Td>
  </Table.Tr>
)

export const ArchiveListTable = ({
  rows,
  page,
  totalPages,
  isInitialLoading,
  isUpdating,
  onPageChange,
  onDeleteRun
}: Props) => (
  <>
    <Box>
      <Table highlightOnHover horizontalSpacing="sm" striped verticalSpacing="sm" withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Папка анализа</Table.Th>
            <Table.Th>Направление</Table.Th>
            <Table.Th>Дата</Table.Th>
            <Table.Th w={56}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isInitialLoading || isUpdating
            ? SKELETON_ROWS.map((row) => <RowSkeleton key={`skeleton-${row}`} />)
            : rows.map((row) => (
                <Table.Tr key={`${row.runId}:${row.path}:${row.date}:${row.direction}`}>
                  <Table.Td>
                    <NavLink
                      to={`/archive/${encodeURIComponent(row.path)}?direction=${encodeURIComponent(row.direction)}&runId=${encodeURIComponent(row.runId)}`}
                    >
                      {row.path}
                    </NavLink>
                  </Table.Td>
                  <Table.Td>{row.direction}</Table.Td>
                  <Table.Td>{new Date(row.date).toLocaleString()}</Table.Td>
                  <Table.Td>
                    <Tooltip label="Удалить отчет">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => onDeleteRun(row.runId, row.path)}
                      >
                        <Trash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
        </Table.Tbody>
      </Table>
    </Box>

    {!isInitialLoading && !isUpdating && !rows.length ? (
      <EmptyState text="По заданным фильтрам записи не найдены." />
    ) : null}

    <Pagination
      disabled={isInitialLoading || isUpdating}
      total={totalPages}
      value={page}
      onChange={onPageChange}
    />
  </>
)
