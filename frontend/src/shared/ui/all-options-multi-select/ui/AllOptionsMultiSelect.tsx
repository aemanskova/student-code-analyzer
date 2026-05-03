import { MultiSelect, type MultiSelectProps } from "@mantine/core"

type Option = {
  label: string
  value: string
}

type Props = Omit<MultiSelectProps, "data" | "onChange" | "value"> & {
  allLabel?: string
  allValue: string
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
}

export function AllOptionsMultiSelect({
  allLabel = "Все",
  allValue,
  options,
  value,
  onChange,
  ...props
}: Props) {
  const hasAll = value.includes(allValue)
  const data = [
    { value: allValue, label: allLabel },
    ...options.filter((option) => option.value !== allValue)
  ]

  return (
    <MultiSelect
      {...props}
      clearable={!hasAll}
      data={data}
      value={value}
      onChange={(nextValue) => {
        if (!nextValue.length) {
          onChange([allValue])
          return
        }
        if (nextValue.includes(allValue) && !hasAll) {
          onChange([allValue])
          return
        }
        onChange(nextValue.filter((item) => item !== allValue))
      }}
    />
  )
}
