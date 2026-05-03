import { useGetRunViewQuery } from "@entities/analysis/api"
import {
  buildGitYearResolver,
  getYearChartSpecialties
} from "@entities/analysis/model/analysis-charts"
import {
  MetricHistogram,
  MetricYearViolinChart,
  YearChartLegend
} from "@entities/analysis/ui/analysis-charts"
import { getMetricLabel } from "@entities/glossary"
import {
  BOXPLOT_METRICS,
  buildGitChartsDataset,
  GIT_METRIC_OPTIONS,
  type GitPathMetricKey,
  type GitScatterMetricKey,
  HISTO_METRICS,
  HorizontalBarChart,
  MetricGroupsBoxPlot,
  ScatterChart
} from "@features/gitCharts"
import { Card, Container, Group, Loader, Select, Stack, Tabs, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"

import { parseDepth, parseSelectedLevels, updateMetricSearch } from "../lib/query"

const chartSize = { width: 1120, height: 560 }

export function AnalysisMetricChartPage() {
  const navigate = useNavigate()
  const { runId = "", encodedMetric = "" } = useParams()
  const [searchParams] = useSearchParams()
  const metric = decodeURIComponent(encodedMetric)
  const kind = searchParams.get("kind") === "git" ? "git" : "metrics"
  const [mode, setMode] = useState<string | null>(searchParams.get("mode") || "distribution")
  const analysisDepth = parseDepth(searchParams.get("depth"))
  const selectedLevels = useMemo(() => parseSelectedLevels(searchParams), [searchParams])
  const query = useGetRunViewQuery(
    { runId, kind, depth: analysisDepth, selectedLevels },
    { skip: !runId }
  )

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 })
  }, [encodedMetric, runId])

  const handleMetricChange = (value: string | null) => {
    if (!value) {
      return
    }
    navigate(
      `${routes.analysisMetricChart(runId, value)}?${updateMetricSearch(searchParams, mode || undefined)}`
    )
  }

  if (query.isLoading || query.isFetching) {
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

  if (!query.data) {
    return (
      <Container py="md" size="xl">
        <Text c="dimmed">Данные графика не найдены.</Text>
      </Container>
    )
  }

  const metricOptions =
    query.data.kind === "metrics"
      ? query.data.metrics.map((item) => ({ value: item, label: getMetricLabel(item) }))
      : GIT_METRIC_OPTIONS.filter((item) => item.value !== "__all__")

  return (
    <Container py="md" size="xl">
      <Card p="md">
        <Stack gap="sm">
          <Stack gap={4}>
            <Title order={3}>{getMetricLabel(metric)}</Title>
            <Text c="dimmed" size="sm">
              Полноэкранный график метрики
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
          {query.data.kind === "metrics" ? (
            <MetricAnalysisChart
              analysisDepth={analysisDepth}
              gitRows={query.data.gitRows || []}
              metric={metric}
              mode={mode}
              rows={query.data.rows}
              selectedLevels={selectedLevels}
              setMode={setMode}
            />
          ) : (
            <MetricGitChart
              analysisDepth={analysisDepth}
              metric={metric}
              mode={mode}
              rows={query.data.rows}
              setMode={setMode}
            />
          )}
        </Stack>
      </Card>
    </Container>
  )
}

type MetricAnalysisChartProps = {
  analysisDepth?: number
  gitRows: NonNullable<
    Extract<ReturnType<typeof useGetRunViewQuery>["data"], { kind: "metrics" }>["gitRows"]
  >
  metric: string
  mode: string | null
  rows: Extract<
    NonNullable<ReturnType<typeof useGetRunViewQuery>["data"]>,
    { kind: "metrics" }
  >["rows"]
  selectedLevels: string[][]
  setMode: (value: string | null) => void
}

function MetricAnalysisChart({
  analysisDepth,
  gitRows,
  metric,
  mode,
  rows,
  setMode
}: MetricAnalysisChartProps) {
  const gitYearResolver = useMemo(
    () => buildGitYearResolver(gitRows, analysisDepth, null),
    [analysisDepth, gitRows]
  )
  const specialties = useMemo(
    () => getYearChartSpecialties(rows, [metric], analysisDepth, gitYearResolver),
    [analysisDepth, gitYearResolver, metric, rows]
  )

  return (
    <Tabs keepMounted={false} value={mode || "distribution"} onChange={setMode}>
      <Tabs.List>
        <Tabs.Tab value="distribution">Распределение</Tabs.Tab>
        <Tabs.Tab value="years">Динамика по годам</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel pt="md" value="distribution">
        <MetricHistogram
          chartHeight={chartSize.height}
          chartWidth={chartSize.width}
          metric={metric}
          rows={rows}
        />
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="years">
        <Stack gap="md">
          <YearChartLegend specialties={specialties} />
          <MetricYearViolinChart
            analysisDepth={analysisDepth}
            chartHeight={chartSize.height}
            chartWidth={chartSize.width}
            gitYearResolver={gitYearResolver}
            metric={metric}
            rows={rows}
            specialties={specialties}
          />
        </Stack>
      </Tabs.Panel>
    </Tabs>
  )
}

type MetricGitChartProps = {
  analysisDepth?: number
  metric: string
  mode: string | null
  rows: Extract<NonNullable<ReturnType<typeof useGetRunViewQuery>["data"]>, { kind: "git" }>["rows"]
  setMode: (value: string | null) => void
}

function MetricGitChart({ analysisDepth, metric, mode, rows, setMode }: MetricGitChartProps) {
  const dataset = useMemo(() => buildGitChartsDataset(rows), [rows])
  const safeMode = mode === "boxplot" && BOXPLOT_METRICS.includes(metric) ? "boxplot" : "histo"
  const isScatter = metric === "commitsVsChurn" || metric === "commitsVsChurnPct"

  return (
    <Tabs keepMounted={false} value={safeMode} onChange={setMode}>
      <Tabs.List>
        <Tabs.Tab value="histo">Гисто/точечный</Tabs.Tab>
        {BOXPLOT_METRICS.includes(metric) ? <Tabs.Tab value="boxplot">Боксплот</Tabs.Tab> : null}
      </Tabs.List>
      <Tabs.Panel pt="md" value="histo">
        {isScatter ? (
          <ScatterChart
            chartHeight={chartSize.height}
            chartWidth={chartSize.width}
            colorByPath={new Map()}
            data={dataset[metric as GitScatterMetricKey]}
            xLabel="Общее количество коммитов"
            yLabel={getMetricLabel(metric)}
          />
        ) : HISTO_METRICS.includes(metric) ? (
          <HorizontalBarChart
            chartHeight={chartSize.height}
            chartWidth={chartSize.width}
            colorByPath={new Map()}
            data={dataset[metric as GitPathMetricKey]}
            xLabel={getMetricLabel(metric)}
          />
        ) : (
          <Text c="dimmed">Для выбранной метрики нет графика.</Text>
        )}
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="boxplot">
        <MetricGroupsBoxPlot
          analysisDepth={analysisDepth}
          chartHeight={chartSize.height}
          chartWidth={chartSize.width}
          data={dataset[metric as GitPathMetricKey]}
          metric={metric}
        />
      </Tabs.Panel>
    </Tabs>
  )
}
