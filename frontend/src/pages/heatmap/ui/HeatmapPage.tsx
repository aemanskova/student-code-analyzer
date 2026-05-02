import {
  useDeleteStandaloneHeatmapMutation,
  useGetStandaloneHeatmapListQuery
} from "@entities/analysis/api"
import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Pagination,
  Stack,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { Trash } from "@phosphor-icons/react"
import { routes } from "@shared/config/routes"
import { ConfirmModal, EmptyState } from "@shared/ui"
import { type VirtualizedColumn, VirtualizedTable } from "@shared/ui/table"
import { useMemo, useState } from "react"
import { Link, NavLink } from "react-router"

const PAGE_SIZE = 8

const formatDate = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }
  return parsed.toLocaleString("ru-RU")
}

const formatDateParam = (value: Date | null): string | undefined => {
  if (!value) {
    return undefined
  }
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function HeatmapPage() {
  const [folder, setFolder] = useState("")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<{ jobId: string; folder: string } | null>(null)
  const [deleteStandaloneHeatmap, { isLoading: isDeleting }] = useDeleteStandaloneHeatmapMutation()

  const query = useMemo(
    () => ({
      folder: folder.trim() || undefined,
      dateFrom: formatDateParam(dateFrom),
      dateTo: formatDateParam(dateTo)
    }),
    [dateFrom, dateTo, folder]
  )

  const { data, isFetching, isLoading } = useGetStandaloneHeatmapListQuery(query)
  const items = useMemo(() => data?.data || [], [data?.data])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage]
  )

  const columns: Array<VirtualizedColumn<(typeof pageItems)[number]>> = [
    {
      key: "folder",
      title: "Папка",
      minWidth: 360,
      render: (row) => (
        <Anchor
          c="myColor.6"
          component={NavLink}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
          to={routes.heatmapDetails(row.jobId, row.folder)}
        >
          {row.folder}
        </Anchor>
      )
    },
    {
      key: "folderCount",
      title: "Работ",
      minWidth: 120,
      render: (row) => row.folderCount
    },
    {
      key: "finishedAt",
      title: "Выполнено",
      minWidth: 220,
      render: (row) => formatDate(row.finishedAt)
    },
    {
      key: "actions",
      title: "",
      minWidth: 72,
      render: (row) => (
        <Tooltip label="Удалить карту">
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => setPendingDelete({ jobId: row.jobId, folder: row.folder })}
          >
            <Trash size={16} />
          </ActionIcon>
        </Tooltip>
      )
    }
  ]

  const headerHeight = 46
  const rowHeight = 52
  const tableBottomBuffer = 8
  const tableHeight = headerHeight + pageItems.length * rowHeight + tableBottomBuffer

  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card p="md">
          <Group justify="space-between">
            <Title order={3}>Тепловые карты</Title>
            <Button component={Link} to={routes.heatmapBuild}>
              Построить тепловую карту
            </Button>
          </Group>
        </Card>

        <Card p="md">
          <Stack gap="md">
            <Group align="end" grow>
              <TextInput
                label="Путь"
                placeholder="Введите часть пути"
                value={folder}
                onChange={(event) => {
                  setFolder(event.currentTarget.value)
                  setPage(1)
                }}
              />
              <DatePickerInput
                clearable
                label="Дата с"
                placeholder="Выберите дату"
                value={dateFrom}
                onChange={(value) => {
                  setDateFrom(value ? new Date(value) : null)
                  setPage(1)
                }}
              />
              <DatePickerInput
                clearable
                label="Дата по"
                placeholder="Выберите дату"
                value={dateTo}
                onChange={(value) => {
                  setDateTo(value ? new Date(value) : null)
                  setPage(1)
                }}
              />
            </Group>

            {isLoading || isFetching ? (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            ) : null}

            {!isLoading && !isFetching && !items.length ? (
              <EmptyState text="По заданным фильтрам записи не найдены." />
            ) : null}

            {pageItems.length ? (
              <Stack gap={6}>
                <VirtualizedTable
                  columns={columns}
                  data={pageItems}
                  disableVerticalScroll
                  fullWidth
                  getRowKey={(row) => row.jobId}
                  maxHeight={tableHeight}
                  overscan={120}
                  rowHeight={rowHeight}
                />
                <Pagination total={totalPages} value={safePage} onChange={setPage} />
              </Stack>
            ) : null}
          </Stack>
        </Card>
      </Stack>

      <ConfirmModal
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        loading={isDeleting}
        message={`Вы уверены, что хотите удалить тепловую карту: ${pendingDelete?.folder || ""}?`}
        opened={Boolean(pendingDelete)}
        title="Удаление тепловой карты"
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          await deleteStandaloneHeatmap({ jobId: pendingDelete.jobId }).unwrap()
          setPendingDelete(null)
        }}
      />
    </Container>
  )
}
