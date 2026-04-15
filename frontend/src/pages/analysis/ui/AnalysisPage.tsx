import { useGetAnalysisJobStatusQuery } from "@entities/analysis/api"
import { AnalysisForm, type AnalysisRunResult } from "@features/analysisForm"
import { Alert, Card, Container, Progress, Stack, Text, Title } from "@mantine/core"
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
    const params = new URLSearchParams()
    params.set("runId", nextRunId)
    if (analysisDepth) {
      params.set("depth", String(analysisDepth))
    }
    navigate(`/analysis?${params.toString()}`, { replace: true })
  }, [analysisDepth, jobStatus?.result?.runId, jobStatus?.status, navigate])

  const handleRunSuccess = (result: AnalysisRunResult) => {
    const params = new URLSearchParams()
    params.set("jobId", result.response.jobId)
    if (result.request.depth) {
      params.set("depth", String(result.request.depth))
    }
    navigate(`/analysis?${params.toString()}`)
  }

  if (runId) {
    return (
      <Container size="xl">
        <Card>
          <AnalysisResultsWidget analysisDepth={analysisDepth} runId={runId} />
        </Card>
      </Container>
    )
  }

  return (
    <Container size="xl">
      <Stack>
        <Card>
          <Stack>
            <Title order={3}>Анализ студенческих работ</Title>
            <AnalysisForm onSuccess={handleRunSuccess} />
          </Stack>
        </Card>

        {jobId ? (
          <Card>
            <Stack gap="sm">
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
