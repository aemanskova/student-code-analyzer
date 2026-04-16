import { ArchiveListSection } from "@features/archiveList"
import { Card, Container, Stack, Title } from "@mantine/core"

export function ArchivePage() {
  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card p="md">
          <Title order={3}>Архив анализов</Title>
        </Card>

        <ArchiveListSection />
      </Stack>
    </Container>
  )
}
