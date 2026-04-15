import { useDebouncedValue } from "@mantine/hooks"
import { useDeferredValue, useMemo, useState } from "react"

type Accessor<T> = (row: T) => string | null | undefined

export const usePathFilter = <T>(rows: T[], accessor: Accessor<T>, delayMs = 180) => {
  const [pathFilter, setPathFilter] = useState("")
  const [debouncedFilter] = useDebouncedValue(pathFilter, delayMs)
  const deferredFilter = useDeferredValue(debouncedFilter)

  const normalizedFilter = deferredFilter.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedFilter) {
      return rows
    }

    return rows.filter((row) =>
      String(accessor(row) || "")
        .toLowerCase()
        .includes(normalizedFilter)
    )
  }, [rows, accessor, normalizedFilter])

  return {
    pathFilter,
    setPathFilter,
    filteredRows,
    hasRows: rows.length > 0,
    hasFilteredRows: filteredRows.length > 0
  }
}
