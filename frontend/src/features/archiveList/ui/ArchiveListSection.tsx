import { Card, Stack } from "@mantine/core"
import { ConfirmModal } from "@shared/ui"

import { useArchiveList } from "../model/useArchiveList"
import { ArchiveListFilters } from "./ArchiveListFilters"
import { ArchiveListTable } from "./ArchiveListTable"

export const ArchiveListSection = () => {
  const {
    cancelDeleteRun,
    confirmDeleteRun,
    dateFrom,
    dateTo,
    deleteModalOpened,
    deleteRunPath,
    directionFilter,
    isDeleting,
    isInitialLoading,
    isUpdating,
    page,
    pathFilter,
    rows,
    requestDeleteRun,
    setDateFrom,
    setDateTo,
    setDirectionFilter,
    setPage,
    setPathFilter,
    totalPages
  } = useArchiveList()

  return (
    <>
      <Card p="sm">
        <Stack gap="sm">
          <ArchiveListFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            directionFilter={directionFilter}
            pathFilter={pathFilter}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onDirectionChange={setDirectionFilter}
            onPathChange={setPathFilter}
          />

          <ArchiveListTable
            isInitialLoading={isInitialLoading}
            isUpdating={isUpdating}
            page={page}
            rows={rows}
            totalPages={totalPages}
            onDeleteRun={requestDeleteRun}
            onPageChange={setPage}
          />
        </Stack>
      </Card>

      <ConfirmModal
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        loading={isDeleting}
        message={`Вы уверены, что хотите удалить отчет: ${deleteRunPath}?`}
        opened={deleteModalOpened}
        title="Удаление отчета"
        onClose={cancelDeleteRun}
        onConfirm={confirmDeleteRun}
      />
    </>
  )
}
