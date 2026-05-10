import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core"
import { formatCountWithRussianNoun } from "@shared/lib"
import { scaleLinear } from "d3-scale"
import { interpolateYlOrRd } from "d3-scale-chromatic"
import { useState } from "react"

import { sortPairs, toShortPath } from "../model/heatmapPairs"
import {
  HEATMAP_MAX_WORKS,
  type HeatmapArchiveItem,
  usePlagiarismRunView
} from "../model/usePlagiarismRunView"

type Props = {
  runId: string
  analysisDepth?: number
  selectedLevels: string[][]
}

const toDisplayLabel = (value: string): string => {
  const normalized = String(value || "").replace(/\\/g, "/")
  const base = normalized.split("/").filter(Boolean).pop() || normalized
  return base.replace(/^layout-/i, "")
}

const MAX_CELLS_TO_RENDER = 60_000
const ARCHIVE_PREVIEW_HEIGHT = 280

type OpenedMap = {
  id: string
  title: string
  heatmap: HeatmapArchiveItem["heatmap"]
}

const formatArchiveTitle = (item: HeatmapArchiveItem): string => {
  const deepest = [...(item.selectedLevels || [])]
    .reverse()
    .find((values) => (values || []).length > 0)
  if (deepest?.length) {
    return deepest.join(", ")
  }
  return "Карта без фильтров"
}

const formatDate = (value: string | null): string => {
  if (!value) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }
  return parsed.toLocaleString("ru-RU")
}

const formatDuration = (seconds: number | null | undefined): string | null => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null
  }
  const safeSeconds = Math.floor(seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const restSeconds = safeSeconds % 60
  if (minutes <= 0) {
    return `${restSeconds} сек.`
  }
  return `${minutes} мин. ${restSeconds.toString().padStart(2, "0")} сек.`
}

const formatBuildStage = (stage: string | null | undefined): string => {
  if (!stage) {
    return "Считаем тепловую карту"
  }
  if (stage === "Распаковываем выбранные файлы") {
    return "Сканируем архив и извлекаем выбранный срез"
  }
  return stage
}

const formatBuildMeta = (
  status: {
    elapsedSeconds?: number | null
    heartbeatAt?: string | null
  } | null
): string | null => {
  if (!status) {
    return null
  }
  const parts: string[] = []
  const elapsed = formatDuration(status.elapsedSeconds)
  if (elapsed) {
    parts.push(`прошло ${elapsed}`)
  }
  if (status.heartbeatAt) {
    parts.push(`обновлено ${formatDate(status.heartbeatAt)}`)
  }
  return parts.length ? parts.join(" · ") : null
}

const toSafeSvgId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_")

