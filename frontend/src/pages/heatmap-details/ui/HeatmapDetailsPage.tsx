import { useGetStandaloneHeatmapDetailsQuery } from "@entities/analysis/api"
import { sortPairs, toShortPath } from "@features/plagiarismHeatmap"
import { HeatmapSvg } from "@features/plagiarismHeatmap/ui/PlagiarismHeatmapSection"
import {
  Card,
  Container,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core"
import { formatCountWithRussianNoun } from "@shared/lib"
import { useState } from "react"
import { useParams } from "react-router"

const formatDate = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }
  return parsed.toLocaleString("ru-RU")
}

export function HeatmapDetailsPage() {
  const { jobId = "" } = useParams()
  const { data, isLoading, isFetching } = useGetStandaloneHeatmapDetailsQuery(jobId, {
    skip: !jobId
  })
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)

  const hoveredCell = (() => {
    if (!data?.plagiarismHeatmap || !hovered) {
      return null
    }
    const labels = data.plagiarismHeatmap.labels || []
    const row = (data.plagiarismHeatmap.matrix || [])[hovered.row]
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
  const pairs = sortPairs(data?.plagiarismHeatmap.pairs || [])

  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Title order={3}>{data?.folder || "Тепловая карта"}</Title>
              {data ? (
                <Text c="dimmed" size="sm">
                  {data.archiveName || "Архив"} ·{" "}
                  {formatCountWithRussianNoun(data.folderCount, ["папка", "папки", "папок"])} ·{" "}
                  {formatDate(data.finishedAt)}
                </Text>
              ) : null}
            </Stack>
          </Group>
        </Card>

        {isLoading || isFetching ? (
          <Card>
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          </Card>
        ) : null}

        {data ? (
          <>
            <Card>
              <Stack gap="sm">
                {hoveredCell ? (
                  <Text c="dimmed" size="sm">
                    {hoveredCell.rowLabel} ↔ {hoveredCell.colLabel}:{" "}
                    {hoveredCell.avgSimilarity.toFixed(2)}% (файлов: {hoveredCell.comparedFiles})
                  </Text>
                ) : (
                  <Text c="dimmed" size="sm">
                    Наведите на ячейку, чтобы увидеть детализацию по паре работ.
                  </Text>
                )}
                <ScrollArea type="auto">
                  <div style={{ display: "flex", justifyContent: "center", minWidth: 720 }}>
                    <HeatmapSvg
                      compact={false}
                      gradientId={`standalone-heatmap-${jobId}`}
                      heatmap={data.plagiarismHeatmap}
                      responsive={false}
                      onCellHover={(row, col) => setHovered({ row, col })}
                      onCellLeave={() => setHovered(null)}
                    />
                  </div>
                </ScrollArea>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Наиболее похожие работы</Title>
                {pairs.length ? (
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
                      {pairs.map((pair, index) => (
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
            </Card>
          </>
        ) : null}
      </Stack>
    </Container>
  )
}
