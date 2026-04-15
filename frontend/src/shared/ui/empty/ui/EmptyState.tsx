import { Center, Paper, Stack, Text } from "@mantine/core"
import { MagnifyingGlass } from "@phosphor-icons/react"
import type { ReactNode } from "react"

type Props = {
  text: string
  icon?: ReactNode
}

export function EmptyState({ text, icon }: Props) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Center>
        <Stack align="center" gap={6}>
          {icon || <MagnifyingGlass size={22} />}
          <Text c="dimmed" size="sm" ta="center">
            {text}
          </Text>
        </Stack>
      </Center>
    </Paper>
  )
}
