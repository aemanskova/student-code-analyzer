export type GlossarySectionKey = "html" | "css" | "git" | "javascript" | "typescript" | "vue"

export type GlossarySectionInfo = {
  key: GlossarySectionKey
  label: string
  available: boolean
}

export type GlossaryMetric = {
  order: number
  metric: string
  translation: string
  description: string
}

export type GlossaryMetricsResponse = {
  section: GlossarySectionKey
  metrics: GlossaryMetric[]
}
