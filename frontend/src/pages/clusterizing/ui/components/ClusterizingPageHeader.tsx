import { Button, Card, Group, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { Link } from "react-router"

export function ClusterizingPageHeader() {
  return (
    <Card p="md">
      <Group justify="space-between">
        <Title order={3}>Кластеризация</Title>
        <Button component={Link} to={routes.clusterizingCreate}>
          Кластеризировать работы
        </Button>
      </Group>
    </Card>
  )
}
