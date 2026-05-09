import type { Direction } from "@entities/analysis/api"
import { Container, Text } from "@mantine/core"
import { AnalysisResultsWidget } from "@widgets/analysisResults"
import { useParams, useSearchParams } from "react-router"

const parseDirection = (value: string | null): Direction | undefined =>
  value === "js" || value === "html_css" || value === "typescript" ? value : undefined

export function ArchiveDetailsPage() {
  const { encodedPath = "" } = useParams()
  const [searchParams] = useSearchParams()
  const queryRunId = String(searchParams.get("runId") || "").trim()
  const runId = queryRunId || decodeURIComponent(encodedPath).trim()
  const direction = parseDirection(searchParams.get("direction"))

  return (
    <Container py="md" size="xl">
      {runId ? (
        <AnalysisResultsWidget direction={direction} runId={runId} />
      ) : (
        <Text c="dimmed">Не передан runId для отображения результатов запуска.</Text>
      )}
    </Container>
  )
}
