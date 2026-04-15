import type { ProfileFormValues } from "@features/profile/model"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Card, Grid, Group, Stack, TextInput, Title } from "@mantine/core"
import { useGetMeQuery, useUpdateMeMutation } from "@shared/api/auth"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"

import { DEFAULT_VALUES, validationSchema } from "../model"

const toFormValues = (data?: {
  name: string
  surname: string
  email: string
  github: string | null
}): ProfileFormValues => ({
  name: data?.name ?? "",
  surname: data?.surname ?? "",
  email: data?.email ?? "",
  github: data?.github ?? ""
})

export function ProfileForm() {
  const form = useForm<ProfileFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
    resolver: zodResolver(validationSchema)
  })

  const { data, isFetching } = useGetMeQuery()
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation()

  useEffect(() => {
    if (data) {
      form.reset(toFormValues(data))
    }
  }, [data, form])

  const submitHandler = async (values: ProfileFormValues) => {
    const payload = {
      ...values,
      github: values.github.trim() ? values.github.trim() : null
    }

    const updated = await updateMe(payload).unwrap()
    form.reset(toFormValues(updated))
  }

  return (
    <Card h="100%" w="100%">
      <Stack>
        <Title order={4}>Редактирование данных</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  autoComplete="given-name"
                  error={fieldState.error?.message}
                  label="Имя"
                  placeholder="Введите имя"
                />
              )}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Controller
              control={form.control}
              name="surname"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  autoComplete="family-name"
                  error={fieldState.error?.message}
                  label="Фамилия"
                  placeholder="Введите фамилию"
                />
              )}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  autoComplete="email"
                  error={fieldState.error?.message}
                  label="Email"
                  placeholder="Введите email"
                />
              )}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Controller
              control={form.control}
              name="github"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  error={fieldState.error?.message}
                  label="GitHub"
                  placeholder="Введите username или оставьте пустым"
                />
              )}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="sm">
          <Button
            loading={isUpdating || isFetching}
            onClick={form.handleSubmit(submitHandler)}
            radius="md"
            type="button"
          >
            Сохранить изменения
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
