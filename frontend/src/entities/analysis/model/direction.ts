import type { Direction } from "../api"

export const AnalysisDirectionValue = {
  HtmlCss: "html_css",
  JavaScript: "js",
  TypeScript: "typescript",
  Vue: "vue"
} as const

export const AnalysisDirectionLabel = {
  HtmlCss: "HTML/CSS",
  JavaScript: "JavaScript",
  TypeScript: "TypeScript",
  Vue: "Vue.js"
} as const

export const ANALYSIS_DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> = [
  { value: AnalysisDirectionValue.HtmlCss, label: AnalysisDirectionLabel.HtmlCss },
  { value: AnalysisDirectionValue.JavaScript, label: AnalysisDirectionLabel.JavaScript },
  { value: AnalysisDirectionValue.TypeScript, label: AnalysisDirectionLabel.TypeScript },
  { value: AnalysisDirectionValue.Vue, label: AnalysisDirectionLabel.Vue }
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
  if (direction === AnalysisDirectionValue.Vue) {
    return AnalysisDirectionLabel.Vue
  }
  return "не указано"
}
