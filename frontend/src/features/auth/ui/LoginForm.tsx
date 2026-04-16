import { DEFAULT_VALUES, type LoginFormValues, validationSchema } from "@features/auth/model"
import { zodResolver } from "@hookform/resolvers/zod"
import { Box, Button, Stack } from "@mantine/core"
import { useLoginMutation } from "@shared/api/auth"
import { routes } from "@shared/config"
import { useAuthContext } from "@shared/lib/authContext"
import { FormProvider, useForm } from "react-hook-form"
import { useLocation, useNavigate } from "react-router"

import { Identifier } from "./Identifier"
import { Password } from "./Password"

export function LoginForm() {
  const form = useForm<LoginFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
    resolver: zodResolver(validationSchema)
  })

  const { login } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()

  const [trigger, { isLoading }] = useLoginMutation()

  const submitHandler = async (values: LoginFormValues) => {
    const res = await trigger(values).unwrap()
    if (res.accessToken && res.refreshToken) {
      login(res.accessToken, res.refreshToken)
      navigate(
        location.state?.fromUrl && location.state?.fromUrl !== routes.login
          ? location.state?.fromUrl
          : routes.profile
      )
    }
  }

  return (
    <FormProvider {...form}>
      <Box>
        <Stack gap="md">
          <Identifier />
          <Password />
          <Button loading={isLoading} onClick={form.handleSubmit(submitHandler)}>
            Войти
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  )
}
