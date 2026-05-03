import type { ClusteredMetricRow, ExcludedMetricRow } from "@entities/clusterizing"
import { Alert, Stack } from "@mantine/core"
import type { VirtualizedColumn } from "@shared/ui"

import { ClusterExceptionRowsCard } from "./ClusterExceptionRowsCard"

type Props = {
  excludedColumns: Array<VirtualizedColumn<ExcludedMetricRow>>
  excludedRows: ExcludedMetricRow[]
  metricsCount: number
  onDownloadExcluded: () => void
  onDownloadOutliers: () => void
  outlierColumns: Array<VirtualizedColumn<ClusteredMetricRow>>
  outlierRows: ClusteredMetricRow[]
}

export function ClusterExceptionsPanel(props: Props) {
  return (
    <Stack gap="md">
      <Alert color="blue">
        Данные работы требуют отдельного экспертного рассмотрения. Исключенные работы - работы, не
        содержащие кода HTML или CSS. Выбросы - работы, не отнесенные алгоритмом кластеризации ни к
        одному кластеру.
      </Alert>
      <ClusterExceptionRowsCard
        columns={props.excludedColumns}
        data={props.excludedRows}
        emptyText="Исключенных работ нет."
        getRowKey={(row) => `${row.runId}:${row.path}:excluded`}
        minTableWidth={Math.max(760, 580 + props.metricsCount * 160)}
        title="Исключенные работы"
        onDownload={props.onDownloadExcluded}
      />
      <ClusterExceptionRowsCard
        columns={props.outlierColumns}
        data={props.outlierRows}
        emptyText="Выбросов нет."
        getRowKey={(row) => `${row.runId}:${row.path}:${row.cluster}`}
        minTableWidth={Math.max(760, 430 + props.metricsCount * 160)}
        title="Выбросы (-1)"
        onDownload={props.onDownloadOutliers}
      />
    </Stack>
  )
}
