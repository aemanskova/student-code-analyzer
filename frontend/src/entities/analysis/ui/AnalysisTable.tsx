import type { AnalysisRow } from "@entities/analysis/api"
import { ScrollArea, Table } from "@mantine/core"

type Props = {
  rows: AnalysisRow[]
  metrics: string[]
}

export function AnalysisTable({ rows, metrics }: Props) {
  return (
    <ScrollArea>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Путь</Table.Th>
            {metrics.map((metric) => (
              <Table.Th key={metric}>{metric}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.path}>
              <Table.Td>{row.path}</Table.Td>
              {metrics.map((metric) => (
                <Table.Td key={`${row.path}:${metric}`}>{String(row[metric] ?? "")}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
