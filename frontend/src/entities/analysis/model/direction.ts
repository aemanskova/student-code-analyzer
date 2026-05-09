import type { Direction } from "../api"

export const AnalysisDirectionValue = {
  HtmlCss: "html_css",
  JavaScript: "js",
  TypeScript: "typescript"
} as const

export const AnalysisDirectionLabel = {
  HtmlCss: "HTML/CSS",
  JavaScript: "JavaScript",
  TypeScript: "TypeScript"
} as const

export const ANALYSIS_DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> = [
  { value: AnalysisDirectionValue.HtmlCss, label: AnalysisDirectionLabel.HtmlCss },
  { value: AnalysisDirectionValue.JavaScript, label: AnalysisDirectionLabel.JavaScript },
  { value: AnalysisDirectionValue.TypeScript, label: AnalysisDirectionLabel.TypeScript }
]

export const getAnalysisDirectionLabel = (direction?: Direction | null): string => {
  if (direction === AnalysisDirectionValue.HtmlCss) {
    return AnalysisDirectionLabel.HtmlCss
  }
  if (direction === AnalysisDirectionValue.JavaScript) {
    return AnalysisDirectionLabel.JavaScript
  }
  if (direction === AnalysisDirectionValue.TypeScript) {
    return AnalysisDirectionLabel.TypeScript
  }
  return "не указано"
}
