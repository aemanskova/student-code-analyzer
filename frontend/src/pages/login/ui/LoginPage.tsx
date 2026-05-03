import { LoginForm, RegisterForm } from "@features/auth"
import { Card, Container, Stack, Title } from "@mantine/core"
import { useState } from "react"

type AuthMode = "login" | "register"

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login")
  const isRegisterMode = mode === "register"

  return (
    <Container size="lg">
      <Card>
        <Stack gap="lg">
          <Title order={3}>{isRegisterMode ? "Регистрация" : "Вход"}</Title>
          {isRegisterMode ? (
            <RegisterForm onLoginClick={() => setMode("login")} />
          ) : (
            <LoginForm onRegisterClick={() => setMode("register")} />
          )}
        </Stack>
      </Card>
    </Container>
  )
}