export const HeatmapSvg = ({
  heatmap,
  compact,
  gradientId,
  responsive = false,
  fitContainer = false,
  hideAxisLabels = false,
  onCellHover,
  onCellLeave
}: {
  heatmap: HeatmapArchiveItem["heatmap"]
  compact: boolean
  gradientId: string
  responsive?: boolean
  fitContainer?: boolean
  hideAxisLabels?: boolean
  onCellHover?: (rowIndex: number, colIndex: number) => void
  onCellLeave?: () => void
}) => {
  const labels = heatmap.labels.map(toDisplayLabel)
  const matrix = heatmap.matrix || []
  const size = labels.length

  if (!size) {
    return (
      <Text c="dimmed" size="sm">
        Нет данных для отображения.
      </Text>
    )
  }

  if (size * size > MAX_CELLS_TO_RENDER) {
    return (
      <Text c="dimmed" size="sm">
        Матрица слишком большая для отрисовки ({size}×{size}). Сузьте фильтры.
      </Text>
    )
  }

  const cellSize = compact
    ? size <= 4
      ? 22
      : Math.max(18, Math.min(30, Math.floor(520 / Math.max(1, size))))
    : size <= 4
      ? 26
      : size >= 30
        ? Math.max(10, Math.min(14, Math.floor(560 / Math.max(1, size))))
        : Math.max(14, Math.min(24, Math.floor(1200 / Math.max(1, size))))
  const labelStep = 1
  const visibleLabels = hideAxisLabels
    ? []
    : labels
        .map((label, index) => ({ label, index }))
        .filter((item) => item.index % labelStep === 0)
  const maxLabelLength = hideAxisLabels
    ? 0
    : labels.reduce((acc, label) => Math.max(acc, label.length), 0)
  const estimatedLabelTail = Math.min(320, Math.max(120, maxLabelLength * (compact ? 7 : 8)))
  const leftPad = compact ? (hideAxisLabels ? 16 : 120) : 240
  const topPad = compact ? (hideAxisLabels ? 12 : 20) : 24
  const rightPad = compact ? (hideAxisLabels ? 88 : 86) : 110
  const bottomPad = compact
    ? hideAxisLabels
      ? 16
      : Math.max(130, Math.min(220, Math.floor(estimatedLabelTail * 0.75)))
    : size >= 30
      ? 165
      : Math.max(230, estimatedLabelTail + 56)
  const gridWidth = size * cellSize
  const gridHeight = size * cellSize
  const width = leftPad + gridWidth + rightPad
  const height = topPad + gridHeight + bottomPad
  const colorScale = scaleLinear<string>()
    .domain([0, 100])
    .range([interpolateYlOrRd(0), interpolateYlOrRd(1)])

  const svgProps = responsive
    ? {
        viewBox: `0 0 ${width} ${height}`,
        style: fitContainer
          ? ({ width: "100%", height: "100%", display: "block", margin: "0 auto" } as const)
          : ({ width: "100%", height: "auto", display: "block", margin: "0 auto" } as const)
      }
    : {
        width,
        height,
        style: { display: "block", margin: "0 auto", maxWidth: "100%" } as const
      }

  return (
    <svg {...svgProps}>
      <g transform={`translate(${leftPad}, ${topPad})`}>
        {matrix.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <rect
              key={`${gradientId}:${rowIndex}:${colIndex}`}
              fill={colorScale(cell.avgSimilarity)}
              height={cellSize}
              stroke="var(--mantine-color-body)"
              strokeWidth={1}
              width={cellSize}
              x={colIndex * cellSize}
              y={rowIndex * cellSize}
              onMouseEnter={onCellHover ? () => onCellHover(rowIndex, colIndex) : undefined}
              onMouseLeave={onCellLeave}
            />
          ))
        )}

        {visibleLabels.map(({ label, index }) => (
          <text
            key={`${gradientId}:x:${label}:${index}`}
            fill="var(--mantine-color-text)"
            fontSize={compact ? 10 : size >= 30 ? 9 : 12}
            textAnchor="end"
            transform={`translate(${index * cellSize + cellSize * 0.6}, ${gridHeight + 10}) rotate(-60)`}
          >
            {label}
          </text>
        ))}

        {visibleLabels.map(({ label, index }) => (
          <text
            key={`${gradientId}:y:${label}:${index}`}
            fill="var(--mantine-color-text)"
            fontSize={compact ? 10 : size >= 30 ? 9 : 12}
            textAnchor="end"
            x={-8}
            y={index * cellSize + cellSize * 0.65}
          >
            {label}
          </text>
        ))}

        <defs>
          <linearGradient id={gradientId} x1="0%" x2="0%" y1="100%" y2="0%">
            <stop offset="0%" stopColor={interpolateYlOrRd(0)} />
            <stop offset="100%" stopColor={interpolateYlOrRd(1)} />
          </linearGradient>
        </defs>
      </g>

      <g transform={`translate(${leftPad + gridWidth + 18}, ${topPad})`}>
        <rect fill={`url(#${gradientId})`} height={gridHeight} rx={4} width={14} />
        <text
          fill="var(--mantine-color-text)"
          fontSize={hideAxisLabels ? 9 : 11}
          x={hideAxisLabels ? 20 : 24}
          y={8}
        >
          100%
        </text>
        <text
          fill="var(--mantine-color-text)"
          fontSize={hideAxisLabels ? 9 : 11}
          x={hideAxisLabels ? 20 : 24}
          y={Math.floor(gridHeight / 2) + 4}
        >
          50%
        </text>
        <text
          fill="var(--mantine-color-text)"
          fontSize={hideAxisLabels ? 9 : 11}
          x={hideAxisLabels ? 20 : 24}
          y={gridHeight}
        >
          0%
        </text>
      </g>
    </svg>
  )
}

