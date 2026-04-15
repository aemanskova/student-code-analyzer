import type { Direction } from "@entities/analysis/api"
import { Group, Select, TextInput } from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"

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

export const ArchiveListFilters = ({
  pathFilter,
  directionFilter,
  dateFrom,
  dateTo,
  onPathChange,
  onDirectionChange,
  onDateFromChange,
  onDateToChange
}: Props) => (
  <Group align="end" grow>
    <TextInput
      label="Путь"
      placeholder="Введите часть пути"
      value={pathFilter}
      onChange={(event) => onPathChange(event.currentTarget.value)}
    />
    <Select
      clearable
      data={DIRECTION_OPTIONS}
      label="Направление"
      placeholder="Любое"
      value={directionFilter}
      onChange={(value) => onDirectionChange((value as Direction | null) || null)}
    />
    <DatePickerInput
      clearable
      label="Дата с"
      placeholder="Выберите дату"
      value={dateFrom}
      onChange={(value) => onDateFromChange(value ? new Date(value) : null)}
    />
    <DatePickerInput
      clearable
      label="Дата по"
      placeholder="Выберите дату"
      value={dateTo}
      onChange={(value) => onDateToChange(value ? new Date(value) : null)}
    />
  </Group>
)
