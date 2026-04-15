import type { AnalysisListQuery, Direction } from "@entities/analysis/api"
import type { AnalysisListResponse } from "@entities/analysis/api"
import { useDeleteSavedRunMutation, useGetSavedAnalysisListQuery } from "@entities/analysis/api"
import { useDebouncedValue } from "@mantine/hooks"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { PAGE_SIZE } from "./constants"

const formatDateParam = (value: Date | null): string | undefined => {
  if (!value) {
    return undefined
  }
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const useArchiveList = () => {
  const form = useForm<{
    page: number
    pathFilter: string
    directionFilter: Direction | null
    dateFrom: Date | null
    dateTo: Date | null
  }>({
    defaultValues: {
      page: 1,
      pathFilter: "",
      directionFilter: null,
      dateFrom: null,
      dateTo: null
    }
  })
  const [pendingDeleteRun, setPendingDeleteRun] = useState<{ runId: string; path: string } | null>(
    null
  )
  const [deleteSavedRun, deleteSavedRunState] = useDeleteSavedRunMutation()

  const page = useWatch({ control: form.control, name: "page" }) || 1
  const pathFilter = useWatch({ control: form.control, name: "pathFilter" }) || ""
  const directionFilter = useWatch({ control: form.control, name: "directionFilter" }) || null
  const dateFrom = useWatch({ control: form.control, name: "dateFrom" }) || null
  const dateTo = useWatch({ control: form.control, name: "dateTo" }) || null

  const [debouncedPath] = useDebouncedValue(pathFilter, 250)
  const isPathDebouncing = pathFilter.trim() !== debouncedPath.trim()
  const filtersSignature = [
    debouncedPath.trim().toLowerCase(),
    directionFilter || "",
    formatDateParam(dateFrom) || "",
    formatDateParam(dateTo) || ""
  ].join("|")

  useEffect(() => {
    if (form.getValues("page") !== 1) {
      form.setValue("page", 1)
    }
  }, [filtersSignature, form])

  const queryParams: AnalysisListQuery = useMemo(
    () => ({
      page,
      size: PAGE_SIZE,
      path: debouncedPath.trim() || undefined,
      direction: directionFilter || undefined,
      dateFrom: formatDateParam(dateFrom),
      dateTo: formatDateParam(dateTo)
    }),
    [dateFrom, dateTo, debouncedPath, directionFilter, page]
  )

  const query = useGetSavedAnalysisListQuery(queryParams)
  const [stableData, setStableData] = useState<AnalysisListResponse | undefined>(undefined)

  useEffect(() => {
    if (query.data) {
      setStableData(query.data)
    }
  }, [query.data])

  const effectiveData = query.data || stableData
  const rows = effectiveData?.data || []
  const totalPages = Math.max(1, Math.ceil((effectiveData?.total || 0) / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      form.setValue("page", totalPages)
    }
  }, [form, page, totalPages])

  return {
    deleteModalOpened: Boolean(pendingDeleteRun),
    deleteRunPath: pendingDeleteRun?.path || "",
    isDeleting: deleteSavedRunState.isLoading,
    dateFrom,
    dateTo,
    directionFilter,
    isInitialLoading: (query.isLoading || query.isFetching) && !effectiveData,
    isUpdating: isPathDebouncing || (query.isFetching && Boolean(effectiveData)),
    page,
    pathFilter,
    rows,
    requestDeleteRun: (runId: string, path: string) => setPendingDeleteRun({ runId, path }),
    cancelDeleteRun: () => setPendingDeleteRun(null),
    confirmDeleteRun: async () => {
      if (!pendingDeleteRun) {
        return
      }
      await deleteSavedRun({ runId: pendingDeleteRun.runId }).unwrap()
      setPendingDeleteRun(null)
    },
    setDateFrom: (value: Date | null) => form.setValue("dateFrom", value),
    setDateTo: (value: Date | null) => form.setValue("dateTo", value),
    setDirectionFilter: (value: Direction | null) => form.setValue("directionFilter", value),
    setPage: (value: number) => form.setValue("page", value),
    setPathFilter: (value: string) => form.setValue("pathFilter", value),
    totalPages
  }
}
