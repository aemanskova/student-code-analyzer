import { useGetSavedAnalysisListQuery } from "@entities/analysis/api"
import { AnalysisDirectionLabel } from "@entities/analysis/model/direction"
import { useBuildClusterizationMutation } from "@entities/clusterizing"
import { Alert, Button, Card, Container, Group, Select, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { getApiErrorMessage } from "@shared/lib"
import { useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useNavigate } from "react-router"

type ClusterizingCreateForm = {
  direction: "html_css"
  runId: string | null
}

export function ClusterizingCreatePage() {
  const navigate = useNavigate()
  const form = useForm<ClusterizingCreateForm>({
    defaultValues: {
      direction: "html_css",
      runId: null
    }
  })
  const selectedRunId = useWatch({ control: form.control, name: "runId" })
  const [error, setError] = useState<string | null>(null)
  const {
    data: analysisList,
    isFetching,
    isLoading
  } = useGetSavedAnalysisListQuery({
    page: 1,
    size: 500,
    direction: "html_css"
  })
  const [buildClusterization, { isLoading: isBuilding }] = useBuildClusterizationMutation()

  const runOptions = useMemo(
    () =>
      (analysisList?.data || []).map((item) => ({
        value: item.runId,
        label: item.path
      })),
    [analysisList?.data]
  )
  const handleBuild = async () => {
    if (!selectedRunId) {
      return
    }
    setError(null)
    try {
      const response = await buildClusterization({ runId: selectedRunId }).unwrap()
      navigate(routes.clusterizingDetails(response.jobId))
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Не удалось выполнить кластеризацию."))
    }
  }

  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card>
          <Stack gap="md">
            <Title order={3}>Новая кластеризация</Title>
            <Group align="end" grow>
              <Controller
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <Select
                    data={[{ value: "html_css", label: AnalysisDirectionLabel.HtmlCss }]}
                    label="Направление"
                    readOnly
                    value={field.value}
                    onChange={() => undefined}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="runId"
                render={({ field }) => (
                  <Select
                    clearable
                    data={runOptions}
                    disabled={isLoading || isFetching || isBuilding}
                    label="Папка"
                    nothingFoundMessage="Анализы не найдены"
                    placeholder="Выберите папку"
                    searchable
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Button
                disabled={!selectedRunId || isLoading || isFetching}
                loading={isBuilding}
                style={{ alignSelf: "flex-end", flexGrow: 0 }}
                onClick={() => void handleBuild()}
              >
                Выполнить кластеризацию
              </Button>
            </Group>
            <Text c="dimmed" size="sm">
              Для выбора доступны сохраненные анализы направления {AnalysisDirectionLabel.HtmlCss}.
            </Text>
            {error ? <Alert color="red">{error}</Alert> : null}
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
