import { Box, Text } from "@mantine/core"
import { max } from "d3-array"
import { scaleBand, scaleLinear } from "d3-scale"

import {
  AXIS_COLOR,
  BOX_COLORS,
  CHART_HEIGHT,
  CHART_WIDTH,
  GRID_COLOR,
  LABEL_COLOR
} from "../../model/constants"
import type { GitPathMetric } from "../../model/gitCharts"
import { getScopeDisplayName, getScopePathValue } from "../../model/gitCharts"
import { formatNumber, quantile } from "../../model/utils"

type Props = {
  metric: string
  data: GitPathMetric[]
  analysisDepth?: number
  chartWidth?: number
  chartHeight?: number
}

type BoxPlotValue = {
  group: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export const MetricGroupsBoxPlot = ({
  metric,
  data,
  analysisDepth,
  chartWidth = CHART_WIDTH,
  chartHeight = CHART_HEIGHT
}: Props) => {
  const valuesByGroup = new Map<string, number[]>()
  for (const row of data) {
    const group = getScopePathValue(row.path, analysisDepth) || "Без группы"
    const values = valuesByGroup.get(group) || []
    values.push(row.value)
    valuesByGroup.set(group, values)
  }

  const boxData: BoxPlotValue[] = Array.from(valuesByGroup.entries())
    .map(([group, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return {
        group,
        min: sorted[0] ?? 0,
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1] ?? 0
      }
    })
    .sort((a, b) => a.group.localeCompare(b.group))

  if (!boxData.length) {
    return <Text c="dimmed">Нет данных для boxplot</Text>
  }

  const maxValue = Math.max(0, max(boxData, (item) => item.max) || 0)
  const yTicks = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.05 : 1])
    .ticks(5)
  const maxTickLength = Math.max(...yTicks.map((tick) => formatNumber(tick).length))
  const margin = { top: 10, right: 12, bottom: 56, left: Math.max(48, maxTickLength * 7 + 18) }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom
  const yScale = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.05 : 1])
    .range([plotHeight, 0])
  const xScale = scaleBand<string>()
    .domain(boxData.map((item) => item.group))
    .range([0, plotWidth])
    .padding(0.35)

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={chartHeight} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {yTicks.map((tick) => (
            <line
              key={`tick:${tick}`}
              x1={0}
              x2={plotWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {boxData.map((item, index) => {
            const x = xScale(item.group) || 0
            const boxWidth = Math.max(10, xScale.bandwidth())
            const centerX = x + boxWidth / 2
            const fill = BOX_COLORS[index % BOX_COLORS.length]
            const yMin = yScale(item.min)
            const yQ1 = yScale(item.q1)
            const yMedian = yScale(item.median)
            const yQ3 = yScale(item.q3)
            const yMax = yScale(item.max)

            return (
              <g key={`${metric}:${item.group}`} style={{ cursor: "default" }}>
                <title>
                  {`${getScopeDisplayName(item.group)}: min ${formatNumber(item.min)}, Q1 ${formatNumber(item.q1)}, median ${formatNumber(item.median)}, Q3 ${formatNumber(item.q3)}, max ${formatNumber(item.max)}`}
                </title>
                <line
                  x1={centerX}
                  x2={centerX}
                  y1={yMax}
                  y2={yQ3}
                  stroke={fill}
                  strokeWidth={1.5}
                />
                <line
                  x1={centerX}
                  x2={centerX}
                  y1={yQ1}
                  y2={yMin}
                  stroke={fill}
                  strokeWidth={1.5}
                />
                <rect
                  fill={fill}
                  fillOpacity={0.35}
                  height={Math.max(1, yQ1 - yQ3)}
                  stroke={fill}
                  strokeWidth={1.2}
                  width={boxWidth}
                  x={x}
                  y={yQ3}
                />
                <line
                  x1={x}
                  x2={x + boxWidth}
                  y1={yMedian}
                  y2={yMedian}
                  stroke={fill}
                  strokeWidth={1.8}
                />
                <line
                  x1={x + boxWidth * 0.2}
                  x2={x + boxWidth * 0.8}
                  y1={yMax}
                  y2={yMax}
                  stroke={fill}
                  strokeWidth={1.2}
                />
                <line
                  x1={x + boxWidth * 0.2}
                  x2={x + boxWidth * 0.8}
                  y1={yMin}
                  y2={yMin}
                  stroke={fill}
                  strokeWidth={1.2}
                />
              </g>
            )
          })}
          <line x1={0} x2={0} y1={0} y2={plotHeight} stroke={AXIS_COLOR} />
          {yTicks.map((tick) => (
            <g key={`yl:${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x2={-6} stroke={AXIS_COLOR} />
              <text dx="-0.7em" dy="0.32em" fill={LABEL_COLOR} fontSize={11} textAnchor="end">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          <line x1={0} x2={plotWidth} y1={plotHeight} y2={plotHeight} stroke={AXIS_COLOR} />
          {boxData.map((item, index) => {
            const x = xScale(item.group) || 0
            const centerX = x + Math.max(10, xScale.bandwidth()) / 2
            const fill = BOX_COLORS[index % BOX_COLORS.length]
            return (
              <g
                key={`xlabel:${metric}:${item.group}`}
                transform={`translate(${centerX}, ${plotHeight + 12})`}
              >
                <text fill={LABEL_COLOR} fontSize={10} textAnchor="end" transform="rotate(-28)">
                  {getScopeDisplayName(item.group)}
                </text>
                <circle cx={-6} cy={-4} fill={fill} r={3} />
              </g>
            )
          })}
        </g>
      </svg>
    </Box>
  )
}
