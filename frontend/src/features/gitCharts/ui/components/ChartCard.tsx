import { Card, Stack, Text } from "@mantine/core"

type Props = {
  title: string
  children: React.ReactNode
}

export const ChartCard = ({ title, children }: Props) => (
  <Card withBorder>
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {title}
      </Text>
      {children}
    </Stack>
  </Card>
)
