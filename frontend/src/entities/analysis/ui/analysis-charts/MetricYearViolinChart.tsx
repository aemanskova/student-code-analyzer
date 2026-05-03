import type { AnalysisRow } from "@entities/analysis/api"
import { Box, Group, Text } from "@mantine/core"
import { bin, extent, max } from "d3-array"
import { scaleBand, scaleLinear } from "d3-scale"
import { area, curveBasis } from "d3-shape"

import {
  extractMetricYearPoints,
  getYearChartSpecialties,
  type MetricYearPoint
} from "../../model/analysis-charts"
import {
  AXIS_COLOR,
  BOXEN_COLORS,
  CHART_HEIGHT,
  CHART_WIDTH,
  GRID_COLOR,
  LABEL_COLOR
} from "../../model/analysis-charts/constants"
import { formatNumber, quantile } from "../../model/analysis-charts/utils"

type Props = {
  rows: AnalysisRow[]
  metric: string
  analysisDepth?: number
  gitYearResolver?: (pathValue: string) => string | null
  specialties?: string[]
  chartWidth?: number
  chartHeight?: number
}

type BoxPlotValue = {
  year: string
  specialty: string
  median: number
  values: number[]
}

const buildBoxPlotValues = (points: MetricYearPoint[], specialties: string[]): BoxPlotValue[] => {
  const valuesByKey = new Map<string, number[]>()
  for (const point of points) {
    const key = `${point.year}:${point.specialty}`
    const values = valuesByKey.get(key) || []
    values.push(point.value)
    valuesByKey.set(key, values)
  }

  return Array.from(valuesByKey.entries())
    .map(([key, values]) => {
      const [year, specialty] = key.split(":")
      const sorted = values.sort((a, b) => a - b)
      return {
        year,
        specialty,
        median: quantile(sorted, 0.5),
        values: sorted
      }
    })
    .sort((a, b) => {
      const yearCompare = Number(a.year) - Number(b.year)
      return yearCompare || specialties.indexOf(a.specialty) - specialties.indexOf(b.specialty)
    })
}

export const YearChartLegend = ({ specialties }: { specialties: string[] }) => {
  if (!specialties.length) {
    return null
  }

  return (
    <Group gap="md" wrap="wrap">
      {specialties.map((specialty, index) => (
        <Group key={specialty} gap="xs">
          <Box
            h={8}
            w={14}
            style={{
              backgroundColor: BOXEN_COLORS[index % BOXEN_COLORS.length],
              borderRadius: 2
            }}
          />
          <Text size="xs">{specialty}</Text>
        </Group>
      ))}
    </Group>
  )
}

