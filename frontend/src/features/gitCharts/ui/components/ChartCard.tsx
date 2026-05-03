import { Card, Stack, Text } from "@mantine/core"

type Props = {
  title: React.ReactNode
  children: React.ReactNode
}

export const ChartCard = ({ title, children }: Props) => (
  <Card withBorder>
    <Stack gap="md">
      <Text fw={600} size="sm">
        {title}
      </Text>
      {children}
    </Stack>
  </Card>
)
