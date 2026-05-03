import { Box, Text } from "@mantine/core"

import type { ClusterGroupDistribution } from "../api"
import { getClusterGroupDistributionMeta } from "../lib"
import { ClusterGroupDistributionSvg } from "./components/ClusterGroupDistributionSvg"

type Props = {
  data: ClusterGroupDistribution[]
}

export function ClusterGroupDistributionChart({ data }: Props) {
  const meta = getClusterGroupDistributionMeta(data)

  if (!data.length || !meta.groups.length) {
    return <Text c="dimmed">Нет данных для распределения по группам</Text>
  }

  return (
    <Box style={{ overflowX: "auto" }}>
      <ClusterGroupDistributionSvg data={data} meta={meta} />
    </Box>
  )
}