export const MetricYearViolinChart = ({
  rows,
  metric,
  analysisDepth,
  gitYearResolver,
  specialties: sharedSpecialties,
  chartWidth = CHART_WIDTH,
  chartHeight = CHART_HEIGHT
}: Props) => {
  const points = extractMetricYearPoints(rows, metric, analysisDepth, gitYearResolver)

  if (!points.length) {
    return <Text c="dimmed">Нет данных для графика по годам</Text>
  }

  const years = Array.from(new Set(points.map((item) => item.year))).sort(
    (a, b) => Number(a) - Number(b)
  )
  const specialties = sharedSpecialties?.length
    ? sharedSpecialties
    : getYearChartSpecialties(rows, [metric], analysisDepth, gitYearResolver)
  const boxData = buildBoxPlotValues(points, specialties)

  const valuesExtent = extent(points.map((item) => item.value))
  const minValue = Number.isFinite(valuesExtent[0]) ? Number(valuesExtent[0]) : 0
  const maxValue = Number.isFinite(valuesExtent[1]) ? Number(valuesExtent[1]) : 1
  const safeMax = maxValue > minValue ? maxValue : minValue + 1
  const yTicks = scaleLinear().domain([minValue, safeMax]).nice().ticks(5)
  const maxTickLength = Math.max(...yTicks.map((tick) => formatNumber(tick).length))
  const margin = { top: 12, right: 12, bottom: 46, left: Math.max(48, maxTickLength * 7 + 18) }
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom

  const xYear = scaleBand<string>().domain(years).range([0, plotWidth]).padding(0.2)
  const xSpecialty = scaleBand<string>()
    .domain(specialties)
    .range([0, xYear.bandwidth()])
    .padding(0.35)
  const y = scaleLinear().domain([minValue, safeMax]).nice().range([plotHeight, 0])
  const valueBinner = bin<number, number>()
    .domain(y.domain() as [number, number])
    .thresholds(20)
  const globalMaxBinCount = Math.max(
    1,
    max(boxData, (item) => max(valueBinner(item.values), (bucket) => bucket.length) || 0) || 1
  )

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={chartHeight} width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {yTicks.map((tick) => (
            <line
              key={`grid:${tick}`}
              x1={0}
              x2={plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {boxData.map((item) => {
            const specialtyIndex = specialties.indexOf(item.specialty)
            const x = (xYear(item.year) || 0) + (xSpecialty(item.specialty) || 0)
            const width = Math.max(6, xSpecialty.bandwidth())
            const center = x + width / 2
            const color = BOXEN_COLORS[Math.max(0, specialtyIndex) % BOXEN_COLORS.length]
            const bins = valueBinner(item.values).filter((bucket) => bucket.length > 0)
            const maxHalfWidth = Math.max(2, width * 0.45)
            const areaPoints = bins.flatMap((bucket, index) => {
              const y0 = bucket.x0 ?? item.values[0] ?? minValue
              const y1 = bucket.x1 ?? item.values[item.values.length - 1] ?? maxValue
              const midpoint = (y0 + y1) / 2
              const bucketWidth = (bucket.length / globalMaxBinCount) * maxHalfWidth
              const points = [{ value: midpoint, width: bucketWidth }]
              if (index === 0) {
                points.unshift({ value: y0, width: 0 })
              }
              if (index === bins.length - 1) {
                points.push({ value: y1, width: 0 })
              }
              return points
            })
            const violinArea = area<{ value: number; width: number }>()
              .x0((point) => center - point.width)
              .x1((point) => center + point.width)
              .y((point) => y(point.value))
              .curve(curveBasis)

            return (
              <g key={`${item.year}:${item.specialty}`} style={{ cursor: "default" }}>
                <title>
                  {`${item.year}, ${item.specialty}: median ${formatNumber(item.median)}, n ${item.values.length}`}
                </title>
                <path
                  d={violinArea(areaPoints) || ""}
                  fill={color}
                  fillOpacity={0.28}
                  stroke={color}
                  strokeWidth={1}
                />
                <line
                  stroke={color}
                  strokeWidth={2}
                  x1={center - Math.min(8, width * 0.45)}
                  x2={center + Math.min(8, width * 0.45)}
                  y1={y(item.median)}
                  y2={y(item.median)}
                />
              </g>
            )
          })}
          <line
            x1={0}
            x2={plotWidth}
            y1={plotHeight}
            y2={plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />
          {years.map((year) => {
            const center = (xYear(year) || 0) + xYear.bandwidth() / 2
            return (
              <g key={`year:${year}`} transform={`translate(${center}, ${plotHeight})`}>
                <line y2={6} stroke={AXIS_COLOR} strokeWidth={1} />
                <text dy="1.4em" fill={LABEL_COLOR} fontSize={10} textAnchor="middle">
                  {year}
                </text>
              </g>
            )
          })}
          <line x1={0} x2={0} y1={0} y2={plotHeight} stroke={AXIS_COLOR} strokeWidth={1} />
          {yTicks.map((tick) => (
            <g key={`tick:${tick}`} transform={`translate(0, ${y(tick)})`}>
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
            x={plotWidth / 2}
            y={plotHeight + 30}
          >
            Год
          </text>
        </g>
      </svg>
    </Box>
  )
}
