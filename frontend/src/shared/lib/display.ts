export const toDisplayValue = (value: unknown): string | number => {
  if (value === null || value === undefined || value === "") {
    return ""
  }
  if (typeof value === "boolean") {
    return value ? "Да" : "Нет"
  }
  return value as string | number
}
