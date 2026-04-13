import { CommonInfo } from "@features/profile/ui/CommonInfo.tsx"
import { ProfileForm } from "@features/profile/ui/ProfileForm.tsx"
import { Card, Grid, Group, Loader, Stack } from "@mantine/core"
import { useGetMeQuery } from "@shared/api/auth"

export function Profile() {
  const { isLoading } = useGetMeQuery()

  //toDo: переписать не skeleton-ы
  if (isLoading) {
    return (
      <Card p="lg" radius="md">
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Card>
    )
  }

  return (
    <Stack gap="lg">
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <CommonInfo />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <ProfileForm />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
