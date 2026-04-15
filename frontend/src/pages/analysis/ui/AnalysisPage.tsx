import {
  useGetAnalysisJobStatusQuery,
  useGetSavedResultsByRunIdQuery
} from "@entities/analysis/api"
import { AnalysisForm, type AnalysisRunResult } from "@features/analysisForm"
import { Alert, Card, Container, Loader, Progress, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { AnalysisResultsWidget } from "@widgets/analysisResults"
import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"

const getUserStageTitle = (
  status: string | null | undefined,
  stage: string | null | undefined
): string => {
  if (status === "queued") {
    return "Ожидаем запуск анализа"
  }
  if (status === "running") {
    if (!stage) {
      return "Готовим данные к проверке"
    }
    return stage
  }
  if (status === "success") {
    return "Анализ завершен"
  }
  if (status === "failed") {
    return "Ошибка анализа"
  }
  return "Подготовка к запуску"
}

export function AnalysisPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const runId = String(searchParams.get("runId") || "").trim()
  const jobId = String(searchParams.get("jobId") || "").trim()
  const rawDepth = Number(searchParams.get("depth") || "")
  const analysisDepth = Number.isFinite(rawDepth) && rawDepth > 0 ? rawDepth : undefined

  const { data: jobStatus } = useGetAnalysisJobStatusQuery(jobId, {
    skip: !jobId || Boolean(runId),
    pollingInterval: 5000
  })
  const runDetailsQuery = useGetSavedResultsByRunIdQuery(runId, {
    skip: !runId
  })

  const jobInProgress = jobStatus?.status === "queued" || jobStatus?.status === "running"
  const jobFailed = jobStatus?.status === "failed"

  useEffect(() => {
    if (jobStatus?.status !== "success") {
      return
    }
    const nextRunId = String(jobStatus?.result?.runId || "").trim()
    if (!nextRunId) {
      return
    }
    const nextPath = String(jobStatus?.result?.path || "").trim()
    const nextDirection = String(jobStatus?.result?.direction || "").trim()
    if (nextPath && nextDirection) {
      const params = new URLSearchParams()
      params.set("runId", nextRunId)
      params.set("direction", nextDirection)
      navigate(`${routes.archive}/${encodeURIComponent(nextPath)}?${params.toString()}`, {
        replace: true
      })
      return
    }

    const params = new URLSearchParams()
    params.set("runId", nextRunId)
    if (analysisDepth) {
      params.set("depth", String(analysisDepth))
    }
    navigate(`${routes.analysis}?${params.toString()}`, { replace: true })
  }, [
    analysisDepth,
    jobStatus?.result?.direction,
    jobStatus?.result?.path,
    jobStatus?.result?.runId,
    jobStatus?.status,
    navigate
  ])

  useEffect(() => {
    if (!runId) {
      return
    }
    const nextPath = String(runDetailsQuery.data?.path || "").trim()
    const nextDirection = String(runDetailsQuery.data?.direction || "").trim()
    if (!nextPath || !nextDirection) {
      return
    }
    const params = new URLSearchParams()
    params.set("runId", runId)
    params.set("direction", nextDirection)
    navigate(`${routes.archive}/${encodeURIComponent(nextPath)}?${params.toString()}`, {
      replace: true
    })
  }, [navigate, runDetailsQuery.data?.direction, runDetailsQuery.data?.path, runId])

  const handleRunSuccess = (result: AnalysisRunResult) => {
    const params = new URLSearchParams()
    params.set("jobId", result.response.jobId)
    if (result.request.depth) {
      params.set("depth", String(result.request.depth))
    }
    navigate(`/analysis?${params.toString()}`)
  }

  if (runId) {
    if (runDetailsQuery.isFetching || runDetailsQuery.isLoading) {
      return (
        <Container py="md" size="xl">
          <Card>
            <Stack align="center" gap="md" py="xl">
              <Loader size="sm" />
              <Text c="dimmed" size="sm">
                Подготавливаем переход к отчету...
              </Text>
            </Stack>
          </Card>
        </Container>
      )
    }

    return (
      <Container py="md" size="xl">
        <AnalysisResultsWidget analysisDepth={analysisDepth} runId={runId} />
      </Container>
    )
  }

  return (
    <Container py="md" size="xl">
      <Stack>
        <Card>
          <Stack>
            <Title order={3}>Анализ студенческих работ</Title>
            <AnalysisForm onSuccess={handleRunSuccess} />
          </Stack>
        </Card>

        {jobId ? (
          <Card>
            <Stack gap="md">
              <Title order={4}>Статус анализа</Title>
              <Text>Этап: {getUserStageTitle(jobStatus?.status, jobStatus?.stage)}</Text>
              <Progress value={jobStatus?.progressPercent ?? 0} />
              <Text c="dimmed" size="xs">
                {jobStatus?.progressPercent ?? 0}%
              </Text>
              {jobFailed ? (
                <Alert color="red">
                  {jobStatus?.errorMessage || "Не удалось завершить анализ. Попробуйте снова."}
                </Alert>
              ) : null}
            </Stack>
          </Card>
        ) : null}

        {jobInProgress ? (
          <Alert color="blue">
            Анализ выполняется в фоне. Страница обновляет статус автоматически.
          </Alert>
        ) : null}
      </Stack>
    </Container>
  )
}
