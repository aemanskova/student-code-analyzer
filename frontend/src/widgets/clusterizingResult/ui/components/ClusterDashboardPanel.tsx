import { type ClusteredMetricRow, ClusterMetricBoxPlot } from "@entities/clusterizing"
import { getMetricLabel } from "@entities/glossary"
import { Anchor, Card, Grid, Stack, Text } from "@mantine/core"
import { routes } from "@shared/config/routes"
import { AllOptionsMultiSelect } from "@shared/ui"
import { Controller, type UseFormReturn } from "react-hook-form"
import { NavLink } from "react-router"

import {
  ALL_CLUSTER_METRICS,
  type ClusterizingResultForm
} from "../../lib/hooks/useClusterizingResult"

type Props = {
  chartRows: ClusteredMetricRow[]
  form: UseFormReturn<ClusterizingResultForm>
  metricOptions: Array<{ value: string; label: string }>
  visibleMetrics: string[]
  jobId?: string
}

export function ClusterDashboardPanel({
  chartRows,
  form,
  metricOptions,
  visibleMetrics,
  jobId
}: Props) {
  return (
    <Stack gap="md">
      <Controller
        control={form.control}
        name="selectedMetrics"
        render={({ field }) => (
          <AllOptionsMultiSelect
            allLabel="Все метрики"
            allValue={ALL_CLUSTER_METRICS}
            label="Метрики"
            options={metricOptions}
            searchable
            value={field.value}
            w={520}
            onChange={field.onChange}
          />
        )}
      />
      <Grid>
        {visibleMetrics.map((metric) => (
          <Grid.Col key={metric} span={{ base: 12, md: 6, xl: 4 }}>
            <Card withBorder>
              <Stack gap="md">
                <Text fw={600} size="sm">
                  {jobId ? (
                    <Anchor
                      c="myColor.6"
                      component={NavLink}
                      inherit
                      to={routes.clusterizingMetricChart(jobId, metric)}
                    >
                      {getMetricLabel(metric)}
                    </Anchor>
                  ) : (
                    getMetricLabel(metric)
                  )}
                </Text>
                <ClusterMetricBoxPlot metric={metric} rows={chartRows} />
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  )
}
