import { Group, Paper, Text } from "@mantine/core"
import { Info } from "@phosphor-icons/react"
import type { ReactNode } from "react"

type Props = {
  text: string
  icon?: ReactNode
}

export function InfoNotice({ text, icon }: Props) {
  return (
    <Paper bg="blue.0" c="blue.9" p="sm" radius="md" withBorder>
      <Group align="flex-start" gap="md" wrap="nowrap">
        {icon || <Info size={16} style={{ marginTop: 2 }} />}
        <Text size="sm">{text}</Text>
      </Group>
    </Paper>
  )
}
