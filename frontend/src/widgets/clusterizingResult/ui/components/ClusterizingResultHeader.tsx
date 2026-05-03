import type { ClusterizationDetailsResponse } from "@entities/clusterizing"
import { Card, Group, Stack, Text, Title } from "@mantine/core"

type Props = {
  data: ClusterizationDetailsResponse
}

export function ClusterizingResultHeader({ data }: Props) {
  return (
    <Card p="md">
      <Group align="flex-start" justify="space-between">
        <Stack gap={4}>
          <Title order={4}>Результат кластеризации</Title>
          <Text c="dimmed" size="sm">
            {data.sourcePath || "Архив"} · кластеров: {data.clusters.length} · строк:{" "}
            {data.rowsUsed} · исключено: {data.rowsExcluded} · выбросов: {data.outliersCount}
          </Text>
        </Stack>
      </Group>
    </Card>
  )
}
