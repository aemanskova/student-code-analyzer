import { AnalysisCharts, AnalysisTable } from "@entities/analysis"
import type { Direction } from "@entities/analysis/api"
import { useGetSavedResultsQuery } from "@entities/analysis/api"
import { Card, Container, Stack, Title } from "@mantine/core"
import { useMemo } from "react"
import { useParams, useSearchParams } from "react-router"

export function ArchiveDetailsPage() {
  const params = useParams<{ encodedPath: string }>()
  const [searchParams] = useSearchParams()
  const direction = (searchParams.get("direction") || "html_css") as Direction
  const pathValue = decodeURIComponent(params.encodedPath || "")

  const { data } = useGetSavedResultsQuery({ direction, path: pathValue }, { skip: !pathValue })

  const latestRunRows = useMemo(() => {
    const rows = data?.data || []
    if (rows.length === 0) {
      return []
    }
    const runId = rows[0].runId
    return rows.filter((row) => row.runId === runId)
  }, [data])

  const metrics = useMemo(() => {
    if (latestRunRows.length === 0) {
      return []
    }
    return Object.keys(latestRunRows[0]).filter(
      (key) => !["runId", "createdAt", "path", "group", "student"].includes(key)
    )
  }, [latestRunRows])

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Card p="lg">
          <Title order={3}>Архив: {pathValue}</Title>
        </Card>
        <Card p="lg">
          <Stack>
            <AnalysisCharts rows={latestRunRows} />
            <AnalysisTable metrics={metrics} rows={latestRunRows} />
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
