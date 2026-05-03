import { Text } from "@mantine/core"
import { DataTable, type VirtualizedColumn } from "@shared/ui"

import { type GlossaryMetric, type GlossarySectionKey, useGetGlossaryMetricsQuery } from "../api"

type Props = {
  section: GlossarySectionKey
}

const glossaryRowHeight = 64
const glossaryVisibleRows = 10
const glossaryHeaderHeight = 42
const glossaryTableHeight = glossaryHeaderHeight + glossaryVisibleRows * glossaryRowHeight
const glossaryViewportOffset = 360
const glossaryMaxHeight = `min(${glossaryTableHeight}px, calc(100dvh - ${glossaryViewportOffset}px))`

const columns: Array<VirtualizedColumn<GlossaryMetric>> = [
  {
    key: "order",
    title: "№",
    minWidth: 72,
    render: (item) => item.order
  },
  {
    key: "metric",
    title: "Метрика",
    minWidth: 260,
    render: (item) => (
      <Text ff="monospace" size="sm">
        {item.metric}
      </Text>
    )
  },
  {
    key: "translation",
    title: "Перевод",
    minWidth: 300,
    render: (item) => item.translation
  },
  {
    key: "description",
    title: "Описание",
    minWidth: 420,
    render: (item) => item.description
  }
]

export function GlossaryTable({ section }: Props) {
  const { data, isFetching, isLoading } = useGetGlossaryMetricsQuery(section)
  const metrics = data?.metrics || []

  return (
    <DataTable
      columns={columns}
      data={metrics}
      emptyText="Справочник для этого раздела будет добавлен позже."
      getRowKey={(item) => item.metric}
      isLoading={isLoading || isFetching}
      maxHeight={glossaryMaxHeight}
      minTableWidth={1052}
      rowHeight={glossaryRowHeight}
    />
  )
}
