import type { GitAnalysisRow } from "@entities/analysis/api"
import { useGetRunViewQuery } from "@entities/analysis/api"
import { useMemo } from "react"

type Params = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export const useGitRunView = ({ runId, analysisDepth, selectedLevels }: Params) => {
  const viewQuery = useGetRunViewQuery(
    {
      runId,
      kind: "git",
      depth: analysisDepth,
      selectedLevels
    },
    { skip: !runId }
  )

  const rows = useMemo(() => {
    if (viewQuery.data?.kind !== "git") {
      return [] as GitAnalysisRow[]
    }
    return viewQuery.data.rows || []
  }, [viewQuery.data])

  return {
    isViewLoading: viewQuery.isLoading || viewQuery.isFetching,
    rows
  }
}
