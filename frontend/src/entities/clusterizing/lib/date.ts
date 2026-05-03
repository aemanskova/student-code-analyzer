export const formatClusterDate = (value: string): string => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("ru-RU")
}
