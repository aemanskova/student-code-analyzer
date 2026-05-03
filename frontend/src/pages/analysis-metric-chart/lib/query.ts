export const parseDepth = (value: string | null): number | undefined => {
  const parsed = Number(value || "")
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const parseSelectedLevels = (searchParams: URLSearchParams): string[][] => {
  const levels: string[][] = []
  for (let index = 1; index <= 10; index += 1) {
    const raw = searchParams.get(`level${index}`)
    if (!raw) {
      continue
    }
    levels[index - 1] = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return levels
}

export const updateMetricSearch = (searchParams: URLSearchParams, mode?: string) => {
  const next = new URLSearchParams(searchParams)
  if (mode) {
    next.set("mode", mode)
  }
  return next.toString()
}
