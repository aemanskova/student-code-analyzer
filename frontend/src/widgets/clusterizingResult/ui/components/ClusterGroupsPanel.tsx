import {
  ClusterGroupDistributionChart,
  type ClusterizationDetailsResponse,
  getScopeDisplayName
} from "@entities/clusterizing"
import { Card, Stack, Table, Text } from "@mantine/core"

type Props = {
  data: ClusterizationDetailsResponse
}

export function ClusterGroupsPanel({ data }: Props) {
  return (
    <Stack gap="md">
      <Card withBorder>
        <Stack gap="md">
          <Text fw={600}>Доли кластеров внутри каждой группы</Text>
          <Table.ScrollContainer minWidth={720}>
            <Table striped withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Группа</Table.Th>
                  <Table.Th>Всего</Table.Th>
                  {data.clusters.map((cluster) => (
                    <Table.Th key={cluster}>Кластер {cluster}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.clusterSharesByGroup.map((row) => (
                  <Table.Tr key={row.groupPath}>
                    <Table.Td>{getScopeDisplayName(row.groupPath)}</Table.Td>
                    <Table.Td>{row.total}</Table.Td>
                    {data.clusters.map((cluster) => (
                      <Table.Td key={`${row.groupPath}:${cluster}`}>
                        {((row.shares[String(cluster)] || 0) * 100).toFixed(1)}%
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack gap="md">
          <Text fw={600}>Распределение групп по кластерам</Text>
          <ClusterGroupDistributionChart data={data.groupDistributionByCluster} />
        </Stack>
      </Card>
    </Stack>
  )
}
