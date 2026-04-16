import type { PlagiarismHeatmapData } from "@entities/analysis/api"
import {
  useBuildRunHeatmapAsyncMutation,
  useGetAnalysisJobStatusQuery,
  useGetRunHeatmapHistoryQuery,
  useGetRunViewQuery
} from "@entities/analysis/api"
import { getApiErrorMessage } from "@shared/lib"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

type Params = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

export type HeatmapArchiveItem = {
  id: string
  createdAt: string | null
  depth: number | null
  selectedLevels: string[][]
  folderCount: number | null
  heatmap: PlagiarismHeatmapData
}

const inferDepthFromLevels = (selectedLevels: string[][]): number | undefined => {
  let maxSelectedLevel = -1
  selectedLevels.forEach((values, index) => {
    if ((values || []).some((value) => String(value || "").trim().length > 0)) {
      maxSelectedLevel = index
    }
  })
  return maxSelectedLevel >= 0 ? maxSelectedLevel + 1 : undefined
}

const getHeatmapSignature = (heatmap: PlagiarismHeatmapData): string => {
  const first = heatmap.labels[0] || ""
  const last = heatmap.labels[heatmap.labels.length - 1] || ""
  return `${heatmap.generatedAt}|${heatmap.labels.length}|${first}|${last}`
}

export const HEATMAP_MAX_WORKS = 100

