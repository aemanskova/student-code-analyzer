import { Container, Text } from "@mantine/core"
import { AnalysisResultsWidget } from "@widgets/analysisResults"
import { useParams, useSearchParams } from "react-router"

export function ArchiveDetailsPage() {
  const { encodedPath = "" } = useParams()
  const [searchParams] = useSearchParams()
  const queryRunId = String(searchParams.get("runId") || "").trim()
  const runId = queryRunId || decodeURIComponent(encodedPath).trim()

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
