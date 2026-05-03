import type { RunFilterQuery } from "./types"

export const buildFilterQueryParams = (query: RunFilterQuery) => {
  const params = new URLSearchParams()
  params.set("kind", query.kind)
  if (typeof query.depth === "number") {
    params.set("depth", String(query.depth))
  }
  ;(query.selectedLevels || []).forEach((values, index) => {
    if (!values || !values.length) {
      return
    }
    params.set(`level${index + 1}`, values.join(","))
  })
  return params.toString()
}

export const buildLevelsBody = (depth?: number, selectedLevels?: string[][]) => {
  const body: Record<string, unknown> = {}
  if (typeof depth === "number") {
    body.depth = depth
  }
  ;(selectedLevels || []).forEach((values, index) => {
    if (!values || !values.length) {
      return
    }
    body[`level${index + 1}`] = values.join(",")
  })
  return body
}
