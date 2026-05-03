import { Grid, PasswordInput, TextInput } from "@mantine/core"
import { Controller, useFormContext } from "react-hook-form"

import type { RegisterFormValues } from "../model"

export function RegisterFields() {
  const { control } = useFormContext<RegisterFormValues>()

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              autoComplete="given-name"
              error={fieldState.error?.message}
              label="Имя"
              placeholder="Введите имя"
              required
            />
          )}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Controller
          control={control}
          name="surname"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              autoComplete="family-name"
              error={fieldState.error?.message}
              label="Фамилия"
              placeholder="Введите фамилию"
              required
            />
          )}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              autoComplete="email"
              error={fieldState.error?.message}
              label="Email"
              placeholder="ivan@example.com"
              required
            />
          )}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Controller
          control={control}
          name="github"
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              autoComplete="username"
              error={fieldState.error?.message}
              label="GitHub"
              placeholder="username или оставьте пустым"
            />
          )}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              error={fieldState.error?.message}
              label="Пароль"
              placeholder="********"
              required
            />
          )}
        />
      </Grid.Col>
    </Grid>
  )
}
