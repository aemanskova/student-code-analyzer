import {
  ClusterMetricBoxPlot,
  getNumericMetrics,
  useGetClusterizationDetailsQuery
} from "@entities/clusterizing"
import { getMetricLabel } from "@entities/glossary"
import { Card, Container, Group, Loader, Select, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router"

const chartSize = { width: 1120, height: 620 }

export function ClusterizingMetricChartPage() {
  const navigate = useNavigate()
  const { jobId = "", encodedMetric = "" } = useParams()
  const metric = decodeURIComponent(encodedMetric)
  const { data, isFetching, isLoading } = useGetClusterizationDetailsQuery(jobId, {
    skip: !jobId
  })
  const chartRows = useMemo(() => (data ? [...data.rows, ...(data.outlierRows || [])] : []), [data])
  const numericMetrics = useMemo(
    () => (data ? getNumericMetrics(chartRows, data.metrics || []) : []),
    [chartRows, data]
  )
  const metricOptions = useMemo(
    () => numericMetrics.map((item) => ({ value: item, label: getMetricLabel(item) })),
    [numericMetrics]
  )

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 })
  }, [encodedMetric, jobId])

  const handleMetricChange = (value: string | null) => {
    if (!value) {
      return
    }
    navigate(routes.clusterizingMetricChart(jobId, value))
  }

  if (isLoading || isFetching) {
    return (
      <Container py="md" size="xl">
        <Card>
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        </Card>
      </Container>
    )
  }

  if (!data) {
    return (
      <Container py="md" size="xl">
        <Text c="dimmed">Данные графика не найдены.</Text>
      </Container>
    )
  }

  return (
    <Container py="md" size="xl">
      <Card p="md">
        <Stack gap="sm">
          <Stack gap={4}>
            <Title order={3}>{getMetricLabel(metric)}</Title>
            <Text c="dimmed" size="sm">
              Полноэкранный график метрики кластеризации
            </Text>
          </Stack>
          <Select
            data={metricOptions}
            label="Метрика"
            searchable
            value={metric}
            w={520}
            onChange={handleMetricChange}
          />
          {numericMetrics.includes(metric) ? (
            <ClusterMetricBoxPlot
              chartHeight={chartSize.height}
              chartWidth={chartSize.width}
              metric={metric}
              rows={chartRows}
            />
          ) : (
            <Text c="dimmed">Для выбранной метрики нет числовых данных.</Text>
          )}
        </Stack>
      </Card>
    </Container>
  )
}
