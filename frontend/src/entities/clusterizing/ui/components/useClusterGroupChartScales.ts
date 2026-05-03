import { max } from "d3-array"
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale"

import type { ClusterGroupDistribution } from "../../api"
import { type ClusterGroupDistributionMeta } from "../../lib"
import {
  CLUSTER_GROUP_CHART_HEIGHT,
  CLUSTER_GROUP_CHART_PLOT_WIDTH,
  CLUSTER_SERIES_COLORS
} from "../../model/chartConstants"

const LEGEND_GAP = 28
const LEGEND_MARKER_WIDTH = 24
const LEGEND_PADDING_X = 12
const LEGEND_ROW_HEIGHT = 26
const LEGEND_TITLE_HEIGHT = 38

export const clusterGroupLegend = {
  gap: LEGEND_GAP,
  markerWidth: LEGEND_MARKER_WIDTH,
  paddingX: LEGEND_PADDING_X,
  rowHeight: LEGEND_ROW_HEIGHT,
  titleHeight: LEGEND_TITLE_HEIGHT
}

export const useClusterGroupChartScales = (
  data: ClusterGroupDistribution[],
  meta: ClusterGroupDistributionMeta
) => {
  const margin = { top: 12, right: 24, bottom: 72, left: 68 }
  const plotWidth = CLUSTER_GROUP_CHART_PLOT_WIDTH
  const plotHeight = CLUSTER_GROUP_CHART_HEIGHT - margin.top - margin.bottom
  const legendLabelWidth = Math.max(
    76,
    ...meta.groupLabels.map((label) => Math.ceil(label.length * 7.6))
  )
  const legendWidth =
    LEGEND_PADDING_X * 2 + LEGEND_MARKER_WIDTH + 10 + Math.max(58, legendLabelWidth)
  const legendHeight = Math.max(
    58,
    LEGEND_TITLE_HEIGHT + meta.groups.length * LEGEND_ROW_HEIGHT + 8
  )
  const chartWidth = margin.left + plotWidth + LEGEND_GAP + legendWidth + margin.right
  const chartHeight = Math.max(CLUSTER_GROUP_CHART_HEIGHT, margin.top + legendHeight + 20)
  const xCluster = scaleBand<string>().domain(meta.clusters).range([0, plotWidth]).padding(0.18)
  const xGroup = scaleBand<string>()
    .domain(meta.groups)
    .range([0, xCluster.bandwidth()])
    .padding(0.12)
  const colorScale = scaleOrdinal<string, string>().domain(meta.groups).range(CLUSTER_SERIES_COLORS)
  const maxValue =
    max(data, (cluster) => max(meta.groups, (group) => cluster.counts[group] || 0) || 0) || 0
  const yScale = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.1 : 1])
    .range([plotHeight, 0])

  return {
    chartHeight,
    chartWidth,
    colorScale,
    legendHeight,
    legendWidth,
    margin,
    plotHeight,
    plotWidth,
    ticks: yScale.ticks(5),
    xCluster,
    xGroup,
    yScale
  }
}

export type ClusterGroupChartScales = ReturnType<typeof useClusterGroupChartScales>
