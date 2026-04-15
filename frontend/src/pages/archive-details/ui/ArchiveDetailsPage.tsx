import { Container, Text } from "@mantine/core"
import { AnalysisResultsWidget } from "@widgets/analysisResults"
import { useSearchParams } from "react-router"

export function ArchiveDetailsPage() {
  const [searchParams] = useSearchParams()
  const runId = String(searchParams.get("runId") || "").trim()

  return (
    <Container py="md" size="xl">
      {runId ? (
        <AnalysisResultsWidget runId={runId} />
      ) : (
        <Text c="dimmed">Не передан runId для отображения результатов запуска.</Text>
      )}
    </Container>
  )
}
