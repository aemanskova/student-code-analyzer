import type { Direction } from "@entities/analysis/api"
import { Stack } from "@mantine/core"
import { Info } from "@phosphor-icons/react"
import { InfoNotice } from "@shared/ui"
import { useEffect, useState } from "react"

import { useAnalysisLevels } from "../model/useAnalysisLevels"
import { AnalysisFiltersPanel } from "./components/AnalysisFiltersPanel"
import { ResultsTabs } from "./components/ResultsTabs"

type Props = {
  runId: string
  analysisDepth?: number
  direction?: Direction
}

export function AnalysisResultsWidget({ runId, analysisDepth, direction }: Props) {
  const [activeTab, setActiveTab] = useState<string | null>("metrics")
  const {
    cascadedOptions,
    changeLevel,
    commitLevelSelection,
    draftLevels,
    hasGitTab,
    isGitOptionsResolved,
    isOptionsResolved,
    levelOptions,
    optionsQuery,
    selectedLevels
  } = useAnalysisLevels({ analysisDepth, runId })

  useEffect(() => {
    if (activeTab === "git" && !hasGitTab) {
      setActiveTab("metrics")
    }
  }, [activeTab, hasGitTab])

  if (!runId) {
    return null
  }

  const isLoading = !isOptionsResolved || optionsQuery.isLoading || optionsQuery.isFetching
  const shouldShowNoGitNotice = isGitOptionsResolved && !hasGitTab
  const shouldShowFeatureNotice = shouldShowNoGitNotice
  const noticeText = "Для этого запуска Git-метрики не рассчитывались."

  return (
    <Stack gap="md">
      <AnalysisFiltersPanel
        cascadedOptions={cascadedOptions}
        direction={direction}
        draftLevels={draftLevels}
        isLoading={isLoading}
        isResolved={isOptionsResolved}
        levels={levelOptions}
        pathsCount={optionsQuery.data?.paths?.length || 0}
        selectedLevels={selectedLevels}
        onBlurLevel={commitLevelSelection}
        onChangeLevel={changeLevel}
      />

      {shouldShowFeatureNotice ? <InfoNotice icon={<Info size={16} />} text={noticeText} /> : null}

      <ResultsTabs
        activeTab={activeTab}
        analysisDepth={analysisDepth}
        direction={direction}
        hasGitTab={hasGitTab}
        runId={runId}
        selectedLevels={selectedLevels}
        onTabChange={setActiveTab}
      />
    </Stack>
  )
}
