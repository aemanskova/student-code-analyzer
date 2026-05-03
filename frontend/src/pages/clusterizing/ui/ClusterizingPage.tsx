import { useGetClusterizationListQuery } from "@entities/clusterizing"
import { Card, Container, Stack } from "@mantine/core"

import { useClusterizingList } from "../lib/hooks/useClusterizingList"
import { ClusterizingFilters } from "./components/ClusterizingFilters"
import { ClusterizingListTable } from "./components/ClusterizingListTable"
import { ClusterizingPageHeader } from "./components/ClusterizingPageHeader"

export function ClusterizingPage() {
  const { data, isFetching, isLoading } = useGetClusterizationListQuery()
  const rows = data?.data || []
  const { columns, form, pageRows, safePage, totalPages } = useClusterizingList(rows)

  return (
    <Container py="md" size="xl">
      <Stack gap="md">
        <ClusterizingPageHeader />
        <Card p="md">
          <Stack gap="md">
            <ClusterizingFilters form={form} />
            <ClusterizingListTable
              columns={columns}
              form={form}
              isFetching={isFetching}
              isLoading={isLoading}
              pageRows={pageRows}
              rows={rows}
              safePage={safePage}
              totalPages={totalPages}
            />
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
