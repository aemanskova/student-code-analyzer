export const CHART_WIDTH = 560
export const CHART_HEIGHT = 280

export const ALL_GIT_METRICS_OPTION = "__all__"

export const GIT_METRIC_OPTIONS = [
  { value: ALL_GIT_METRICS_OPTION, label: "Все метрики" },
  { value: "totalCommitCount", label: "Общее количество коммитов" },
  { value: "meaningfulCommitCount", label: "Количество содержательных коммитов" },
  { value: "activeDays", label: "Число активных дней" },
  { value: "nightCommitPct", label: "Доля ночных коммитов" },
  { value: "medianCommitSize", label: "Медианный размер коммита" },
  { value: "developmentDurationDays", label: "Продолжительность разработки" },
  { value: "codeChurn", label: "Интенсивность изменения кода" },
  { value: "churnRatio", label: "Доля переработки кода" },
  { value: "commitsVsChurn", label: "Коммиты и интенсивность изменения кода" },
  { value: "commitsVsChurnPct", label: "Коммиты и доля переработки кода" }
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
export const LABEL_COLOR = "var(--app-chart-label-color)"
export const DEFAULT_BAR_COLOR = "#6b615e"

export const BOX_COLORS = [
  "var(--app-chart-accent-blue)",
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

export const GIT_PATH_COLORS_LIGHT = [
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

export const GIT_PATH_COLORS_DARK = [
  "#7cc8ff",
  "#ffb86b",
  "#ff8b8d",
  "#8ee3da",
  "#8ad37c",
  "#ffe07d",
  "#d4a9e5",
  "#ffb5c0",
  "#c8aa95",
  "#d6cec8"
]
