import { Box, Text } from "@mantine/core"

import type { ClusteredMetricRow } from "../api"
import { buildBoxPlotData } from "../lib"
import { ClusterMetricBoxPlotSvg } from "./components/ClusterMetricBoxPlotSvg"

type Props = {
  metric: string
  rows: ClusteredMetricRow[]
  chartWidth?: number
  chartHeight?: number
}

export function ClusterMetricBoxPlot({ metric, rows, chartWidth, chartHeight }: Props) {
  const boxData = buildBoxPlotData(metric, rows)

  if (!boxData.length) {
    return <Text c="dimmed">Нет числовых данных</Text>
  }

  return (
    <Box style={{ overflowX: "auto" }}>
      <ClusterMetricBoxPlotSvg
        boxData={boxData}
        chartHeight={chartHeight}
        chartWidth={chartWidth}
        metric={metric}
      />
    </Box>
  )
}
