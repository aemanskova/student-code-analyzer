import { useGetRunFilterOptionsQuery } from "@entities/analysis/api"
import { useEffect, useMemo, useRef, useState } from "react"

type Params = {
  runId: string
  analysisDepth?: number
}

export const useAnalysisLevels = ({ runId, analysisDepth }: Params) => {
  const [selectedLevels, setSelectedLevels] = useState<string[][]>([])
  const [draftLevels, setDraftLevels] = useState<string[][]>([])
  const draftLevelsRef = useRef<string[][]>([])

  const optionsQuery = useGetRunFilterOptionsQuery(
    { runId, kind: "metrics", depth: analysisDepth },
    { skip: !runId }
  )

  const gitOptionsQuery = useGetRunFilterOptionsQuery(
    { runId, kind: "git", depth: analysisDepth },
    { skip: !runId }
  )

  const isOptionsResolved = optionsQuery.isSuccess || optionsQuery.isError
  const isGitOptionsResolved = gitOptionsQuery.isSuccess || gitOptionsQuery.isError
  const hasGitTab = isGitOptionsResolved && Boolean((gitOptionsQuery.data?.levels || []).length)
  const levelOptions = useMemo(() => optionsQuery.data?.levels || [], [optionsQuery.data?.levels])

  const allSegments = useMemo(
    () =>
      (optionsQuery.data?.paths || [])
        .map((pathValue) =>
          String(pathValue || "")
            .split("/")
            .map((segment) => segment.trim())
            .filter(Boolean)
        )
        .filter((segments) => segments.length > 0),
    [optionsQuery.data?.paths]
  )

  const cascadedOptions = useMemo(() => {
    const result: string[][] = []
    for (let level = 0; level < levelOptions.length; level += 1) {
      const options = Array.from(
        new Set(
          allSegments
            .filter((segments) =>
              draftLevels
                .slice(0, level)
                .every((values, i) => !values?.length || values.includes(segments[i] || ""))
            )
            .map((segments) => segments[level])
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
      result[level] = options
    }
    return result
  }, [allSegments, draftLevels, levelOptions.length])

  useEffect(() => {
    const initial = optionsQuery.data?.selectedLevels || []
    setSelectedLevels(initial)
    setDraftLevels(initial)
    draftLevelsRef.current = initial
  }, [optionsQuery.data?.selectedLevels])

  useEffect(() => {
    if (!levelOptions.length) {
      return
    }
    const defaultLevel1 = levelOptions[0]?.options?.[0]
    if (!defaultLevel1) {
      return
    }

    setSelectedLevels((prev) => {
      if (prev[0]?.length) {
        return prev
      }
      const next = [...prev]
      next[0] = [defaultLevel1]
      return next
    })

    setDraftLevels((prev) => {
      if (prev[0]?.length) {
        return prev
      }
      const next = [...prev]
      next[0] = [defaultLevel1]
      draftLevelsRef.current = next
      return next
    })
  }, [levelOptions])

  const commitLevelSelection = (index: number) => {
    setSelectedLevels((prev) => {
      const next = prev.slice(0, index + 1)
      next[index] = draftLevelsRef.current[index] || []
      return next
    })
  }

  const clearLowerCommittedLevels = (index: number) => {
    setSelectedLevels((prev) => {
      if (prev.length <= index + 1) {
        return prev
      }
      const next = prev.slice(0, index + 1)
      next[index] = prev[index] || []
      return next
    })
  }

  const changeLevel = (index: number, values: string[]) => {
    const previousValues = draftLevelsRef.current[index] || []
    const hasRemoved = previousValues.some((item) => !values.includes(item))
    const nextDraft = draftLevelsRef.current.slice(0, index + 1)
    nextDraft[index] = values
    draftLevelsRef.current = nextDraft
    setDraftLevels(nextDraft)

    clearLowerCommittedLevels(index)

    if (hasRemoved) {
      setSelectedLevels((prev) => {
        const next = prev.slice(0, index + 1)
        next[index] = values
        return next
      })
    }
  }

  return {
    cascadedOptions,
    changeLevel,
    commitLevelSelection,
    draftLevels,
    gitOptionsQuery,
    isGitOptionsResolved,
    isOptionsResolved,
    hasGitTab,
    levelOptions,
    optionsQuery,
    selectedLevels
  }
}