export function PlagiarismHeatmapSection({ runId, analysisDepth, selectedLevels }: Props) {
  const {
    buildError,
    buildJobStatus,
    filteredFolderCount,
    heatmap,
    heatmapArchive,
    isHistoryLoading,
    isBuildingHeatmap,
    isViewLoading,
    startBuildHeatmap
  } = usePlagiarismRunView({ runId, analysisDepth, selectedLevels })
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)
  const [modalHovered, setModalHovered] = useState<{ row: number; col: number } | null>(null)
  const [openedMap, setOpenedMap] = useState<OpenedMap | null>(null)
  const buildInProgress =
    buildJobStatus?.status === "queued" || buildJobStatus?.status === "running"
  const buildProgressMeta = formatBuildMeta(buildJobStatus)
  const isOverLimit = filteredFolderCount > HEATMAP_MAX_WORKS
  const isTooSmall = filteredFolderCount < 2
  const isBuildButtonDisabled = isBuildingHeatmap || isOverLimit || isTooSmall

  if (isViewLoading) {
    return (
      <Card>
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Card>
    )
  }

  const hoveredCell = (() => {
    if (!heatmap || !heatmap.labels?.length) {
      return null
    }
    if (!hovered) {
      return null
    }
    const labels = heatmap.labels.map(toDisplayLabel)
    const row = (heatmap.matrix || [])[hovered.row]
    const cell = row?.[hovered.col]
    if (!cell) {
      return null
    }
    return {
      rowLabel: labels[hovered.row],
      colLabel: labels[hovered.col],
      ...cell
    }
  })()

  const openedPairs = sortPairs(openedMap?.heatmap.pairs || [])
  const openedHoveredCell = (() => {
    if (!openedMap?.heatmap || !modalHovered) {
      return null
    }
    const labels = openedMap.heatmap.labels.map(toDisplayLabel)
    const row = (openedMap.heatmap.matrix || [])[modalHovered.row]
    const cell = row?.[modalHovered.col]
    if (!cell) {
      return null
    }
    return {
      rowLabel: labels[modalHovered.row],
      colLabel: labels[modalHovered.col],
      ...cell
    }
  })()

  return (
    <Stack gap="md">
      <Card>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={4}>Тепловая карта</Title>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                loading={isBuildingHeatmap}
                disabled={isBuildButtonDisabled}
                onClick={() => void startBuildHeatmap()}
              >
                Построить по текущим фильтрам
              </Button>
            </Group>
          </Group>
          {!isOverLimit ? (
            <>
              <Text c="dimmed" size="sm">
                В выбранном срезе:{" "}
                {formatCountWithRussianNoun(filteredFolderCount, ["папка", "папки", "папок"])}.
                Максимум для тепловой карты: {HEATMAP_MAX_WORKS} работ.
              </Text>
              <Text c="dimmed" size="sm">
                {isTooSmall
                  ? "Нужны минимум две папки с кодом."
                  : "Построение запускается только по кнопке."}
              </Text>
            </>
          ) : null}
          {buildInProgress ? (
            <Stack gap={6}>
              <Progress value={buildJobStatus?.progressPercent ?? 0} />
              {buildJobStatus?.archiveName ? (
                <Text c="dimmed" size="sm">
                  Архив: {buildJobStatus.archiveName}
                </Text>
              ) : null}
              <Text c="dimmed" size="sm">
                {formatBuildStage(buildJobStatus?.stage)}
              </Text>
              {buildProgressMeta ? (
                <Text c="dimmed" size="xs">
                  {buildProgressMeta}
                </Text>
              ) : null}
            </Stack>
          ) : null}
          {isOverLimit ? (
            <Alert color="yellow">
              В выбранном срезе {filteredFolderCount} работ. Для тепловой карты выберите не больше
              {HEATMAP_MAX_WORKS} работ.
            </Alert>
          ) : null}
          {buildError ? <Alert color="red">{buildError}</Alert> : null}
        </Stack>
      </Card>

      {heatmap ? (
        <Card>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Title order={4}>Текущая карта</Title>
              <Button
                size="xs"
                variant="light"
                onClick={() =>
                  setOpenedMap({
                    id: "current",
                    title: "Текущая карта",
                    heatmap
                  })
                }
              >
                Открыть на весь экран
              </Button>
            </Group>
            {hoveredCell ? (
              <Text c="dimmed" size="sm">
                {hoveredCell.rowLabel} ↔ {hoveredCell.colLabel}:{" "}
                {hoveredCell.avgSimilarity.toFixed(2)}% (файлов: {hoveredCell.comparedFiles})
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                Наведите на ячейку, чтобы увидеть детализацию.
              </Text>
            )}
            <div
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() =>
                setOpenedMap({
                  id: "current",
                  title: "Текущая карта",
                  heatmap
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setOpenedMap({
                    id: "current",
                    title: "Текущая карта",
                    heatmap
                  })
                }
              }}
            >
              <HeatmapSvg
                compact
                gradientId="heatmap-current-scale"
                heatmap={heatmap}
                responsive={false}
                onCellHover={(row, col) => setHovered({ row, col })}
                onCellLeave={() => setHovered(null)}
              />
            </div>
          </Stack>
        </Card>
      ) : null}

      <Card>
        <Stack gap="sm">
          <Title order={4}>Архив построенных карт</Title>
          {isHistoryLoading && !heatmapArchive.length ? (
            <Group justify="center" py="lg">
              <Loader size="sm" />
            </Group>
          ) : null}
          {!heatmapArchive.length && !isHistoryLoading ? (
            <Text c="dimmed" size="sm">
              Пока нет сохраненных карт.
            </Text>
          ) : null}
          {heatmapArchive.length ? (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
              {heatmapArchive.map((item) => (
                <Card key={item.id} padding="sm" withBorder style={{ height: "100%" }}>
                  <Stack gap="xs" style={{ height: "100%" }}>
                    <Text fw={500} lineClamp={2} size="sm">
                      {formatArchiveTitle(item)}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {formatDate(item.createdAt)}
                    </Text>
                    <div
                      style={{
                        height: ARCHIVE_PREVIEW_HEIGHT,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setOpenedMap({
                          id: item.id,
                          title: formatArchiveTitle(item),
                          heatmap: item.heatmap
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setOpenedMap({
                            id: item.id,
                            title: formatArchiveTitle(item),
                            heatmap: item.heatmap
                          })
                        }
                      }}
                    >
                      <HeatmapSvg
                        compact
                        gradientId={`heatmap-archive-${toSafeSvgId(item.id)}`}
                        heatmap={item.heatmap}
                        responsive
                        fitContainer
                        hideAxisLabels
                      />
                    </div>
                    <Button
                      size="xs"
                      variant="light"
                      style={{ marginTop: "auto" }}
                      onClick={() =>
                        setOpenedMap({
                          id: item.id,
                          title: formatArchiveTitle(item),
                          heatmap: item.heatmap
                        })
                      }
                    >
                      Открыть на весь экран
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : null}
        </Stack>
      </Card>

      <Modal
        fullScreen
        opened={Boolean(openedMap)}
        title={openedMap?.title || "Тепловая карта"}
        onClose={() => {
          setOpenedMap(null)
          setModalHovered(null)
        }}
      >
        <ScrollArea h="calc(100vh - 120px)" type="auto">
          <Stack gap="sm" pb="md">
            <Text c="dimmed" size="sm">
              Папок в матрице: {openedMap?.heatmap.labels.length || 0}. При больших выборках
              используйте фильтры уровней.
            </Text>
            {openedHoveredCell ? (
              <Text c="dimmed" size="sm">
                {openedHoveredCell.rowLabel} ↔ {openedHoveredCell.colLabel}:{" "}
                {openedHoveredCell.avgSimilarity.toFixed(2)}% (файлов:{" "}
                {openedHoveredCell.comparedFiles})
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                Наведите на ячейку, чтобы увидеть детализацию по паре работ.
              </Text>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                minHeight: 320
              }}
            >
              {openedMap ? (
                <HeatmapSvg
                  compact={false}
                  gradientId={`heatmap-full-${toSafeSvgId(openedMap.id)}`}
                  heatmap={openedMap.heatmap}
                  responsive={false}
                  onCellHover={(row, col) => setModalHovered({ row, col })}
                  onCellLeave={() => setModalHovered(null)}
                />
              ) : null}
            </div>
            <Title order={5}>Наиболее похожие работы</Title>
            {openedPairs.length ? (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Работа 1</Table.Th>
                    <Table.Th>Работа 2</Table.Th>
                    <Table.Th>Среднее сходство</Table.Th>
                    <Table.Th>Общих файлов</Table.Th>
                    <Table.Th>Файлов ≥ 80%</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {openedPairs.map((pair, index) => (
                    <Table.Tr key={`${pair.folder1}:${pair.folder2}:${index}`}>
                      <Table.Td>{toShortPath(pair.folder1)}</Table.Td>
                      <Table.Td>{toShortPath(pair.folder2)}</Table.Td>
                      <Table.Td>{pair.avgSimilarity.toFixed(2)}%</Table.Td>
                      <Table.Td>{pair.comparedFiles}</Table.Td>
                      <Table.Td>{pair.highSimilarityFiles}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed">Не найдено пар для сравнения.</Text>
            )}
          </Stack>
        </ScrollArea>
      </Modal>
    </Stack>
  )
}
