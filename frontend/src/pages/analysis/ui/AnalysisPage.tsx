import { type AnalysisRunResult, AnalysisForm } from '@features/analysisForm';
import { AnalysisCharts, AnalysisTable } from '@entities/analysis';
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useGetAnalysisJobStatusQuery, useGetSavedResultsByRunIdQuery } from '@entities/analysis/api';
import { useMemo, useState } from 'react';

const getUserStageTitle = (status: string | null | undefined, stage: string | null | undefined): string => {
  if (status === 'queued') {
    return 'Ожидаем запуск анализа';
  }
  if (status === 'running') {
    if (!stage) {
      return 'Готовим данные к проверке';
    }
    return stage;
  }
  if (status === 'success') {
    return 'Анализ завершен';
  }
  if (status === 'failed') {
    return 'Ошибка анализа';
  }
  return 'Подготовка к запуску';
};

const toCsv = (rows: Array<Record<string, unknown>>, metrics: string[]): string => {
  const headers = ['path', ...metrics];
  const csvRows = [headers.join(';')];

  for (const row of rows) {
    const values = [
      String(row.path || ''),
      ...metrics.map((metric) => {
        const value = row[metric];
        if (value === null || value === undefined) {
          return '';
        }
        const text = String(value);
        if (/[;"\n]/.test(text)) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      }),
    ];
    csvRows.push(values.join(';'));
  }

  return `${csvRows.join('\n')}\n`;
};

export function AnalysisPage() {
  const [startedRun, setStartedRun] = useState<AnalysisRunResult | null>(null);
  const jobId = startedRun?.response.jobId || '';

  const { data: jobStatus } = useGetAnalysisJobStatusQuery(jobId, {
    skip: !jobId,
    pollingInterval: 5000,
  });
  const runId = jobStatus?.result?.runId || '';

  const { data: runResults, error: runResultsError } = useGetSavedResultsByRunIdQuery(runId, {
    skip: !runId,
  });

  const metrics = useMemo(() => {
    return jobStatus?.result?.metrics || [];
  }, [jobStatus]);

  const rows = useMemo(() => {
    return runResults?.data || [];
  }, [runResults]);

  const handleCsvDownload = () => {
    if (!rows.length || !metrics.length) {
      return;
    }
    const csv = toCsv(rows as Array<Record<string, unknown>>, metrics);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const jobInProgress = jobStatus?.status === 'queued' || jobStatus?.status === 'running';
  const jobFailed = jobStatus?.status === 'failed';
  const jobDone = jobStatus?.status === 'success';

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Card p="lg" radius="md">
          <Stack>
            <Title order={3}>Анализ студенческих работ</Title>
            <AnalysisForm onSuccess={setStartedRun} />
          </Stack>
        </Card>

        {jobId ? (
          <Card p="lg" radius="md">
            <Stack gap="sm">
              <Title order={4}>Статус анализа</Title>
              <Text>
                Этап: {getUserStageTitle(jobStatus?.status, jobStatus?.stage)}
              </Text>
              <Progress value={jobStatus?.progressPercent ?? 0} />
              <Text c="dimmed" size="xs">
                {jobStatus?.progressPercent ?? 0}%
              </Text>
              {jobFailed && (
                <Alert color="red">
                  {jobStatus?.errorMessage || 'Не удалось завершить анализ. Попробуйте снова.'}
                </Alert>
              )}
            </Stack>
          </Card>
        ) : null}

        {jobDone && (
          <Card p="lg" radius="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>Результаты анализа</Title>
                <Button onClick={handleCsvDownload}>Скачать CSV</Button>
              </Group>
              {runResultsError && (
                <Alert color="red">Не удалось загрузить результаты завершенного запуска</Alert>
              )}
              {rows.length > 0 ? (
                <>
                  <AnalysisCharts rows={rows} />
                  <AnalysisTable metrics={metrics} rows={rows} />
                </>
              ) : (
                <Text c="dimmed">
                  Результаты пока не готовы или запуск не содержит строк для выбранных метрик.
                </Text>
              )}
            </Stack>
          </Card>
        )}

        {jobInProgress && (
          <Alert color="blue">
            Анализ выполняется в фоне. Страница обновляет статус автоматически.
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
