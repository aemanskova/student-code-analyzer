import { GitResultsSection } from "@features/gitResults"
import { MetricsResultsSection } from "@features/metricsResults"
import { Tabs } from "@mantine/core"
import { GitBranch, ShieldCheck } from "@phosphor-icons/react"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
  hasGitTab: boolean
  activeTab: string | null
  onTabChange: (value: string | null) => void
}

export const ResultsTabs = ({
  runId,
  analysisDepth,
  selectedLevels,
  hasGitTab,
  activeTab,
  onTabChange
}: Props) => (
  <Tabs keepMounted={false} value={activeTab} onChange={onTabChange}>
    <Tabs.List>
      <Tabs.Tab leftSection={<ShieldCheck size={16} />} value="metrics">
        Качество и доступность
      </Tabs.Tab>
      {hasGitTab ? (
        <Tabs.Tab leftSection={<GitBranch size={16} />} value="git">
          История разработки (Git)
        </Tabs.Tab>
      ) : null}
    </Tabs.List>

    <Tabs.Panel pt="md" value="metrics">
      <MetricsResultsSection
        analysisDepth={analysisDepth}
        runId={runId}
        selectedLevels={selectedLevels}
      />
    </Tabs.Panel>

    {hasGitTab ? (
      <Tabs.Panel pt="md" value="git">
        <GitResultsSection
          analysisDepth={analysisDepth}
          runId={runId}
          selectedLevels={selectedLevels}
        />
      </Tabs.Panel>
    ) : null}
  </Tabs>
)
