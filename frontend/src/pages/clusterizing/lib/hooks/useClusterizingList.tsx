import { type ClusterizationListItem, formatClusterDate } from "@entities/clusterizing"
import { Anchor } from "@mantine/core"
import { useDebouncedValue } from "@mantine/hooks"
import { routes } from "@shared/config/routes"
import type { VirtualizedColumn } from "@shared/ui"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { NavLink } from "react-router"

export const CLUSTERIZING_LIST_PAGE_SIZE = 8
export const CLUSTERIZING_DIRECTION_OPTIONS = [{ label: "HTML/CSS", value: "html_css" }]

export type ClusterizingListFiltersForm = {
  dateFrom: Date | null
  dateTo: Date | null
  directionFilter: "html_css" | null
  page: number
  pathFilter: string
}

export const useClusterizingList = (rows: ClusterizationListItem[]) => {
  const form = useForm<ClusterizingListFiltersForm>({
    defaultValues: {
      dateFrom: null,
      dateTo: null,
      directionFilter: null,
      page: 1,
      pathFilter: ""
    }
  })
  const page = useWatch({ control: form.control, name: "page" }) || 1
  const pathFilter = useWatch({ control: form.control, name: "pathFilter" }) || ""
  const directionFilter = useWatch({ control: form.control, name: "directionFilter" }) || null
  const dateFrom = useWatch({ control: form.control, name: "dateFrom" }) || null
  const dateTo = useWatch({ control: form.control, name: "dateTo" }) || null
  const [debouncedPath] = useDebouncedValue(pathFilter, 250)
  const filteredRows = useMemo(() => {
    const normalizedPath = debouncedPath.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : null
    const toTime = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : null

    return rows.filter((row) => {
      const rowPath = `${row.sourcePath || ""} ${row.runId}`.toLowerCase()
      const finishedAtTime = new Date(row.finishedAt).getTime()
      return (
        (!normalizedPath || rowPath.includes(normalizedPath)) &&
        (!directionFilter || row.direction === directionFilter) &&
        (fromTime === null || finishedAtTime >= fromTime) &&
        (toTime === null || finishedAtTime <= toTime)
      )
    })
  }, [dateFrom, dateTo, debouncedPath, directionFilter, rows])
  const filterSignature = [
    debouncedPath.trim().toLowerCase(),
    directionFilter || "",
    dateFrom?.toISOString() || "",
    dateTo?.toISOString() || ""
  ].join("|")
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / CLUSTERIZING_LIST_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (form.getValues("page") !== 1) {
      form.setValue("page", 1)
    }
  }, [filterSignature, form])

  useEffect(() => {
    if (page > totalPages) {
      form.setValue("page", totalPages)
    }
  }, [form, page, totalPages])

  const pageRows = useMemo(
    () =>
      filteredRows.slice(
        (safePage - 1) * CLUSTERIZING_LIST_PAGE_SIZE,
        safePage * CLUSTERIZING_LIST_PAGE_SIZE
      ),
    [filteredRows, safePage]
  )
  const columns = useMemo<Array<VirtualizedColumn<ClusterizationListItem>>>(
    () => [
      {
        key: "sourcePath",
        minWidth: 360,
        render: (row) => (
          <Anchor
            c="myColor.6"
            component={NavLink}
            style={{ display: "inline-block", whiteSpace: "nowrap" }}
            to={routes.clusterizingDetails(row.jobId)}
          >
            {row.sourcePath || row.runId}
          </Anchor>
        ),
        title: "Папка анализа"
      },
      { key: "direction", minWidth: 160, render: (row) => row.direction, title: "Направление" },
      {
        key: "clustersCount",
        minWidth: 120,
        render: (row) => row.clustersCount,
        title: "Кластеров"
      },
      { key: "rows", minWidth: 140, render: (row) => row.rowsUsed, title: "Работ" },
      {
        key: "finishedAt",
        minWidth: 220,
        render: (row) => formatClusterDate(row.finishedAt),
        title: "Выполнено"
      }
    ],
    []
  )

  return { columns, filteredRows, form, pageRows, safePage, totalPages }
}
