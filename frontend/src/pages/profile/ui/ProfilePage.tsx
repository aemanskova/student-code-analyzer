import { Profile } from "@features/profile"
import { Card, Container, Stack, Text, Title } from "@mantine/core"

export function ProfilePage() {
  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card p="md">
          <Stack gap={4}>
            <Title order={3}>Профиль</Title>
            <Text c="dimmed" size="sm">
              Управление учетной записью и контактными данными
            </Text>
          </Stack>
        </Card>
        <Profile />
      </Stack>
    </Container>
  )
}
