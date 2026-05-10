import {
  ESLINT_CONFIG_AVAILABLE_LIBRARIES,
  ESLINT_CONFIG_IGNORED_PATHS,
  ESLINT_CONFIG_INFO_TEXT
} from "@features/analysisForm/model"
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  HoverCard,
  ScrollArea,
  Stack,
  Text
} from "@mantine/core"
import { RiErrorWarningLine } from "react-icons/ri"

export function EslintConfigInfoPopover() {
  return (
    <HoverCard width={560} shadow="md" withArrow withinPortal openDelay={150} closeDelay={500}>
      <HoverCard.Target>
        <ActionIcon
          aria-label="Информация об ESLint config"
          color="gray"
          size="sm"
          variant="subtle"
        >
          <RiErrorWarningLine size={18} />
        </ActionIcon>
      </HoverCard.Target>

      <HoverCard.Dropdown style={{ pointerEvents: "auto" }}>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" gap="sm">
            <Text fw={700}>ESLint config</Text>
            <CopyButton value={ESLINT_CONFIG_INFO_TEXT} timeout={1500}>
              {({ copied, copy }) => (
                <Button color={copied ? "green" : "gray"} onClick={copy} size="xs" variant="light">
                  {copied ? "Скопировано" : "Скопировать"}
                </Button>
              )}
            </CopyButton>
          </Group>

          <ScrollArea.Autosize mah={360} type="auto">
            <Stack gap="xs">
              <Text size="sm">
                Используется только для JS и TypeScript-метрик линтера. Поддерживаются flat
                config-файлы <Code>eslint.config.js</Code>, <Code>eslint.config.mjs</Code> и{" "}
                <Code>eslint.config.cjs</Code>.
              </Text>

              <Text size="sm" fw={600}>
                Доступные библиотеки:
              </Text>
              <Group gap={6}>
                {ESLINT_CONFIG_AVAILABLE_LIBRARIES.map((library) => (
                  <Badge key={library} variant="light" color="blue">
                    {library}
                  </Badge>
                ))}
              </Group>

              <Text size="sm">
                Можно использовать конфиги для JavaScript, <Code>browser</Code>/<Code>node</Code>{" "}
                globals, TypeScript recommended, TypeScript strict, Prettier-compatible config и их
                комбинации.
              </Text>

              <Text size="sm">
                Новые npm-пакеты из конфига автоматически не устанавливаются. Если конфиг
                импортирует отсутствующую библиотеку или плагин, ESLint-метрики будут пропущены,
                остальные метрики анализа продолжат считаться.
              </Text>

              <Text size="sm" fw={600}>
                ESLint дополнительно игнорирует:
              </Text>
              <Group gap={6}>
                {ESLINT_CONFIG_IGNORED_PATHS.map((path) => (
                  <Badge key={path} variant="light" color="gray">
                    {path}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  )
}
