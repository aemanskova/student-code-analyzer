import { Box } from "@mantine/core"
import { max } from "d3-array"
import { scaleLinear } from "d3-scale"

import {
  AXIS_COLOR,
  CHART_HEIGHT,
  CHART_WIDTH,
  DEFAULT_BAR_COLOR,
  GRID_COLOR,
  LABEL_COLOR
} from "../../model/constants"
import type { GitScatterPoint } from "../../model/gitCharts"
import { formatNumber } from "../../model/utils"
import { AxisBottom } from "./AxisBottom"

type Props = {
  data: GitScatterPoint[]
  colorByPath: Map<string, string>
  xLabel: string
  yLabel: string
}

export const ScatterChart = ({ data, colorByPath, xLabel, yLabel }: Props) => {
  const margin = { top: 10, right: 12, bottom: 34, left: 64 }
  const plotWidth = CHART_WIDTH - margin.left - margin.right
  const plotHeight = CHART_HEIGHT - margin.top - margin.bottom

  const maxX = Math.max(0, max(data, (item) => item.x) || 0)
  const maxY = Math.max(0, max(data, (item) => item.y) || 0)

  const xScale = scaleLinear()
    .domain([0, maxX > 0 ? maxX * 1.05 : 1])
    .range([0, plotWidth])
  const yScale = scaleLinear()
    .domain([0, maxY > 0 ? maxY * 1.05 : 1])
    .range([plotHeight, 0])
  const xTicks = xScale.ticks(5)
  const yTicks = yScale.ticks(5)

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={CHART_HEIGHT} width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {xTicks.map((tick) => (
            <line
              key={`x:${tick}`}
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={0}
              y2={plotHeight}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {yTicks.map((tick) => (
            <line
              key={`y:${tick}`}
              x1={0}
              x2={plotWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {data.map((item) => (
            <circle
              key={`${item.path}:${item.x}:${item.y}`}
              cx={xScale(item.x)}
              cy={yScale(item.y)}
              fill={colorByPath.get(item.path) || DEFAULT_BAR_COLOR}
              opacity={0.85}
              r={4}
            />
          ))}
          <AxisBottom ticks={xTicks} width={plotWidth} x={xScale} y={plotHeight} />
          <line x1={0} x2={0} y1={0} y2={plotHeight} stroke={AXIS_COLOR} strokeWidth={1} />
          {yTicks.map((tick) => (
            <g key={`yl:${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x2={-6} stroke={AXIS_COLOR} strokeWidth={1} />
              <text dx="-0.7em" dy="0.32em" fill={LABEL_COLOR} fontSize={11} textAnchor="end">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          <text
            x={plotWidth / 2}
            y={plotHeight + 28}
            fill={LABEL_COLOR}
            fontSize={11}
            textAnchor="middle"
          >
            {xLabel}
          </text>
          <text
            fill={LABEL_COLOR}
            fontSize={11}
            textAnchor="middle"
            transform={`translate(${-52}, ${plotHeight / 2}) rotate(-90)`}
          >
            {yLabel}
          </text>
        </g>
      </svg>
    </Box>
  )
}
