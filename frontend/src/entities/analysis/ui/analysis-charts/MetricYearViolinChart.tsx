import type { AnalysisRow } from "@entities/analysis/api"
import { Box, Group, Text } from "@mantine/core"
import { bin, extent, max } from "d3-array"
import { scaleBand, scaleLinear } from "d3-scale"
import { area, curveBasis } from "d3-shape"

import {
  AXIS_COLOR,
  BOXEN_COLORS,
  CHART_HEIGHT,
  CHART_WIDTH,
  GRID_COLOR,
  LABEL_COLOR
} from "../../model/analysis-charts/constants"
import {
  extractYear,
  formatNumber,
  getScopeDisplayName,
  getScopePath,
  quantile
} from "../../model/analysis-charts/utils"

type Props = {
  rows: AnalysisRow[]
  metric: string
  analysisDepth?: number
  gitYearResolver?: (pathValue: string) => string | null
}

type MetricPoint = { year: string; specialty: string; value: number }

const extractPoints = (
  rows: AnalysisRow[],
  metric: string,
  analysisDepth?: number,
  gitYearResolver?: (pathValue: string) => string | null
): MetricPoint[] =>
  rows
    .map((row) => {
      const rawValue = row[metric]
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        return null
      }
      const resolvedYear = extractYear(row, gitYearResolver)
      if (resolvedYear === "Без года") {
        return null
      }
      const scopePath = getScopePath(row.path, analysisDepth)
      return {
        year: resolvedYear,
        specialty: getScopeDisplayName(scopePath || "Без подпапки") || "Без подпапки",
        value: rawValue
      }
    })
    .filter((item): item is MetricPoint => Boolean(item))

export const MetricYearViolinChart = ({ rows, metric, analysisDepth, gitYearResolver }: Props) => {
  const margin = { top: 12, right: 12, bottom: 46, left: 40 }
  const plotWidth = CHART_WIDTH - margin.left - margin.right
  const plotHeight = CHART_HEIGHT - margin.top - margin.bottom
  const points = extractPoints(rows, metric, analysisDepth, gitYearResolver)

  if (!points.length) {
    return <Text c="dimmed">Нет данных для графика по годам</Text>
  }

  const years = Array.from(new Set(points.map((item) => item.year))).sort(
    (a, b) => Number(a) - Number(b)
  )
  const specialties = Array.from(new Set(points.map((item) => item.specialty))).sort((a, b) =>
    a.localeCompare(b)
  )

  const valuesExtent = extent(points.map((item) => item.value))
  const minValue = Number.isFinite(valuesExtent[0]) ? Number(valuesExtent[0]) : 0
  const maxValue = Number.isFinite(valuesExtent[1]) ? Number(valuesExtent[1]) : 1
  const safeMax = maxValue > minValue ? maxValue : minValue + 1

  const xYear = scaleBand<string>().domain(years).range([0, plotWidth]).padding(0.2)
  const xSpecialty = scaleBand<string>()
    .domain(specialties)
    .range([0, xYear.bandwidth()])
    .padding(0.35)
  const y = scaleLinear().domain([minValue, safeMax]).nice().range([plotHeight, 0])
  const yTicks = y.ticks(5)
  const valueBinner = bin<number, number>()
    .domain(y.domain() as [number, number])
    .thresholds(20)

  const globalMaxBinCount = years.reduce((global, year) => {
    return Math.max(
      global,
      ...specialties.map((specialty) => {
        const values = points
          .filter((item) => item.year === year && item.specialty === specialty)
          .map((item) => item.value)
        return values.length ? max(valueBinner(values), (bucket) => bucket.length) || 0 : 0
      })
    )
  }, 0)

  const toHalfWidth = (count: number, bandWidth: number) => {
    const maxHalf = Math.max(2, bandWidth * 0.45)
    return globalMaxBinCount > 0 ? (count / globalMaxBinCount) * maxHalf : 0
  }

  return (
    <Box style={{ overflowX: "auto" }}>
      <svg height={CHART_HEIGHT} width="100%" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
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
          {years.map((year) =>
            specialties.map((specialty, index) => {
              const values = points
                .filter((item) => item.year === year && item.specialty === specialty)
                .map((item) => item.value)
                .sort((a, b) => a - b)
              if (!values.length) {
                return null
              }
              const bins = valueBinner(values)
              const medianValue = quantile(values, 0.5)
              const x = (xYear(year) || 0) + (xSpecialty(specialty) || 0)
              const width = Math.max(6, xSpecialty.bandwidth())
              const center = x + width / 2
              const color = BOXEN_COLORS[index % BOXEN_COLORS.length]
              const violinArea = area<{ y: number; width: number }>()
                .x0((point) => center - point.width)
                .x1((point) => center + point.width)
                .y((point) => y(point.y))
                .curve(curveBasis)
              const pointsForArea = bins.map((item) => ({
                y: ((item.x0 ?? 0) + (item.x1 ?? 0)) / 2,
                width: toHalfWidth(item.length, width)
              }))
              return (
                <g key={`${year}:${specialty}`}>
                  <path
                    d={violinArea(pointsForArea) || ""}
                    fill={color}
                    fillOpacity={0.28}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <line
                    x1={center - 6}
                    x2={center + 6}
                    y1={y(medianValue)}
                    y2={y(medianValue)}
                    stroke={color}
                    strokeWidth={2}
                  />
                </g>
              )
            })
          )}
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
      <Group gap="md" mt={6} wrap="wrap">
        {specialties.map((specialty, index) => (
          <Group key={specialty} gap="md">
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
    </Box>
  )
}
