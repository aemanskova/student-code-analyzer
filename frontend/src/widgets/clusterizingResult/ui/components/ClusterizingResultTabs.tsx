import { Tabs } from "@mantine/core"
import { ChartBarIcon, ChartLineUpIcon, TableIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"

type Props = {
  dashboard: React.ReactNode
  exceptions: React.ReactNode
  groups: React.ReactNode
  table: React.ReactNode
}

export function ClusterizingResultTabs({ dashboard, exceptions, groups, table }: Props) {
  const [tab, setTab] = useState<string | null>("dashboard")

  return (
    <Tabs keepMounted={false} value={tab} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab leftSection={<ChartLineUpIcon size={16} />} value="dashboard">
          Дэшборд
        </Tabs.Tab>
        <Tabs.Tab leftSection={<TableIcon size={16} />} value="table">
          Таблица
        </Tabs.Tab>
        <Tabs.Tab leftSection={<ChartBarIcon size={16} />} value="groups">
          Распределение по группам
        </Tabs.Tab>
        <Tabs.Tab leftSection={<WarningCircleIcon size={16} />} value="exceptions">
          Исключения и выбросы
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel pt="md" value="dashboard">
        {dashboard}
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="table">
        {table}
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="groups">
        {groups}
      </Tabs.Panel>
      <Tabs.Panel pt="md" value="exceptions">
        {exceptions}
      </Tabs.Panel>
    </Tabs>
  )
}
