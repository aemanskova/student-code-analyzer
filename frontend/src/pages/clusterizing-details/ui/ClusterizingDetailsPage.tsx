import { useGetClusterizationDetailsQuery } from "@entities/clusterizing"
import { Card, Container, Group, Loader, Stack, Text } from "@mantine/core"
import { ClusterizingResultView } from "@widgets/clusterizingResult"
import { useParams } from "react-router"

export function ClusterizingDetailsPage() {
  const { jobId = "" } = useParams()
  const { data, isFetching, isLoading } = useGetClusterizationDetailsQuery(jobId, {
    skip: !jobId
  })

  return (
    <Container py="md" size="xl">
      {isLoading || isFetching ? (
        <Card>
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        </Card>
      ) : data ? (
        <ClusterizingResultView data={data} />
      ) : (
        <Stack>
          <Text c="dimmed">Кластеризация не найдена.</Text>
        </Stack>
      )}
    </Container>
  )
}
