import { useGetRunFilterOptionsQuery } from "@entities/analysis/api"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

type Params = {
  runId: string
  analysisDepth?: number
}

type LevelsFormValues = {
  selectedLevels: string[][]
  draftLevels: string[][]
}

const getNormalizedLevels = (value: string[][] | undefined): string[][] =>
  Array.isArray(value) ? value.map((items) => (Array.isArray(items) ? [...items] : [])) : []

export const useAnalysisLevels = ({ runId, analysisDepth }: Params) => {
  const form = useForm<LevelsFormValues>({
    defaultValues: {
      selectedLevels: [],
      draftLevels: []
    }
  })

  const selectedLevelsWatch = useWatch({ control: form.control, name: "selectedLevels" })
  const draftLevelsWatch = useWatch({ control: form.control, name: "draftLevels" })
  const selectedLevels = useMemo(
    () => getNormalizedLevels(selectedLevelsWatch),
    [selectedLevelsWatch]
  )
  const draftLevels = useMemo(() => getNormalizedLevels(draftLevelsWatch), [draftLevelsWatch])

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
    const initial = getNormalizedLevels(optionsQuery.data?.selectedLevels)
    form.reset({
      selectedLevels: initial,
      draftLevels: initial
    })
  }, [form, optionsQuery.data?.selectedLevels])

  useEffect(() => {
    if (!levelOptions.length) {
      return
    }
    const defaultLevel1 = levelOptions[0]?.options?.[0]
    if (!defaultLevel1 || selectedLevels[0]?.length) {
      return
    }

    const nextSelected = getNormalizedLevels(selectedLevels)
    const nextDraft = getNormalizedLevels(draftLevels)
    nextSelected[0] = [defaultLevel1]
    nextDraft[0] = [defaultLevel1]

    form.setValue("selectedLevels", nextSelected)
    form.setValue("draftLevels", nextDraft)
  }, [draftLevels, form, levelOptions, selectedLevels])

  const commitLevelSelection = (index: number) => {
    const next = getNormalizedLevels(selectedLevels).slice(0, index + 1)
    next[index] = draftLevels[index] || []
    form.setValue("selectedLevels", next)
  }

  const clearLowerCommittedLevels = (index: number) => {
    if (selectedLevels.length <= index + 1) {
      return
    }
    const next = getNormalizedLevels(selectedLevels).slice(0, index + 1)
    next[index] = selectedLevels[index] || []
    form.setValue("selectedLevels", next)
  }

  const changeLevel = (index: number, values: string[]) => {
    const previousValues = draftLevels[index] || []
    const hasRemoved = previousValues.some((item) => !values.includes(item))

    const nextDraft = getNormalizedLevels(draftLevels).slice(0, index + 1)
    nextDraft[index] = values
    form.setValue("draftLevels", nextDraft)

    clearLowerCommittedLevels(index)

    if (hasRemoved) {
      const nextSelected = getNormalizedLevels(selectedLevels).slice(0, index + 1)
      nextSelected[index] = values
      form.setValue("selectedLevels", nextSelected)
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
