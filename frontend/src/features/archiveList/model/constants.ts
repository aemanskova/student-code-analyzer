import type { Direction } from "@entities/analysis/api"

export const PAGE_SIZE = 8

export const DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> = [
  { value: "html_css", label: "HTML/CSS" },
  { value: "js", label: "JavaScript" }
]
