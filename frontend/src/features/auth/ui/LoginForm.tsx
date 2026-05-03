import {
  LOGIN_DEFAULT_VALUES,
  type LoginFormValues,
  loginValidationSchema
} from "@features/auth/model"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, Anchor, Box, Button, Group, Stack, Text } from "@mantine/core"
import { useLoginMutation } from "@shared/api/auth"
import { routes } from "@shared/config"
import { getApiErrorMessage, useAuth } from "@shared/lib"
import { useAuthContext } from "@shared/lib/authContext"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useLocation, useNavigate } from "react-router"

import { Identifier } from "./Identifier"
import { Password } from "./Password"

type Props = {
  onRegisterClick?: () => void
}

export function LoginForm({ onRegisterClick }: Props) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginFormValues>({
    defaultValues: LOGIN_DEFAULT_VALUES,
    mode: "onBlur",
    resolver: zodResolver(loginValidationSchema)
  })

  const { login } = useAuthContext()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [trigger, { isLoading }] = useLoginMutation()

  const submitHandler = async (values: LoginFormValues) => {
    setError(null)
    try {
      const res = await trigger(values).unwrap()
      if (res.accessToken && res.refreshToken) {
        login(res.accessToken, res.refreshToken)
        navigate(
          location.state?.fromUrl && location.state?.fromUrl !== routes.login
            ? location.state?.fromUrl
            : routes.profile
        )
      }
    } catch (caught) {
      setError(
        getApiErrorMessage(caught, "Не удалось войти. Проверьте данные и повторите попытку.")
      )
    }
  }

  return (
    <FormProvider {...form}>
      <Box>
        <Stack gap="md">
          <Identifier />
          <Password />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button loading={isLoading} onClick={form.handleSubmit(submitHandler)}>
            Войти
          </Button>
          {!isAuthenticated && onRegisterClick ? (
            <Group gap={4} justify="center">
              <Text c="dimmed" size="sm">
                Нет аккаунта?
              </Text>
              <Anchor component="button" size="sm" type="button" onClick={onRegisterClick}>
                Зарегистрируйтесь
              </Anchor>
            </Group>
          ) : null}
        </Stack>
      </Box>
    </FormProvider>
  )
}
