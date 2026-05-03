import type { GitAnalysisRow } from "@entities/analysis/api"
import { downloadCsvFile } from "@shared/lib"
import { usePathFilter } from "@shared/lib/hooks/usePathFilter"
import { useCallback } from "react"

import { toGitCsv } from "./utils"

export const useGitResults = (rows: GitAnalysisRow[]) => {
  const { control, pathFilter, setPathFilter, filteredRows, hasRows, hasFilteredRows } =
    usePathFilter(rows, (row) => row.path)

  const downloadGitCsv = useCallback(() => {
    if (!filteredRows.length) {
      return
    }

    const csv = toGitCsv(filteredRows)
    downloadCsvFile(`analysis_git_${Date.now()}.csv`, csv)
  }, [filteredRows])

  return {
    control,
    pathFilter,
    setPathFilter,
    filteredRows,
    hasRows,
    hasFilteredRows,
    downloadGitCsv
  }
}
