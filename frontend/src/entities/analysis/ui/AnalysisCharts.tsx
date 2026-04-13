import type { AnalysisRow } from '@entities/analysis/api';
import { Card, Grid, Stack, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';

import { getNumericMetrics, toChartData } from '../model/helpers';

type Props = {
  rows: AnalysisRow[];
};

export function AnalysisCharts({ rows }: Props) {
  const metrics = getNumericMetrics(rows).slice(0, 12);

  if (metrics.length === 0) {
    return <Text c="dimmed">Нет числовых метрик для построения графиков</Text>;
  }

  return (
    <Grid>
      {metrics.map((metric) => (
        <Grid.Col key={metric} span={{ base: 12, md: 6 }}>
          <Card>
            <Stack gap="xs">
              <Text fw={600}>{metric}</Text>
              <BarChart
                data={toChartData(rows, metric)}
                dataKey="path"
                h={220}
                series={[{ name: 'value', color: 'myColor.6' }]}
                tickLine="y"
                withLegend={false}
              />
            </Stack>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}
