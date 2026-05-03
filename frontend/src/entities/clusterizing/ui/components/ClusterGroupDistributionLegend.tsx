import { type ClusterGroupDistributionMeta } from "../../lib"
import {
  CLUSTER_LABEL_COLOR,
  CLUSTER_LEGEND_BG,
  CLUSTER_LEGEND_BORDER
} from "../../model/chartConstants"
import type { ClusterGroupChartScales } from "./useClusterGroupChartScales"
import { clusterGroupLegend } from "./useClusterGroupChartScales"

type Props = {
  chart: ClusterGroupChartScales
  meta: ClusterGroupDistributionMeta
}

export function ClusterGroupDistributionLegend({ chart, meta }: Props) {
  return (
    <g transform={`translate(${chart.plotWidth + clusterGroupLegend.gap}, 10)`}>
      <rect
        fill={CLUSTER_LEGEND_BG}
        height={chart.legendHeight}
        rx={3}
        stroke={CLUSTER_LEGEND_BORDER}
        width={chart.legendWidth}
      />
      <text
        fill={CLUSTER_LABEL_COLOR}
        fontSize={18}
        textAnchor="middle"
        x={chart.legendWidth / 2}
        y={22}
      >
        Группа
      </text>
      {meta.groups.map((group, index) => (
        <g
          key={`legend:${group}`}
          transform={`translate(${clusterGroupLegend.paddingX}, ${44 + index * clusterGroupLegend.rowHeight})`}
        >
          <rect
            fill={chart.colorScale(group)}
            height={13}
            width={clusterGroupLegend.markerWidth}
            y={-10}
          />
          <text
            fill={CLUSTER_LABEL_COLOR}
            fontSize={15}
            x={clusterGroupLegend.markerWidth + 10}
            y={1}
          >
            {meta.groupLabels[index]}
          </text>
        </g>
      ))}
    </g>
  )
}
