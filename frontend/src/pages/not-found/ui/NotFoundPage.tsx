import { Button, Center, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config"
import { NavLink } from "react-router"

export function NotFoundPage() {
  return (
    <Center>
      <Stack align="center">
        <Title order={2}>Страница не найдена</Title>
        <Text c="dimmed">Проверьте адрес или вернитесь к анализу.</Text>
        <Button component={NavLink} to={routes.analysis}>
          К анализу
        </Button>
      </Stack>
    </Center>
  )
}
