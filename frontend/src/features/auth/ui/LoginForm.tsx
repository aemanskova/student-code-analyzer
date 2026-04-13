import { DEFAULT_VALUES, type LoginFormValues, validationSchema } from '@features/auth/model';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack } from '@mantine/core';
import { useLoginMutation } from '@shared/api/auth';
import { routes } from '@shared/config';
import { useAuthContext } from '@shared/lib/authContext';
import { getApiErrorMessage } from '@shared/lib';
import { FormProvider, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';

import { Identifier } from './Identifier';
import { Password } from './Password';

export function LoginForm() {
  const form = useForm<LoginFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
    resolver: zodResolver(validationSchema),
  });

  const { login } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [trigger, { isLoading, error }] = useLoginMutation();

  const submitHandler = async (values: LoginFormValues) => {
    const res = await trigger(values).unwrap();
    if (res.accessToken) {
      login(res.accessToken);
      navigate(
        location.state?.fromUrl && location.state?.fromUrl !== routes.login
          ? location.state?.fromUrl
          : routes.profile,
      );
    }
  };

  return (
    <FormProvider {...form}>
      <Box>
        <Stack gap="md">
          <Identifier />
          <Password />
          {error && (
            <Alert color="red">
              {getApiErrorMessage(error, 'Ошибка авторизации. Проверьте логин и пароль.')}
            </Alert>
          )}
          <Button loading={isLoading} onClick={form.handleSubmit(submitHandler)}>
            Войти
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  );
}
