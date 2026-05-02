import {
  useBuildStandaloneHeatmapAsyncMutation,
  useGetAnalysisJobStatusQuery,
  useValidateHeatmapUploadMutation
} from "@entities/analysis/api"
import { ArchiveUploadStep, type UploadedArchiveInfo } from "@features/archiveUpload"
import {
  Alert,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title
} from "@mantine/core"
import { InfoNotice } from "@shared/ui"
import { routes } from "@shared/config/routes"
import { getApiErrorMessage } from "@shared/lib"
import { WarningCircle } from "@phosphor-icons/react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"

const HEATMAP_FIXED_DEPTH = 2
const HEATMAP_MAX_WORKS = 100
const HEATMAP_MAX_ARCHIVE_MB = 5000

export function HeatmapBuildPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [archive, setArchive] = useState<UploadedArchiveInfo | null>(null)
  const buildJobId = String(searchParams.get("jobId") || "").trim()
  const [error, setError] = useState<string | null>(null)
  const [validationInfo, setValidationInfo] = useState<{
    folderCount: number | null
    maxAllowed: number
    allowed: boolean
    archiveTooLarge?: boolean
    message: string | null
  } | null>(null)

  const [validateUpload, { isLoading: isValidating }] = useValidateHeatmapUploadMutation()
  const [buildHeatmap, { isLoading: isStarting }] = useBuildStandaloneHeatmapAsyncMutation()
  const jobStatusQuery = useGetAnalysisJobStatusQuery(buildJobId, {
    skip: !buildJobId,
    pollingInterval: 5000
  })
  const jobStatus = jobStatusQuery.data
  const jobStatusLoading = Boolean(
    buildJobId && !jobStatusQuery.isError && (jobStatusQuery.isLoading || !jobStatus)
  )
  const inProgress =
    jobStatus?.status === "queued" ||
    jobStatus?.status === "running" ||
    isStarting ||
    jobStatusLoading
  const buildStarted = Boolean(buildJobId) || isStarting

  const clearBuildJobParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("jobId")
        return next
      },
      { replace: true }
    )
  }, [setSearchParams])

  useEffect(() => {
    if (jobStatus?.status === "success") {
      navigate(routes.heatmapDetails(jobStatus.jobId, jobStatus.result?.path || undefined), {
        replace: true
      })
    }
    if (jobStatus?.status === "failed") {
      setError(jobStatus.errorMessage || "Не удалось построить тепловую карту.")
    }
  }, [jobStatus, navigate])

  const validateArchive = useCallback(async () => {
    if (!archive) {
      setValidationInfo(null)
      return null
    }

    setValidationInfo(null)
    const validation = await validateUpload({
      key: archive.key,
      r: true,
      depth: HEATMAP_FIXED_DEPTH
    }).unwrap()
    setValidationInfo(validation)
    return validation
  }, [archive, validateUpload])

  useEffect(() => {
    if (!archive || buildStarted) {
      return
    }

    let mounted = true
    void validateArchive()
      .then((validation) => {
        if (!mounted || !validation) {
          return
        }
        if (validation.allowed) {
          setError(null)
        }
      })
      .catch((caught) => {
        if (!mounted) {
          return
        }
        setValidationInfo(null)
        setError(getApiErrorMessage(caught, "Не удалось проверить размер архива."))
      })

    return () => {
      mounted = false
    }
  }, [archive, buildStarted, validateArchive])

  const handleStart = async () => {
    if (!archive) {
      return
    }

    setError(null)
    try {
      if (isValidating) {
        setError("Дождитесь завершения проверки архива.")
        return
      }
      if (!validationInfo) {
        setError("Не удалось получить результат проверки архива. Повторите попытку.")
        return
      }
      if (!validationInfo.allowed) {
        return
      }
      const response = await buildHeatmap({
        key: archive.key,
        originalName: archive.fileName,
        r: true,
        depth: HEATMAP_FIXED_DEPTH
      }).unwrap()
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("jobId", response.jobId)
        return next
      })
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Не удалось запустить построение тепловой карты."))
    }
  }

  const buildDisabled =
    !archive || inProgress || isValidating || Boolean(validationInfo && !validationInfo.allowed)
  const isArchiveTooLarge = Boolean(validationInfo?.archiveTooLarge)
  const archiveLocked = inProgress
  const activeArchiveName = jobStatus?.archiveName || archive?.fileName || ""

  return (
    <Container py="md" size="lg">
      <Stack gap="md">
        <Card>
          <Stack gap="md">
            <Title order={3}>Построить тепловую карту</Title>
            <Text c="dimmed" size="sm">
              Загрузите ZIP-архив с работами. Тепловая карта всегда строится на глубине 2: для всех
              папок внутри загруженного архива, без рекурсивного обхода по внутренним папкам.
            </Text>
            <Text c="dimmed" size="sm">
              Для тепловой карты допускается не больше {HEATMAP_MAX_WORKS} папок с кодом в выбранном
              срезе.
            </Text>
            <Text c="dimmed" size="sm">
              Максимальный размер архива для построения тепловой карты: {HEATMAP_MAX_ARCHIVE_MB} MB.
            </Text>
            <FileInput
              accept=".zip,application/zip"
              disabled={archiveLocked}
              label="Архив"
              placeholder={activeArchiveName || "Выберите ZIP"}
              value={file}
              onChange={(nextFile) => {
                if (archiveLocked) {
                  return
                }
                setFile(nextFile)
                setArchive(null)
                setError(null)
                setValidationInfo(null)
                clearBuildJobParam()
              }}
            />
            <ArchiveUploadStep
              disabled={archiveLocked}
              file={file}
              restoredArchiveName={activeArchiveName}
              onUploaded={(uploaded) => {
                setArchive(uploaded)
                if (!buildStarted) {
                  setError(null)
                  setValidationInfo(null)
                }
              }}
            />

            {archiveLocked ? (
              <Alert color="blue">
                Построение выполняется в фоне. ZIP-архив нельзя заменить до завершения задачи.
                Прогресс сохранен в ссылке, страницу можно обновить.
              </Alert>
            ) : null}

            {activeArchiveName ? (
              <Text c="dimmed" size="sm">
                Архив: {activeArchiveName}
              </Text>
            ) : buildJobId && jobStatusLoading ? (
              <Text c="dimmed" size="sm">
                Архив: загружаем сведения...
              </Text>
            ) : null}

            {isValidating && archive && !buildJobId ? (
              <Group py={4}>
                <Loader size="sm" />
                <Text c="dimmed" size="sm">
                  Проверяем архив перед построением тепловой карты...
                </Text>
              </Group>
            ) : null}

            {validationInfo && !isArchiveTooLarge ? (
              <InfoNotice
                icon={<WarningCircle size={16} />}
                text={`Папок в выбранном срезе: ${validationInfo.folderCount ?? 0} из ${validationInfo.maxAllowed}.`}
              />
            ) : null}

            {validationInfo && isArchiveTooLarge ? (
              <InfoNotice
                icon={<WarningCircle size={16} />}
                text={
                  validationInfo.message ||
                  `Архив слишком большой для построения тепловой карты. Максимум: ${HEATMAP_MAX_ARCHIVE_MB} MB.`
                }
              />
            ) : null}

            {validationInfo && !validationInfo.allowed && !isArchiveTooLarge ? (
              <Alert color="orange">
                {validationInfo.message ||
                  "Архив слишком большой для построения тепловой карты или содержит слишком много папок с кодом."}
              </Alert>
            ) : null}

            {archive ? (
              <Group justify="flex-end">
                <Button
                  loading={isStarting}
                  disabled={buildDisabled}
                  onClick={() => void handleStart()}
                >
                  Построить тепловую карту
                </Button>
              </Group>
            ) : null}
            {jobStatus ? (
              <Stack gap={6}>
                <Progress value={jobStatus.progressPercent ?? 0} />
                <Text c="dimmed" size="sm">
                  {jobStatus.stage || "Построение тепловой карты"}
                </Text>
              </Stack>
            ) : null}
            {error ? <Alert color="red">{error}</Alert> : null}
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
