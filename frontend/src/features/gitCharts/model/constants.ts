export const CHART_WIDTH = 560
export const CHART_HEIGHT = 280

export const ALL_GIT_METRICS_OPTION = "__all__"

export const GIT_METRIC_OPTIONS = [
  { value: ALL_GIT_METRICS_OPTION, label: "Все метрики" },
  { value: "totalCommitCount", label: "Total Commit Count" },
  { value: "meaningfulCommitCount", label: "Meaningful Commit Count" },
  { value: "activeDays", label: "Active Days" },
  { value: "nightCommitPct", label: "Night Commit Percentage" },
  { value: "medianCommitSize", label: "Median Commit Size" },
  { value: "developmentDurationDays", label: "Development Duration" },
  { value: "codeChurn", label: "Code Churn" },
  { value: "churnRatio", label: "Code Churn Ratio" },
  { value: "commitsVsChurn", label: "Total Commits vs Code Churn" },
  { value: "commitsVsChurnPct", label: "Total Commits vs Code Churn %" }
]

export const BOXPLOT_METRICS = [
  "totalCommitCount",
  "meaningfulCommitCount",
  "activeDays",
  "nightCommitPct",
  "medianCommitSize",
  "developmentDurationDays",
  "codeChurn",
  "churnRatio"
]

export const HISTO_METRICS = [...BOXPLOT_METRICS, "commitsVsChurn", "commitsVsChurnPct"]

export const AXIS_COLOR = "#9ca3af"
export const GRID_COLOR = "#e5e7eb"
export const LABEL_COLOR = "#4b5563"
export const DEFAULT_BAR_COLOR = "#6b615e"

export const BOX_COLORS = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc949",
  "#af7aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ab"
]
