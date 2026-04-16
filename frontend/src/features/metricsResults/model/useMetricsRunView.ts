import { useGetRunViewQuery } from "@entities/analysis/api"
import { useMemo } from "react"

type Params = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export const useMetricsRunView = ({ runId, analysisDepth, selectedLevels }: Params) => {
  const viewQuery = useGetRunViewQuery(
    {
      runId,
      kind: "metrics",
      depth: analysisDepth,
      selectedLevels
    },
    { skip: !runId }
  )

  const rows = useMemo(() => {
    if (viewQuery.data?.kind !== "metrics") {
      return []
    }
    return viewQuery.data.rows
  }, [viewQuery.data])

  const gitRows = useMemo(() => {
    if (viewQuery.data?.kind !== "metrics") {
      return []
    }
    return viewQuery.data.gitRows || []
  }, [viewQuery.data])

  const metrics = useMemo(() => {
    if (viewQuery.data?.kind !== "metrics") {
      return []
    }
    return viewQuery.data.metrics || []
  }, [viewQuery.data])

  return {
    isViewLoading: viewQuery.isLoading || viewQuery.isFetching,
    rows,
    gitRows,
    metrics
  }
}
