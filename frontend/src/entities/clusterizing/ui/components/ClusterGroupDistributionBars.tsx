import type { ClusterGroupDistribution } from "../../api"
import { formatChartNumber } from "../../lib"
import {
  CLUSTER_AXIS_COLOR,
  CLUSTER_GRID_COLOR,
  CLUSTER_LABEL_COLOR
} from "../../model/chartConstants"
import type { ClusterGroupChartScales } from "./useClusterGroupChartScales"

type Props = {
  chart: ClusterGroupChartScales
  data: ClusterGroupDistribution[]
  groups: string[]
}

export function ClusterGroupDistributionBars({ chart, data, groups }: Props) {
  return (
    <>
      {chart.ticks.map((tick) => (
        <line
          key={tick}
          stroke={CLUSTER_GRID_COLOR}
          strokeWidth={1}
          x1={0}
          x2={chart.plotWidth}
          y1={chart.yScale(tick)}
          y2={chart.yScale(tick)}
        />
      ))}
      {data.map((cluster) => (
        <g
          key={cluster.cluster}
          transform={`translate(${chart.xCluster(String(cluster.cluster)) || 0}, 0)`}
        >
          {groups.map((group) => {
            const value = cluster.counts[group] || 0
            const y = chart.yScale(value)
            return (
              <rect
                key={`${cluster.cluster}:${group}`}
                fill={chart.colorScale(group)}
                height={chart.plotHeight - y}
                width={chart.xGroup.bandwidth()}
                x={chart.xGroup(group) || 0}
                y={y}
              />
            )
          })}
        </g>
      ))}
      <line stroke={CLUSTER_AXIS_COLOR} x1={0} x2={0} y1={0} y2={chart.plotHeight} />
      <line
        stroke={CLUSTER_AXIS_COLOR}
        x1={0}
        x2={chart.plotWidth}
        y1={chart.plotHeight}
        y2={chart.plotHeight}
      />
      {chart.ticks.map((tick) => (
        <text
          key={`y:${tick}`}
          fill={CLUSTER_LABEL_COLOR}
          fontSize={12}
          textAnchor="end"
          x={-8}
          y={chart.yScale(tick) + 4}
        >
          {formatChartNumber(tick)}
        </text>
      ))}
      {data.map((cluster) => (
        <text
          key={`x:${cluster.cluster}`}
          fill={CLUSTER_LABEL_COLOR}
          fontSize={13}
          textAnchor="middle"
          x={(chart.xCluster(String(cluster.cluster)) || 0) + chart.xCluster.bandwidth() / 2}
          y={chart.plotHeight + 26}
        >
          {cluster.cluster}
        </text>
      ))}
      <text
        fill={CLUSTER_LABEL_COLOR}
        fontSize={18}
        textAnchor="middle"
        x={chart.plotWidth / 2}
        y={chart.plotHeight + 58}
      >
        Кластер
      </text>
      <text
        fill={CLUSTER_LABEL_COLOR}
        fontSize={18}
        textAnchor="middle"
        transform={`translate(${-48}, ${chart.plotHeight / 2}) rotate(-90)`}
      >
        Количество
      </text>
    </>
  )
}
