import {
  Avatar,
  Badge,
  Box,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core"
import { useGetMeQuery } from "@shared/api/auth"
import dayjs from "dayjs"

const getInitials = (name?: string, surname?: string): string => {
  const first = name?.trim()?.[0] || ""
  const second = surname?.trim()?.[0] || ""
  const initials = `${first}${second}`.trim().toUpperCase()
  return initials || "U"
}

export function CommonInfo() {
  const { data } = useGetMeQuery()

  return (
    <Card h="100%" p="lg" w="100%" withBorder>
      <Stack gap="lg">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Group align="center">
            <Avatar color="myColor.6" radius="xl" size={52} variant="filled">
              {getInitials(data?.name, data?.surname)}
            </Avatar>
            <Stack gap={2}>
              <Title order={4}>
                {data?.name || data?.surname
                  ? `${data?.name ?? ""} ${data?.surname ?? ""}`
                  : "Профиль"}
              </Title>
              <Text c="dimmed" size="sm">
                {data?.email ?? "Основная информация"}
              </Text>
            </Stack>
          </Group>
          <Badge color={data?.isActive ? "teal" : "gray"} radius="sm" variant="light">
            {data?.isActive ? "Активен" : "Неактивен"}
          </Badge>
        </Group>

        <Divider />
        <Title order={5}>Информация</Title>

        <SimpleGrid cols={1} spacing="md">
          <Box>
            <Text c="dimmed" fz="xs" tt="uppercase" fw={600}>
              Роль
            </Text>
            <Text fw={600}>{data?.role?.name ?? "—"}</Text>
          </Box>
          <Divider />
          <Box>
            <Text c="dimmed" fz="xs" tt="uppercase" fw={600}>
              Создан
            </Text>
            <Text fw={600}>
              {data?.createdAt ? dayjs(data?.createdAt).format("DD.MM.YYYY") : "-"}
            </Text>
          </Box>
          <Divider />
          <Box>
            <Text c="dimmed" fz="xs" tt="uppercase" fw={600}>
              Обновлён
            </Text>
            <Text fw={600}>
              {data?.updatedAt ? dayjs(data?.updatedAt).format("DD.MM.YYYY") : "-"}
            </Text>
          </Box>
        </SimpleGrid>
      </Stack>
    </Card>
  )
}
