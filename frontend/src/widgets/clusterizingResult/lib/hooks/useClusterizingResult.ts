import {
  type ClusteredMetricRow,
  type ClusterizationDetailsResponse,
  type ExcludedMetricRow,
  getMetricCsvValue,
  getNumericMetrics,
  toMetricDisplayValue
} from "@entities/clusterizing"
import { getMetricLabel } from "@entities/glossary"
import { buildCsv, downloadCsvFile } from "@shared/lib/csv"
import type { VirtualizedColumn } from "@shared/ui"
import { useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

export const ALL_CLUSTER_METRICS = "__all__"
export const ALL_CLUSTER_TABLE_METRICS = "__all_table__"

const GIT_METRICS = [
  "active_days",
  "churn_ratio",
  "development_duration_days",
  "total_lines_added",
  "median_commit_size",
  "night_commit_pct"
]

export type ClusterizingResultForm = {
  pathFilter: string
  selectedMetrics: string[]
  selectedTableMetrics: string[]
}

export const useClusterizingResult = (data: ClusterizationDetailsResponse) => {
  const form = useForm<ClusterizingResultForm>({
    defaultValues: {
      pathFilter: "",
      selectedMetrics: [ALL_CLUSTER_METRICS],
      selectedTableMetrics: [ALL_CLUSTER_TABLE_METRICS]
    }
  })
  const pathFilter = useWatch({ control: form.control, name: "pathFilter" }) || ""
  const selectedMetrics = useWatch({ control: form.control, name: "selectedMetrics" }) || [
    ALL_CLUSTER_METRICS
  ]
  const selectedTableMetrics = useWatch({
    control: form.control,
    name: "selectedTableMetrics"
  }) || [ALL_CLUSTER_TABLE_METRICS]
  const excludedRows = useMemo(() => data.excludedRows || [], [data.excludedRows])
  const outlierRows = useMemo(() => data.outlierRows || [], [data.outlierRows])
  const chartRows = useMemo(() => [...data.rows, ...outlierRows], [data.rows, outlierRows])
  const orderedMetrics = useMemo(() => {
    const source = data.metrics || []
    const gitMetrics = GIT_METRICS.filter((metric) => source.includes(metric))
    const restMetrics = source.filter((metric) => !GIT_METRICS.includes(metric))
    return [...gitMetrics, ...restMetrics]
  }, [data.metrics])
  const numericMetrics = useMemo(
    () => getNumericMetrics(chartRows, orderedMetrics),
    [chartRows, orderedMetrics]
  )
  const visibleMetrics = selectedMetrics.includes(ALL_CLUSTER_METRICS)
    ? numericMetrics
    : selectedMetrics.filter((metric) => numericMetrics.includes(metric))
  const metricOptions = numericMetrics.map((metric) => ({
    value: metric,
    label: getMetricLabel(metric)
  }))
  const tableMetricOptions = orderedMetrics.map((metric) => ({
    value: metric,
    label: getMetricLabel(metric)
  }))
  const visibleTableMetrics = selectedTableMetrics.includes(ALL_CLUSTER_TABLE_METRICS)
    ? orderedMetrics
    : selectedTableMetrics.filter((metric) => orderedMetrics.includes(metric))
  const filteredRows = useMemo(() => {
    const query = pathFilter.trim().toLowerCase()
    return query ? data.rows.filter((row) => row.path.toLowerCase().includes(query)) : data.rows
  }, [data.rows, pathFilter])
  const tableColumns = useMemo<Array<VirtualizedColumn<ClusteredMetricRow>>>(
    () => [
      { key: "cluster", title: "Кластер", minWidth: 110, render: (row) => row.cluster },
      { key: "path", title: "Папка", minWidth: 320, render: (row) => row.path },
      ...visibleTableMetrics.map((metric) => ({
        key: metric,
        title: getMetricLabel(metric),
        minWidth: 160,
        render: (row: ClusteredMetricRow) => toMetricDisplayValue(row.metrics[metric])
      }))
    ],
    [visibleTableMetrics]
  )
  const plainMetricColumns = useMemo(
    () =>
      orderedMetrics.map((metric) => ({
        key: metric,
        title: getMetricLabel(metric),
        minWidth: 160,
        render: (row: ClusteredMetricRow | ExcludedMetricRow) =>
          toMetricDisplayValue(row.metrics[metric])
      })),
    [orderedMetrics]
  )

  const downloadRowsCsv = (
    fileName: string,
    rows: Array<ClusteredMetricRow | ExcludedMetricRow>
  ) => {
    const csvMetrics = rows === filteredRows ? visibleTableMetrics : orderedMetrics
    const headers =
      rows === filteredRows ? ["cluster", "path", ...csvMetrics] : ["path", ...csvMetrics]
    const csvRows = rows.map((row) =>
      "cluster" in row
        ? [
            String(row.cluster),
            row.path,
            ...csvMetrics.map((metric) => getMetricCsvValue(row.metrics, metric))
          ]
        : [row.path, ...csvMetrics.map((metric) => getMetricCsvValue(row.metrics, metric))]
    )

    downloadCsvFile(fileName, buildCsv(headers, csvRows))
  }

  return {
    chartRows,
    downloadCsv: () => downloadRowsCsv(`clusterization-${data.jobId}.csv`, filteredRows),
    downloadExcludedCsv: () =>
      downloadRowsCsv(`clusterization-${data.jobId}-excluded.csv`, excludedRows),
    downloadOutliersCsv: () =>
      downloadRowsCsv(`clusterization-${data.jobId}-outliers.csv`, outlierRows),
    excludedColumns: [
      { key: "path", title: "Папка", minWidth: 320, render: (row) => row.path },
      ...plainMetricColumns
    ] as Array<VirtualizedColumn<ExcludedMetricRow>>,
    excludedRows,
    filteredRows,
    form,
    metricOptions,
    orderedMetrics,
    outlierColumns: [
      { key: "path", title: "Папка", minWidth: 320, render: (row) => row.path },
      ...plainMetricColumns
    ] as Array<VirtualizedColumn<ClusteredMetricRow>>,
    outlierRows,
    selectedMetrics,
    tableMetricOptions,
    tableColumns,
    visibleTableMetrics,
    visibleMetrics
  }
}
