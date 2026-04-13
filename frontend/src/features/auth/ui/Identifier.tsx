import { TextInput } from "@mantine/core"
import { Controller, useFormContext } from "react-hook-form"

import type { LoginFormValues } from "../model"

export function Identifier() {
  const {
    control,
    formState: { errors }
  } = useFormContext<LoginFormValues>()

  return (
    <Controller
      control={control}
      name="identifier"
      render={({ field }) => (
        <TextInput
          {...field}
          error={errors.identifier?.message}
          label="Электронная почта или GitHub"
          placeholder="ivan@example.com"
          required
        />
      )}
    />
  )
}
