export interface MetricComputeContext {
  absolutePath: string;
  relativePath: string;
  runId?: string;
  rootAbsolutePath?: string;
}

export type MetricValues = Record<string, number | string | null>;

export interface DirectionMetricProvider {
  readonly direction: string;
  readonly supportedMetrics: string[];
  computeSelected(context: MetricComputeContext, metrics: string[]): Promise<MetricValues>;
}
