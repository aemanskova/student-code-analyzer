import { ArchiveListSection } from "@features/archiveList"
import { Card, Container, Stack, Title } from "@mantine/core"

export function ArchivePage() {
  return (
    <Container size="xl">
      <Stack gap="sm">
        <Card p="sm">
          <Title order={3}>Архив анализов</Title>
        </Card>

        <ArchiveListSection />
      </Stack>
    </Container>
  )
}
