import { Card, Container, Stack, Text, Title } from '@mantine/core';
import { useAuthContext } from '@shared/lib';

export function ProfilePage() {
  const { accessToken } = useAuthContext();

  return (
    <Container size="md">
      <Card p="xl" radius="md">
        <Stack>
          <Title order={3}>Личный кабинет</Title>
          <Text c="dimmed">Токен сохранен в localStorage.</Text>
          <Text ff="monospace">{accessToken ? `${accessToken.slice(0, 32)}...` : 'Нет токена'}</Text>
        </Stack>
      </Card>
    </Container>
  );
}
