export type GitChartConfig = {
  key: GitPathMetricKey | GitScatterMetricKey
  title: string
  xLabel?: string
  yLabel?: string
}

export type GitPathMetricKey =
  | "totalCommitCount"
  | "meaningfulCommitCount"
  | "activeDays"
  | "nightCommitPct"
  | "medianCommitSize"
  | "developmentDurationDays"
  | "codeChurn"
  | "churnRatio"

export type GitScatterMetricKey = "commitsVsChurn" | "commitsVsChurnPct"

export const BOXPLOT_CHARTS: Array<GitChartConfig & { key: GitPathMetricKey }> = [
  { key: "totalCommitCount", title: "Общее количество коммитов по группам" },
  { key: "meaningfulCommitCount", title: "Содержательные коммиты по группам" },
  { key: "activeDays", title: "Активные дни по группам" },
  { key: "nightCommitPct", title: "Доля ночных коммитов по группам" },
  { key: "medianCommitSize", title: "Медианный размер коммита по группам" },
  { key: "developmentDurationDays", title: "Продолжительность разработки по группам" },
  { key: "codeChurn", title: "Интенсивность изменения кода по группам" },
  { key: "churnRatio", title: "Доля переработки кода по группам" }
]

export const HISTO_CHARTS: GitChartConfig[] = [
  {
    key: "totalCommitCount",
    title: "Общее количество коммитов по студентам",
    xLabel: "Общее количество коммитов"
  },
  {
    key: "meaningfulCommitCount",
    title: "Содержательные коммиты по студентам",
    xLabel: "Количество содержательных коммитов"
  },
  { key: "activeDays", title: "Активные дни по студентам", xLabel: "Число активных дней" },
  {
    key: "nightCommitPct",
    title: "Доля ночных коммитов по студентам",
    xLabel: "Доля ночных коммитов, %"
  },
  {
    key: "medianCommitSize",
    title: "Медианный размер коммита по студентам",
    xLabel: "Медианный размер коммита"
  },
  {
    key: "developmentDurationDays",
    title: "Продолжительность разработки по студентам",
    xLabel: "Дней между первым и последним коммитом"
  },
  {
    key: "codeChurn",
    title: "Интенсивность изменения кода по студентам",
    xLabel: "Удалённые строки"
  },
  { key: "churnRatio", title: "Доля переработки кода по студентам", xLabel: "Удалено / добавлено" },
  {
    key: "commitsVsChurn",
    title: "Коммиты и интенсивность изменения кода",
    xLabel: "Общее количество коммитов",
    yLabel: "Интенсивность изменения кода"
  },
  {
    key: "commitsVsChurnPct",
    title: "Коммиты и доля переработки кода",
    xLabel: "Общее количество коммитов",
    yLabel: "Доля переработки кода, %"
  }
]
