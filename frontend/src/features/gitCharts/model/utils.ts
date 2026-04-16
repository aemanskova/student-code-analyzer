export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0"
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("ru-RU")
  }
  return String(Math.round(value * 100) / 100)
}

export const quantile = (values: number[], q: number): number => {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  const high = Math.ceil(position)
  if (low === high) {
    return sorted[low]
  }
  const lowValue = sorted[low]
  const highValue = sorted[high]
  const weight = position - low
  return lowValue + (highValue - lowValue) * weight
}
