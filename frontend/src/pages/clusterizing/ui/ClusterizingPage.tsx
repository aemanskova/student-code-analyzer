import {
  useDeleteClusterizationMutation,
  useGetClusterizationListQuery
} from "@entities/clusterizing"
import { Card, Container, Stack } from "@mantine/core"
import { ConfirmModal } from "@shared/ui"
import { useCallback, useState } from "react"

import { useClusterizingList } from "../lib/hooks/useClusterizingList"
import { ClusterizingFilters } from "./components/ClusterizingFilters"
import { ClusterizingListTable } from "./components/ClusterizingListTable"
import { ClusterizingPageHeader } from "./components/ClusterizingPageHeader"

export function ClusterizingPage() {
  const { data, isFetching, isLoading } = useGetClusterizationListQuery()
  const [pendingDelete, setPendingDelete] = useState<{ jobId: string; sourcePath: string } | null>(
    null
  )
  const [deleteClusterization, { isLoading: isDeleting }] = useDeleteClusterizationMutation()
  const requestDeleteClusterization = useCallback((jobId: string, sourcePath: string) => {
    setPendingDelete({ jobId, sourcePath })
  }, [])
  const rows = data?.data || []
  const { columns, form, pageRows, safePage, totalPages } = useClusterizingList(
    rows,
    requestDeleteClusterization
  )

  return (
    <>
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

      <ConfirmModal
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        loading={isDeleting}
        message={`Вы уверены, что хотите удалить кластеризацию: ${pendingDelete?.sourcePath || ""}?`}
        opened={Boolean(pendingDelete)}
        title="Удаление кластеризации"
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          await deleteClusterization({ jobId: pendingDelete.jobId }).unwrap()
          setPendingDelete(null)
        }}
      />
    </>
  )
}