export const usePlagiarismRunView = ({ runId, analysisDepth, selectedLevels }: Params) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [buildRunHeatmapAsync, { isLoading: isStartingBuild }] = useBuildRunHeatmapAsyncMutation()
  const [buildError, setBuildError] = useState<string | null>(null)
  const [currentHeatmap, setCurrentHeatmap] = useState<PlagiarismHeatmapData | null>(null)
  const [localArchive, setLocalArchive] = useState<HeatmapArchiveItem[]>([])
  const [hideCurrentWhileBuilding, setHideCurrentWhileBuilding] = useState(false)
  const buildJobId = String(searchParams.get("heatmapJobId") || "").trim()

  const viewQuery = useGetRunViewQuery(
    {
      runId,
      kind: "metrics",
      depth: analysisDepth,
      selectedLevels
    },
    { skip: !runId }
  )

  const buildJobStatusQuery = useGetAnalysisJobStatusQuery(buildJobId, {
    skip: !buildJobId,
    pollingInterval: 5000
  })
  const historyQuery = useGetRunHeatmapHistoryQuery(
    { runId },
    {
      skip: !runId,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true
    }
  )

  useEffect(() => {
    setBuildError(null)
    setHideCurrentWhileBuilding(false)
    setLocalArchive([])
    setCurrentHeatmap(null)
    if (runId) {
      void historyQuery.refetch()
    }
  }, [historyQuery.refetch, runId])

  const setHeatmapJobId = useCallback(
    (jobId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const normalized = String(jobId || "").trim()
          if (normalized) {
            next.set("heatmapJobId", normalized)
          } else {
            next.delete("heatmapJobId")
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    const status = buildJobStatusQuery.data?.status
    if (!status) {
      return
    }

    if (status === "success") {
      const payload = buildJobStatusQuery.data?.result
      const resultHeatmap = (payload?.plagiarismHeatmap || null) as PlagiarismHeatmapData | null
      if (resultHeatmap) {
        setCurrentHeatmap(resultHeatmap)
      }
      if (!resultHeatmap) {
        setBuildError(
          "Сервер завершил задачу без данных карты. Проверьте фильтры и попробуйте запустить построение снова."
        )
      }

      setHideCurrentWhileBuilding(false)
      setHeatmapJobId("")
      void historyQuery.refetch()
      return
    }

    if (status === "failed") {
      setBuildError(
        buildJobStatusQuery.data?.errorMessage || "Не удалось построить тепловую карту."
      )
      setHideCurrentWhileBuilding(false)
      setHeatmapJobId("")
      void historyQuery.refetch()
    }
  }, [
    buildJobStatusQuery.data?.errorMessage,
    buildJobStatusQuery.data?.result,
    buildJobStatusQuery.data?.status,
    historyQuery.refetch,
    setHeatmapJobId
  ])

  const filteredFolderCount = useMemo(() => {
    if (viewQuery.data?.kind !== "metrics") {
      return 0
    }
    return new Set(
      (viewQuery.data.rows || []).map((row) => String(row.path || "").trim()).filter(Boolean)
    ).size
  }, [viewQuery.data])

  const canBuild = filteredFolderCount >= 2 && filteredFolderCount <= HEATMAP_MAX_WORKS
  const isBuildingHeatmap = isStartingBuild || Boolean(buildJobId)
  const inferredDepth = inferDepthFromLevels(selectedLevels)

  const historyArchive = useMemo<HeatmapArchiveItem[]>(() => {
    return (historyQuery.data?.data || []).map((item) => ({
      id: `server:${item.jobId}`,
      createdAt: item.createdAt || null,
      depth: item.depth,
      selectedLevels: item.selectedLevels || [],
      folderCount: item.folderCount,
      heatmap: item.plagiarismHeatmap
    }))
  }, [historyQuery.data?.data])

  const heatmapArchive = useMemo<HeatmapArchiveItem[]>(() => {
    const seen = new Set<string>()
    const merged = [...localArchive, ...historyArchive]
    const result: HeatmapArchiveItem[] = []

    for (const item of merged) {
      const signature = getHeatmapSignature(item.heatmap)
      if (seen.has(signature)) {
        continue
      }
      seen.add(signature)
      result.push(item)
    }

    return result
  }, [historyArchive, localArchive])

  const heatmap = hideCurrentWhileBuilding ? null : currentHeatmap

  const startBuildHeatmap = useCallback(async () => {
    if (!runId) {
      return
    }
    if (buildJobId || isStartingBuild) {
      return
    }
    if (filteredFolderCount > HEATMAP_MAX_WORKS) {
      setBuildError(
        `Слишком много работ для карты. Выберите корректные фильтры (не более ${HEATMAP_MAX_WORKS}).`
      )
      return
    }
    if (filteredFolderCount < 2) {
      setBuildError("Недостаточно работ для карты. Выберите минимум две папки с кодом.")
      return
    }
    setBuildError(null)

    if (currentHeatmap) {
      const previousMap = currentHeatmap
      setLocalArchive((prev) => [
        {
          id: `local:${Date.now()}:${Math.random().toString(36).slice(2)}`,
          createdAt: new Date().toISOString(),
          depth: inferredDepth || analysisDepth || null,
          selectedLevels: selectedLevels.map((levelValues) => [...(levelValues || [])]),
          folderCount: filteredFolderCount,
          heatmap: previousMap
        },
        ...prev
      ])
      setHideCurrentWhileBuilding(true)
    }

    try {
      const response = await buildRunHeatmapAsync({
        runId,
        // Heatmap worker expects exact folder depth, so selected filters depth has priority.
        depth: inferredDepth || analysisDepth,
        selectedLevels
      }).unwrap()
      const nextJobId = String(response.jobId || "").trim()
      setHeatmapJobId(nextJobId)
    } catch (error) {
      setBuildError(
        getApiErrorMessage(error, "Не удалось построить тепловую карту для выбранного среза.")
      )
      setHideCurrentWhileBuilding(false)
    }
  }, [
    analysisDepth,
    buildJobId,
    buildRunHeatmapAsync,
    currentHeatmap,
    filteredFolderCount,
    inferredDepth,
    isStartingBuild,
    runId,
    selectedLevels,
    setHeatmapJobId
  ])

  return {
    buildError,
    buildJobStatus: buildJobStatusQuery.data || null,
    canBuild,
    filteredFolderCount,
    heatmap,
    heatmapArchive,
    isHistoryLoading: historyQuery.isLoading || historyQuery.isFetching,
    isBuildingHeatmap,
    isViewLoading: viewQuery.isLoading && !viewQuery.data,
    startBuildHeatmap
  }
}
