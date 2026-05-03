import { CommonInfo } from "@features/profile/ui/CommonInfo.tsx"
import { ProfileForm } from "@features/profile/ui/ProfileForm.tsx"
import { Card, Grid, Group, Loader, Stack } from "@mantine/core"
import { useGetMeQuery } from "@shared/api/auth"

export function Profile() {
  const { isLoading } = useGetMeQuery()

  //toDo: переписать не skeleton-ы
  if (isLoading) {
    return (
      <Card>
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Card>
    )
  }

  return (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }} style={{ display: "flex" }}>
          <CommonInfo />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }} style={{ display: "flex" }}>
          <ProfileForm />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
