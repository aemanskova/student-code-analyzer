import { PasswordInput } from '@mantine/core';
import { Controller, useFormContext } from 'react-hook-form';

import type { LoginFormValues } from '../model';

export function Password() {
  const {
    control,
    formState: { errors },
  } = useFormContext<LoginFormValues>();

  return (
    <Controller
      control={control}
      name="password"
      render={({ field }) => (
        <PasswordInput
          {...field}
          error={errors.password?.message}
          label="Пароль"
          placeholder="********"
          required
        />
      )}
    />
  );
}
