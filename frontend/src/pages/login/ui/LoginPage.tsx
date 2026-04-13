import { LoginForm } from "@features/auth"
import { Card, Container } from "@mantine/core"

export function LoginPage() {
  return (
    <Container size="lg">
      <Card p="xl" radius="md">
        <LoginForm />
      </Card>
    </Container>
  )
}
