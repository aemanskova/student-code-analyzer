import type { ClusterizationDetailsResponse } from "@entities/clusterizing"
import { Stack } from "@mantine/core"

import { useClusterizingResult } from "../lib/hooks/useClusterizingResult"
import {
  ClusterDashboardPanel,
  ClusterExceptionsPanel,
  ClusterGroupsPanel,
  ClusterizingResultHeader,
  ClusterizingResultTabs,
  ClusterTablePanel
} from "./components"

type Props = {
  data: ClusterizationDetailsResponse
}

export function ClusterizingResultView({ data }: Props) {
  const model = useClusterizingResult(data)

  return (
    <Stack gap="md">
      <ClusterizingResultHeader data={data} />
      <ClusterizingResultTabs
        dashboard={
          <ClusterDashboardPanel
            chartRows={model.chartRows}
            form={model.form}
            metricOptions={model.metricOptions}
            visibleMetrics={model.visibleMetrics}
          />
        }
        exceptions={
          <ClusterExceptionsPanel
            excludedColumns={model.excludedColumns}
            excludedRows={model.excludedRows}
            metricsCount={model.orderedMetrics.length}
            outlierColumns={model.outlierColumns}
            outlierRows={model.outlierRows}
            onDownloadExcluded={model.downloadExcludedCsv}
            onDownloadOutliers={model.downloadOutliersCsv}
          />
        }
        groups={<ClusterGroupsPanel data={data} />}
        table={
          <ClusterTablePanel
            columns={model.tableColumns}
            control={model.form.control}
            filteredRows={model.filteredRows}
            metricsCount={model.visibleTableMetrics.length}
            tableMetricOptions={model.tableMetricOptions}
            onDownload={model.downloadCsv}
          />
        }
      />
    </Stack>
  )
}
