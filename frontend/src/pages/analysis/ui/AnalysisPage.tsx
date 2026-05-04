import {
  type Direction,
  useGetAnalysisJobStatusQuery,
  useGetSavedResultsByRunIdQuery
} from "@entities/analysis/api"
import { AnalysisForm, type AnalysisRunResult } from "@features/analysisForm"
import { Alert, Card, Container, Group, Loader, Progress, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { AnalysisResultsWidget } from "@widgets/analysisResults"
import { useCallback, useEffect } from "react"
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

const formatDuration = (seconds: number | null | undefined): string | null => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null
  }
  const safe = Math.floor(seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return minutes > 0 ? `${minutes} мин. ${rest.toString().padStart(2, "0")} сек.` : `${rest} сек.`
}

const parseDirection = (value: string | null): Direction | undefined =>
  value === "js" || value === "html_css" ? value : undefined

const parseBooleanParam = (value: string | null, fallback: boolean): boolean => {
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  return fallback
}

export function AnalysisPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const runId = String(searchParams.get("runId") || "").trim()
  const jobId = String(searchParams.get("jobId") || "").trim()
  const direction = parseDirection(searchParams.get("direction"))
  const rawDepth = Number(searchParams.get("depth") || "")
  const analysisDepth = Number.isFinite(rawDepth) && rawDepth > 0 ? rawDepth : undefined
  const includeGitMetrics = parseBooleanParam(searchParams.get("includeGitMetrics"), true)
  const recursive = parseBooleanParam(searchParams.get("recursive"), true)

  const { data: jobStatus, isLoading: isJobStatusLoading } = useGetAnalysisJobStatusQuery(jobId, {
    skip: !jobId || Boolean(runId),
    pollingInterval: 5000
  })
  const runDetailsQuery = useGetSavedResultsByRunIdQuery(runId, {
    skip: !runId
  })

  const jobInProgress =
    jobStatus?.status === "queued" ||
    jobStatus?.status === "running" ||
    Boolean(jobId && isJobStatusLoading)
  const jobFailed = jobStatus?.status === "failed"
  const handleFormQueryStateChange = useCallback(
    (values: {
      depth?: number
      direction: Direction | null
      includeGitMetrics: boolean
      recursive: boolean
    }) => {
      if (!values.direction) {
        return
      }
      const params = new URLSearchParams(searchParams)
      params.set("direction", values.direction)
      params.set("recursive", String(values.recursive))
      params.set("includeGitMetrics", String(values.includeGitMetrics))
      if (values.recursive && values.depth) {
        params.set("depth", String(values.depth))
      } else {
        params.delete("depth")
      }

      const nextSearch = params.toString()
      if (nextSearch !== searchParams.toString()) {
        navigate(`${routes.analysis}?${nextSearch}`, { replace: true })
      }
    },
    [navigate, searchParams]
  )

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
      if (analysisDepth) {
        params.set("depth", String(analysisDepth))
      }
      params.set("recursive", String(recursive))
      params.set("includeGitMetrics", String(includeGitMetrics))
      navigate(`${routes.archive}/${encodeURIComponent(nextPath)}?${params.toString()}`, {
        replace: true
      })
      return
    }

    const params = new URLSearchParams()
    params.set("runId", nextRunId)
    if (direction) {
      params.set("direction", direction)
    }
    if (analysisDepth) {
      params.set("depth", String(analysisDepth))
    }
    params.set("recursive", String(recursive))
    params.set("includeGitMetrics", String(includeGitMetrics))
    navigate(`${routes.analysis}?${params.toString()}`, { replace: true })
  }, [
    analysisDepth,
    direction,
    includeGitMetrics,
    recursive,
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
    if (analysisDepth) {
      params.set("depth", String(analysisDepth))
    }
    params.set("recursive", String(recursive))
    params.set("includeGitMetrics", String(includeGitMetrics))
    navigate(`${routes.archive}/${encodeURIComponent(nextPath)}?${params.toString()}`, {
      replace: true
    })
  }, [
    analysisDepth,
    includeGitMetrics,
    recursive,
    navigate,
    runDetailsQuery.data?.direction,
    runDetailsQuery.data?.path,
    runId
  ])

  const handleRunSuccess = (result: AnalysisRunResult) => {
    const params = new URLSearchParams()
    params.set("jobId", result.response.jobId)
    params.set("direction", result.request.direction)
    if (result.request.depth) {
      params.set("depth", String(result.request.depth))
    }
    params.set("recursive", String(Boolean(result.request.r)))
    params.set("includeGitMetrics", String(Boolean(result.request.includeGitMetrics)))
    navigate(`${routes.analysis}?${params.toString()}`)
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
        <AnalysisResultsWidget analysisDepth={analysisDepth} direction={direction} runId={runId} />
      </Container>
    )
  }

  return (
    <Container py="md" size="xl">
      <Stack>
        <Card>
          <Stack>
            <Title order={3}>Анализ студенческих работ</Title>
            <AnalysisForm
              initialValues={{
                depth: analysisDepth,
                direction,
                includeGitMetrics,
                recursive
              }}
              locked={jobInProgress}
              restoredArchiveName={jobStatus?.archiveName || undefined}
              onQueryStateChange={handleFormQueryStateChange}
              onSuccess={handleRunSuccess}
            />
          </Stack>
        </Card>

        {jobId ? (
          <Card>
            <Stack gap="md">
              <Title order={4}>Статус анализа</Title>
              <Group justify="space-between" align="baseline">
                <Text fw={500}>
                  {isJobStatusLoading
                    ? "Получаем статус анализа"
                    : getUserStageTitle(jobStatus?.status, jobStatus?.stage)}
                </Text>
                <Text c="dimmed" size="sm">
                  {jobStatus?.progressPercent ?? 0}%
                </Text>
              </Group>
              {jobStatus?.archiveName ? (
                <Text c="dimmed" size="sm">
                  Архив: {jobStatus.archiveName}
                </Text>
              ) : jobId && isJobStatusLoading ? (
                <Text c="dimmed" size="sm">
                  Архив: загружаем сведения...
                </Text>
              ) : null}
              <Progress value={jobStatus?.progressPercent ?? 0} />
              <Text c="dimmed" size="xs">
                {[
                  formatDuration(jobStatus?.elapsedSeconds)
                    ? `прошло ${formatDuration(jobStatus?.elapsedSeconds)}`
                    : null
                ]
                  .filter(Boolean)
                  .join(" · ") || "Статус обновляется автоматически."}
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
