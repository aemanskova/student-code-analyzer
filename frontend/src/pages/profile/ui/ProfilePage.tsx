import { Profile } from "@features/profile"
import { Container } from "@mantine/core"

export function ProfilePage() {
  return (
    <Container pb="md" pt="sm" size="lg">
      <Profile />
    </Container>
  )
}
