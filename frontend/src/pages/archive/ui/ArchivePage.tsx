import type { AnalysisListItem } from "@entities/analysis/api"
import { useGetSavedAnalysisListQuery } from "@entities/analysis/api"
import { Card, Container, Pagination, Stack, Table, Text, Title } from "@mantine/core"
import { useState } from "react"
import { NavLink } from "react-router"

const PAGE_SIZE = 10

export function ArchivePage() {
  const [page, setPage] = useState(1)
  const { data, isFetching } = useGetSavedAnalysisListQuery({ page, size: PAGE_SIZE })
  const rows = data?.data || []
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE))

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Card p="lg">
          <Stack>
            <Title order={3}>Архив анализов</Title>
          </Stack>
        </Card>

        <Card p="lg">
          <Stack>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Папка анализа</Table.Th>
                  <Table.Th>Направление</Table.Th>
                  <Table.Th>Дата</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row: AnalysisListItem) => (
                  <Table.Tr key={`${row.path}:${row.date}:${row.direction}`}>
                    <Table.Td>
                      <NavLink
                        to={`/archive/${encodeURIComponent(row.path)}?direction=${encodeURIComponent(row.direction)}`}
                      >
                        {row.path}
                      </NavLink>
                    </Table.Td>
                    <Table.Td>{row.direction}</Table.Td>
                    <Table.Td>{new Date(row.date).toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Pagination total={totalPages} value={page} onChange={setPage} />
            {isFetching ? <Text c="dimmed">Загрузка...</Text> : null}
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
