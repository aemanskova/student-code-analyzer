import {
  REGISTER_DEFAULT_VALUES,
  type RegisterFormValues,
  registerValidationSchema
} from "@features/auth/model"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, Anchor, Box, Button, Group, Stack, Text } from "@mantine/core"
import { useLoginMutation, useRegisterMutation } from "@shared/api/auth"
import { routes } from "@shared/config"
import { getApiErrorMessage } from "@shared/lib"
import { useAuthContext } from "@shared/lib/authContext"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useNavigate } from "react-router"

import { RegisterFields } from "./RegisterFields"

type Props = {
  onLoginClick?: () => void
}

const SUCCESS_MESSAGE = "Пользователь зарегистрирован"

export function RegisterForm({ onLoginClick }: Props) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<RegisterFormValues>({
    defaultValues: REGISTER_DEFAULT_VALUES,
    mode: "onBlur",
    resolver: zodResolver(registerValidationSchema)
  })
  const { login } = useAuthContext()
  const navigate = useNavigate()
  const [registerUser, { isLoading: isRegistering }] = useRegisterMutation()
  const [loginUser, { isLoading: isLoggingIn }] = useLoginMutation()

  const submitHandler = async (values: RegisterFormValues) => {
    setError(null)
    try {
      const github = values.github.trim()
      const response = await registerUser({ ...values, github: github || undefined }).unwrap()
      if (response.message !== SUCCESS_MESSAGE) {
        setError(response.message || "Не удалось зарегистрироваться.")
        return
      }
      const tokens = await loginUser({
        identifier: values.email,
        password: values.password
      }).unwrap()
      if (tokens.accessToken && tokens.refreshToken) {
        login(tokens.accessToken, tokens.refreshToken)
        navigate(routes.profile)
      }
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Не удалось зарегистрироваться."))
    }
  }

  return (
    <FormProvider {...form}>
      <Box>
        <Stack gap="md">
          <RegisterFields />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button loading={isRegistering || isLoggingIn} onClick={form.handleSubmit(submitHandler)}>
            Зарегистрироваться
          </Button>
          {onLoginClick ? (
            <Group gap={4} justify="center">
              <Text c="dimmed" size="sm">
                Уже есть аккаунт?
              </Text>
              <Anchor component="button" size="sm" type="button" onClick={onLoginClick}>
                Войти
              </Anchor>
            </Group>
          ) : null}
        </Stack>
      </Box>
    </FormProvider>
  )
}
