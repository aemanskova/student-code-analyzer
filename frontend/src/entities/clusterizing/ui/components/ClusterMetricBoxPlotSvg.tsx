import { max } from "d3-array"
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale"

import { type BoxPlotValue, formatChartNumber } from "../../lib"
import {
  CLUSTER_AXIS_COLOR,
  CLUSTER_CHART_HEIGHT,
  CLUSTER_CHART_WIDTH,
  CLUSTER_GRID_COLOR,
  CLUSTER_LABEL_COLOR,
  CLUSTER_SERIES_COLORS
} from "../../model/chartConstants"

type Props = {
  boxData: BoxPlotValue[]
  metric: string
}

export function ClusterMetricBoxPlotSvg({ boxData, metric }: Props) {
  const maxValue = Math.max(0, max(boxData, (item) => item.max) || 0)
  const ticks = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.08 : 1])
    .ticks(5)
  const maxTickLength = Math.max(...ticks.map((tick) => formatChartNumber(tick).length))
  const margin = { top: 10, right: 12, bottom: 44, left: Math.max(52, maxTickLength * 7 + 18) }
  const plotWidth = CLUSTER_CHART_WIDTH - margin.left - margin.right
  const plotHeight = CLUSTER_CHART_HEIGHT - margin.top - margin.bottom
  const yScale = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.08 : 1])
    .range([plotHeight, 0])
  const xScale = scaleBand<string>()
    .domain(boxData.map((item) => item.cluster))
    .range([0, plotWidth])
    .padding(0.35)
  const colorScale = scaleOrdinal<string, string>()
    .domain(boxData.map((item) => item.cluster))
    .range(CLUSTER_SERIES_COLORS)

  return (
    <svg
      height={CLUSTER_CHART_HEIGHT}
      width="100%"
      viewBox={`0 0 ${CLUSTER_CHART_WIDTH} ${CLUSTER_CHART_HEIGHT}`}
    >
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {ticks.map((tick) => (
          <line
            key={tick}
            stroke={CLUSTER_GRID_COLOR}
            strokeWidth={1}
            x1={0}
            x2={plotWidth}
            y1={yScale(tick)}
            y2={yScale(tick)}
          />
        ))}
        {boxData.map((item) => {
          const x = xScale(item.cluster) || 0
          const width = Math.max(14, xScale.bandwidth())
          const centerX = x + width / 2
          const color = colorScale(item.cluster)

          return (
            <g key={`${metric}:${item.cluster}`}>
              <line
                stroke={color}
                strokeWidth={1.5}
                x1={centerX}
                x2={centerX}
                y1={yScale(item.max)}
                y2={yScale(item.q3)}
              />
              <line
                stroke={color}
                strokeWidth={1.5}
                x1={centerX}
                x2={centerX}
                y1={yScale(item.q1)}
                y2={yScale(item.min)}
              />
              <rect
                fill={color}
                fillOpacity={0.28}
                height={Math.max(1, yScale(item.q1) - yScale(item.q3))}
                stroke={color}
                width={width}
                x={x}
                y={yScale(item.q3)}
              />
              <line
                stroke={color}
                strokeWidth={2}
                x1={x}
                x2={x + width}
                y1={yScale(item.median)}
                y2={yScale(item.median)}
              />
              <line
                stroke={color}
                x1={x + width * 0.2}
                x2={x + width * 0.8}
                y1={yScale(item.max)}
                y2={yScale(item.max)}
              />
              <line
                stroke={color}
                x1={x + width * 0.2}
                x2={x + width * 0.8}
                y1={yScale(item.min)}
                y2={yScale(item.min)}
              />
            </g>
          )
        })}
        <line stroke={CLUSTER_AXIS_COLOR} x1={0} x2={0} y1={0} y2={plotHeight} />
        <line stroke={CLUSTER_AXIS_COLOR} x1={0} x2={plotWidth} y1={plotHeight} y2={plotHeight} />
        {ticks.map((tick) => (
          <text
            key={`label:${tick}`}
            fill={CLUSTER_LABEL_COLOR}
            fontSize={11}
            textAnchor="end"
            x={-8}
            y={yScale(tick) + 4}
          >
            {formatChartNumber(tick)}
          </text>
        ))}
        {boxData.map((item) => (
          <text
            key={`x:${item.cluster}`}
            fill={CLUSTER_LABEL_COLOR}
            fontSize={12}
            textAnchor="middle"
            x={(xScale(item.cluster) || 0) + Math.max(14, xScale.bandwidth()) / 2}
            y={plotHeight + 24}
          >
            {item.cluster}
          </text>
        ))}
      </g>
    </svg>
  )
}
