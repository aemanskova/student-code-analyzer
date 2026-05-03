import type { ClusterGroupDistribution } from "../../api"
import { type ClusterGroupDistributionMeta } from "../../lib"
import { ClusterGroupDistributionBars } from "./ClusterGroupDistributionBars"
import { ClusterGroupDistributionLegend } from "./ClusterGroupDistributionLegend"
import { useClusterGroupChartScales } from "./useClusterGroupChartScales"

type Props = {
  data: ClusterGroupDistribution[]
  meta: ClusterGroupDistributionMeta
}

export function ClusterGroupDistributionSvg({ data, meta }: Props) {
  const chart = useClusterGroupChartScales(data, meta)

  return (
    <svg
      height={chart.chartHeight}
      width="100%"
      viewBox={`0 0 ${chart.chartWidth} ${chart.chartHeight}`}
    >
      <g transform={`translate(${chart.margin.left}, ${chart.margin.top})`}>
        <ClusterGroupDistributionBars chart={chart} data={data} groups={meta.groups} />
        <ClusterGroupDistributionLegend chart={chart} meta={meta} />
      </g>
    </svg>
  )
}
