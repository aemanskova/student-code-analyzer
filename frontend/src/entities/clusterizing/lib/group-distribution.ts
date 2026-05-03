import type { ClusterGroupDistribution } from "../api"
import { getScopeDisplayName } from "./group-path"

export type ClusterGroupDistributionMeta = {
  groups: string[]
  groupLabels: string[]
  clusters: string[]
}

export const getClusterGroupDistributionMeta = (
  data: ClusterGroupDistribution[]
): ClusterGroupDistributionMeta => {
  const groups = Array.from(new Set(data.flatMap((item) => Object.keys(item.counts)))).sort(
    (a, b) => a.localeCompare(b)
  )

  return {
    groups,
    groupLabels: groups.map((group) => getScopeDisplayName(group)),
    clusters: data.map((item) => String(item.cluster))
  }
}
