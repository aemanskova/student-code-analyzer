export type ClusterMetricValue = string | number | boolean | null

export interface ClusteredMetricRow {
  runId: string
  path: string
  groupPath: string
  cluster: number
  group: string | null
  student: string | null
  metrics: Record<string, ClusterMetricValue>
}

export interface ExcludedMetricRow {
  runId: string
  path: string
  groupPath: string
  group: string | null
  student: string | null
  reason: string
  metrics: Record<string, ClusterMetricValue>
}

export interface ClusterGroupShare {
  groupPath: string
  total: number
  shares: Record<string, number>
}

export interface ClusterGroupDistribution {
  cluster: number
  counts: Record<string, number>
}

export interface ClusterizationDetailsResponse {
  jobId: string
  runId: string
  direction: "html_css"
  sourcePath: string
  depth: number
  groupDepth: number
  minSamples: number
  eps: number
  features: string[]
  logFeatures: string[]
  requiredNonZeroMetrics: string[]
  metrics: string[]
  rowsTotal: number
  rowsUsed: number
  rowsExcluded: number
  outliersCount: number
  rows: ClusteredMetricRow[]
  outlierRows: ClusteredMetricRow[]
  excludedRows: ExcludedMetricRow[]
  clusters: number[]
  clusterSharesByGroup: ClusterGroupShare[]
  groupDistributionByCluster: ClusterGroupDistribution[]
  createdAt: string
  finishedAt: string
}

export interface ClusterizationListItem {
  jobId: string
  runId: string
  sourcePath: string
  direction: "html_css"
  clustersCount: number
  rowsUsed: number
  rowsExcluded: number
  createdAt: string
  finishedAt: string
}

export interface ClusterizationListResponse {
  data: ClusterizationListItem[]
}
