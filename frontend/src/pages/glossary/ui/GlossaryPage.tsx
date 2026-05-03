import { GLOSSARY_SECTIONS, type GlossarySectionKey, GlossaryTable } from "@entities/glossary"
import { Card, Container, Stack, Tabs, Title } from "@mantine/core"
import { useState } from "react"

const defaultSection: GlossarySectionKey = "html"

export function GlossaryPage() {
  const [section, setSection] = useState<GlossarySectionKey>(defaultSection)

  const handleTabChange = (value: string | null) => {
    if (value) {
      setSection(value as GlossarySectionKey)
    }
  }

  return (
    <Container py="md" size="xl" style={{ overflow: "hidden" }}>
      <Stack gap="md">
        <Card p="md">
          <Title order={3}>Глоссарий</Title>
        </Card>

        <Card p="md" style={{ overflow: "hidden" }}>
          <Tabs onChange={handleTabChange} value={section}>
            <Tabs.List>
              {GLOSSARY_SECTIONS.map((item) => (
                <Tabs.Tab key={item.key} value={item.key}>
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            <Tabs.Panel pt="md" style={{ overflow: "hidden" }} value={section}>
              <GlossaryTable section={section} />
            </Tabs.Panel>
          </Tabs>
        </Card>
      </Stack>
    </Container>
  )
}
