import { Box } from "@mantine/core"
import { max } from "d3-array"
import { scaleBand, scaleLinear } from "d3-scale"

import { CHART_WIDTH, DEFAULT_BAR_COLOR, GRID_COLOR, LABEL_COLOR } from "../../model/constants"
import type { GitPathMetric } from "../../model/gitCharts"
import { AxisBottom } from "./AxisBottom"

type Props = {
  data: GitPathMetric[]
  colorByPath: Map<string, string>
  xLabel: string
  chartWidth?: number
  chartHeight?: number
}

export const HorizontalBarChart = ({
  data,
  colorByPath,
  xLabel,
  chartWidth = CHART_WIDTH,
  chartHeight = 220
}: Props) => {
  const margin = { top: 10, right: 12, bottom: 34, left: 8 }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom
  const maxValue = Math.max(0, max(data, (item) => item.value) || 0)

  const yScale = scaleBand<string>()
    .domain(data.map((item) => item.path))
    .range([0, plotHeight])
    .padding(0.45)
  const xScale = scaleLinear()
    .domain([0, maxValue > 0 ? maxValue * 1.05 : 1])
    .range([0, plotWidth])
  const ticks = xScale.ticks(5)

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={chartHeight} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={0}
              y2={plotHeight}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {data.map((item) => {
            const y = yScale(item.path) || 0
            return (
              <rect
                key={`${item.path}:${item.value}`}
                fill={colorByPath.get(item.path) || DEFAULT_BAR_COLOR}
                height={yScale.bandwidth()}
                rx={4}
                style={{ cursor: "default" }}
                width={Math.max(0, xScale(item.value))}
                x={0}
                y={y}
              >
                <title>{`${item.path}: ${item.value}`}</title>
              </rect>
            )
          })}
          <AxisBottom ticks={ticks} width={plotWidth} x={xScale} y={plotHeight} />
          <text
            x={plotWidth / 2}
            y={plotHeight + 28}
            fill={LABEL_COLOR}
            fontSize={11}
            textAnchor="middle"
          >
            {xLabel}
          </text>
        </g>
      </svg>
    </Box>
  )
}
