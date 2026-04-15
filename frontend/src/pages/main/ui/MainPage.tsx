import "./MainPage.css"

import { Button, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { useState } from "react"
import { NavLink } from "react-router"

const HIST_VALUES = [22, 10, 32, 46, 58, 62, 54, 40, 28, 18, 8, 5]

export function MainPage() {
  const [activeBar, setActiveBar] = useState<number>(5)

  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <Card className="main-page-hero" p="xl" radius="lg">
          <Stack align="center" gap="md">
            <Title order={1} style={{ lineHeight: 1.1, maxWidth: 920, textAlign: "center" }}>
              Инструмент для анализа качества кода студенческих работ
            </Title>
            <Text c="dimmed" maw={860} size="lg" ta="center">
              Платформа автоматически проверяет архивы проектов, собирает метрики качества кода и
              Git, показывает динамику и сохраняет отчеты в архив для сравнения результатов.
            </Text>
            <Group justify="center">
              <Button component={NavLink} size="md" to={routes.analysis}>
                Перейти к анализу
              </Button>
            </Group>

            <Card className="main-page-visual" p="lg" radius="md">
              <Stack gap="md">
                <svg className="main-page-chart" viewBox="0 0 920 360">
                  <g transform="translate(48, 18)">
                    {HIST_VALUES.map((value, index) => {
                      const x = index * 66
                      const h = value * 4
                      const y = 290 - h
                      return (
                        <rect
                          key={`bar:${index}`}
                          className={activeBar === index ? "bar active" : "bar"}
                          height={h}
                          width={46}
                          x={x}
                          y={y}
                          onMouseEnter={() => setActiveBar(index)}
                        />
                      )
                    })}
                    <path
                      className="line"
                      d="M 12 260 C 80 184, 120 96, 190 70 C 264 44, 328 62, 392 120 C 446 166, 500 204, 560 214 C 620 224, 688 210, 768 230"
                    />
                    <line className="axis" x1={0} x2={812} y1={290} y2={290} />
                    <line className="axis" x1={0} x2={0} y1={10} y2={290} />
                  </g>
                </svg>
              </Stack>
            </Card>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
