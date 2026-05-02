import { ArchiveListSection } from "@features/archiveList"
import { Button, Card, Container, Group, Stack, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { Link } from "react-router"

export function ArchivePage() {
  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card p="md">
          <Group justify="space-between">
            <Title order={3}>Анализ</Title>
            <Button component={Link} to={routes.analysis}>
              Запустить анализ
            </Button>
          </Group>
        </Card>

        <ArchiveListSection />
      </Stack>
    </Container>
  )
}
