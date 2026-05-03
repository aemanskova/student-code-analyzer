import type { Direction } from "@entities/analysis/api"
import { Group, Select, TextInput } from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"

import { DIRECTION_OPTIONS } from "../model/constants"

type Props = {
  pathFilter: string
  directionFilter: Direction | null
  dateFrom: Date | null
  dateTo: Date | null
  onPathChange: (value: string) => void
  onDirectionChange: (value: Direction | null) => void
  onDateFromChange: (value: Date | null) => void
  onDateToChange: (value: Date | null) => void
}

type ArchiveListFiltersForm = {
  dateFrom: Date | null
  dateTo: Date | null
  directionFilter: Direction | null
  pathFilter: string
}

export const ArchiveListFilters = ({
  pathFilter,
  directionFilter,
  dateFrom,
  dateTo,
  onPathChange,
  onDirectionChange,
  onDateFromChange,
  onDateToChange
}: Props) => {
  const form = useForm<ArchiveListFiltersForm>({
    defaultValues: {
      dateFrom,
      dateTo,
      directionFilter,
      pathFilter
    }
  })

  useEffect(() => {
    form.reset({ dateFrom, dateTo, directionFilter, pathFilter })
  }, [dateFrom, dateTo, directionFilter, form, pathFilter])

  return (
    <Group align="end" grow>
      <Controller
        control={form.control}
        name="pathFilter"
        render={({ field }) => (
          <TextInput
            label="Путь"
            placeholder="Введите часть пути"
            value={field.value}
            onChange={(event) => {
              const value = event.currentTarget.value
              field.onChange(value)
              onPathChange(value)
            }}
          />
        )}
      />
      <Controller
        control={form.control}
        name="directionFilter"
        render={({ field }) => (
          <Select
            clearable
            data={DIRECTION_OPTIONS}
            label="Направление"
            placeholder="Любое"
            value={field.value}
            onChange={(value) => {
              const nextValue = (value as Direction | null) || null
              field.onChange(nextValue)
              onDirectionChange(nextValue)
            }}
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
            onChange={(value) => {
              const nextValue = value ? new Date(value) : null
              field.onChange(nextValue)
              onDateFromChange(nextValue)
            }}
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
            onChange={(value) => {
              const nextValue = value ? new Date(value) : null
              field.onChange(nextValue)
              onDateToChange(nextValue)
            }}
          />
        )}
      />
    </Group>
  )
}
