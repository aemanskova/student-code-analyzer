import { type ClusteredMetricRow, ClusterMetricBoxPlot } from "@entities/clusterizing"
import { Card, Grid, MultiSelect, Stack, Text } from "@mantine/core"
import { Controller, type UseFormReturn } from "react-hook-form"

import {
  ALL_CLUSTER_METRICS,
  type ClusterizingResultForm
} from "../../lib/hooks/useClusterizingResult"

type Props = {
  chartRows: ClusteredMetricRow[]
  form: UseFormReturn<ClusterizingResultForm>
  metricOptions: Array<{ value: string; label: string }>
  visibleMetrics: string[]
}

export function ClusterDashboardPanel({ chartRows, form, metricOptions, visibleMetrics }: Props) {
  return (
    <Stack gap="md">
      <Controller
        control={form.control}
        name="selectedMetrics"
        render={({ field }) => (
          <MultiSelect
            clearable={!field.value.includes(ALL_CLUSTER_METRICS)}
            data={metricOptions}
            label="Метрики для графиков"
            searchable
            value={field.value}
            w={520}
            onChange={(value) => {
              if (
                value.includes(ALL_CLUSTER_METRICS) &&
                !field.value.includes(ALL_CLUSTER_METRICS)
              ) {
                field.onChange([ALL_CLUSTER_METRICS])
                return
              }
              field.onChange(value.filter((metric) => metric !== ALL_CLUSTER_METRICS))
            }}
          />
        )}
      />
      <Grid>
        {visibleMetrics.map((metric) => (
          <Grid.Col key={metric} span={{ base: 12, md: 6, xl: 4 }}>
            <Card withBorder>
              <Stack gap="md">
                <Text fw={600} size="sm">
                  {metric}
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
