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
  { key: "totalCommitCount", title: "Total Commit Count: Boxplot by Group" },
  { key: "meaningfulCommitCount", title: "Meaningful Commit Count: Boxplot by Group" },
  { key: "activeDays", title: "Active Days: Boxplot by Group" },
  { key: "nightCommitPct", title: "Night Commit Percentage: Boxplot by Group" },
  { key: "medianCommitSize", title: "Median Commit Size: Boxplot by Group" },
  { key: "developmentDurationDays", title: "Development Duration: Boxplot by Group" },
  { key: "codeChurn", title: "Code Churn: Boxplot by Group" },
  { key: "churnRatio", title: "Code Churn Ratio: Boxplot by Group" }
]

export const HISTO_CHARTS: GitChartConfig[] = [
  {
    key: "totalCommitCount",
    title: "Total Commit Count per Student",
    xLabel: "Total Commit Count"
  },
  {
    key: "meaningfulCommitCount",
    title: "Meaningful Commit Count per Student",
    xLabel: "Meaningful Commit Count (>= 15 lines)"
  },
  { key: "activeDays", title: "Active Days per Student", xLabel: "Active Days" },
  {
    key: "nightCommitPct",
    title: "Night Commit Percentage per Student",
    xLabel: "Night Commits (%)"
  },
  {
    key: "medianCommitSize",
    title: "Median Commit Size per Student",
    xLabel: "Median Commit Size"
  },
  {
    key: "developmentDurationDays",
    title: "Development Duration per Student",
    xLabel: "Days Between First and Last Commit"
  },
  { key: "codeChurn", title: "Code Churn per Student", xLabel: "Deleted Lines" },
  { key: "churnRatio", title: "Code Churn Ratio per Student", xLabel: "Deleted / Added" },
  {
    key: "commitsVsChurn",
    title: "Total Commits vs Code Churn",
    xLabel: "Total Commit Count",
    yLabel: "Code Churn (Deleted Lines)"
  },
  {
    key: "commitsVsChurnPct",
    title: "Total Commits vs Code Churn Percentage",
    xLabel: "Total Commit Count",
    yLabel: "Code Churn (%)"
  }
]
