import { Group, Select, TextInput } from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { Controller, type UseFormReturn } from "react-hook-form"

import {
  CLUSTERIZING_DIRECTION_OPTIONS,
  type ClusterizingListFiltersForm
} from "../../lib/hooks/useClusterizingList"

type Props = {
  form: UseFormReturn<ClusterizingListFiltersForm>
}

export function ClusterizingFilters({ form }: Props) {
  return (
    <Group align="end" grow>
      <Controller
        control={form.control}
        name="pathFilter"
        render={({ field }) => (
          <TextInput
            label="Папка"
            placeholder="Введите название папки"
            value={field.value}
            onChange={(event) => field.onChange(event.currentTarget.value)}
          />
        )}
      />
      <Controller
        control={form.control}
        name="directionFilter"
        render={({ field }) => (
          <Select
            clearable
            data={CLUSTERIZING_DIRECTION_OPTIONS}
            label="Направление"
            placeholder="Любое"
            value={field.value}
            onChange={(value) => field.onChange((value as "html_css" | null) || null)}
          />
        )}
      />
      <Controller
        control={form.control}
        name="dateFrom"
        render={({ field }) => (
          <DatePickerInput
            clearable
            label="Дата с"
            placeholder="Выберите дату"
            value={field.value}
            onChange={(value) => field.onChange(value ? new Date(value) : null)}
          />
        )}
      />
      <Controller
        control={form.control}
        name="dateTo"
        render={({ field }) => (
          <DatePickerInput
            clearable
            label="Дата по"
            placeholder="Выберите дату"
            value={field.value}
            onChange={(value) => field.onChange(value ? new Date(value) : null)}
          />
        )}
      />
    </Group>
  )
}
