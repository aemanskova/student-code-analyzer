import type { AnalysisRow } from "@entities/analysis/api"
import { Box, Text } from "@mantine/core"
import { bin, extent, max } from "d3-array"
import { scaleLinear } from "d3-scale"
import { curveBasis, line } from "d3-shape"

import {
  AXIS_COLOR,
  BAR_FILL,
  CHART_HEIGHT,
  CHART_WIDTH,
  GRID_COLOR,
  HIST_BINS,
  KDE_STROKE,
  LABEL_COLOR
} from "../../model/analysis-charts/constants"
import {
  calculateBandwidth,
  formatNumber,
  kernelDensityEstimator
} from "../../model/analysis-charts/utils"

type Props = {
  rows: AnalysisRow[]
  metric: string
  chartWidth?: number
  chartHeight?: number
}

export const MetricHistogram = ({
  rows,
  metric,
  chartWidth = CHART_WIDTH,
  chartHeight = CHART_HEIGHT
}: Props) => {
  const values = rows
    .map((row) => row[metric])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))

  if (!values.length) {
    return <Text c="dimmed">Нет числовых значений для метрики</Text>
  }

  const [minValue, maxValue] = extent(values) as [number, number]
  const safeMin = Number.isFinite(minValue) ? minValue : 0
  const safeMaxRaw = Number.isFinite(maxValue) ? maxValue : 1
  const safeMax = safeMaxRaw > safeMin ? safeMaxRaw : safeMin + 1

  const xScale = scaleLinear().domain([safeMin, safeMax]).nice()
  const histogram = bin<number, number>()
    .domain(xScale.domain() as [number, number])
    .thresholds(HIST_BINS)
  const histogramData = histogram(values).map((item) => ({
    x0: item.x0 ?? 0,
    x1: item.x1 ?? 0,
    count: item.length
  }))
  const maxCount = Math.max(0, max(histogramData, (item) => item.count) || 0)

  const sampleX = xScale.ticks(60)
  const bandwidth = calculateBandwidth(values, safeMin, safeMax)
  const density = kernelDensityEstimator(values, Math.max(bandwidth, 1e-6), sampleX)
  const maxDensity = Math.max(0, max(density, (item) => item.y) || 0)

  const yScale = scaleLinear().domain([0, maxCount > 0 ? maxCount * 1.1 : 1])
  const densityToCountScale = (densityValue: number) =>
    maxDensity > 0 ? (densityValue / maxDensity) * maxCount : 0
  const yTicks = yScale.ticks(5)
  const xTicks = xScale.ticks(5)
  const maxTickLength = Math.max(...yTicks.map((tick) => formatNumber(tick).length))
  const margin = { top: 10, right: 12, bottom: 36, left: Math.max(48, maxTickLength * 7 + 18) }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom

  xScale.range([0, plotWidth])
  yScale.range([plotHeight, 0])

  const kdeLine = line<{ x: number; y: number }>()
    .x((point) => xScale(point.x))
    .y((point) => yScale(densityToCountScale(point.y)))
    .curve(curveBasis)

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={chartHeight} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
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
          {histogramData.map((item) => {
            const x = xScale(item.x0)
            const width = Math.max(1, xScale(item.x1) - xScale(item.x0) - 1)
            const y = yScale(item.count)
            return (
              <rect
                key={`${metric}:${item.x0}:${item.x1}`}
                fill={BAR_FILL}
                fillOpacity={0.45}
                height={Math.max(0, plotHeight - y)}
                stroke={BAR_FILL}
                strokeWidth={1}
                style={{ cursor: "default" }}
                width={width}
                x={x}
                y={y}
              >
                <title>
                  {`${formatNumber(item.x0)} - ${formatNumber(item.x1)}: ${item.count}`}
                </title>
              </rect>
            )
          })}
          <path d={kdeLine(density) || ""} fill="none" stroke={KDE_STROKE} strokeWidth={2} />
          <line
            x1={0}
            x2={plotWidth}
            y1={plotHeight}
            y2={plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />
          {xTicks.map((tick) => (
            <g key={`xt:${tick}`} transform={`translate(${xScale(tick)}, ${plotHeight})`}>
              <line y2={6} stroke={AXIS_COLOR} strokeWidth={1} />
              <text dy="1.4em" fill={LABEL_COLOR} fontSize={10} textAnchor="middle">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          <line x1={0} x2={0} y1={0} y2={plotHeight} stroke={AXIS_COLOR} strokeWidth={1} />
          {yTicks.map((tick) => (
            <g key={`yt:${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x2={-6} stroke={AXIS_COLOR} strokeWidth={1} />
              <text dx="-0.7em" dy="0.32em" fill={LABEL_COLOR} fontSize={10} textAnchor="end">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          <text
            fill={LABEL_COLOR}
            fontSize={10}
            textAnchor="middle"
            transform={`translate(${-30}, ${plotHeight / 2}) rotate(-90)`}
          >
            Количество
          </text>
          <text
            fill={LABEL_COLOR}
            fontSize={10}
            textAnchor="middle"
            x={plotWidth / 2}
            y={plotHeight + 30}
          >
            Значение метрики
          </text>
        </g>
      </svg>
    </Box>
  )
}
