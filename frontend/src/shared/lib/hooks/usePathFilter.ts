import { useDebouncedValue } from "@mantine/hooks"
import { useDeferredValue, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

type Accessor<T> = (row: T) => string | null | undefined

export const usePathFilter = <T>(rows: T[], accessor: Accessor<T>, delayMs = 180) => {
  const form = useForm<{ pathFilter: string }>({
    defaultValues: {
      pathFilter: ""
    }
  })
  const pathFilter = useWatch({ control: form.control, name: "pathFilter" }) || ""
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
    setPathFilter: (value: string) => form.setValue("pathFilter", value),
    filteredRows,
    hasRows: rows.length > 0,
    hasFilteredRows: filteredRows.length > 0
  }
}
