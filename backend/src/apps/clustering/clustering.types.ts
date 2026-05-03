export const CLUSTERING_DIRECTION = "html_css";

export const CLUSTERING_FEATURES = [
  "active_days",
  "churn_ratio",
  "development_duration_days",
  "semantic_element_usage_ratio_overall",
  "total_lines_added",
  "form_controls_missing_label_ratio",
  "img_missing_alt_ratio",
  "vnu_errors_total",
  "vnu_warnings_total",
  "axe_critical",
  "image_bytes_total",
  "complex_selectors_ratio_avg",
  "uses_webp",
  "median_commit_size",
  "specificity_variance_overall",
  "night_commit_pct",
  "font_bytes_total",
  "heading_order_violations_total",
  "avg_font_size_bytes",
  "duplicate_ids_total",
  "import_count_total"
] as const;

export const CLUSTERING_REQUIRED_NON_ZERO_METRICS = [
  "css_files",
  "css_bytes_total",
  "html_bytes_total",
  "html_files"
] as const;

export const CLUSTERING_LOG_FEATURES = [
  "active_days",
  "development_duration_days",
  "total_lines_added",
  "median_commit_size",
  "image_bytes_total",
  "font_bytes_total",
  "avg_font_size_bytes",
  "heading_order_violations_total",
  "duplicate_ids_total",
  "vnu_errors_total",
  "vnu_warnings_total",
  "import_count_total",
  "axe_critical"
] as const;

export type ClusteringMetricValue = string | number | boolean | null;

export interface ClusteredMetricRow {
  runId: string;
  path: string;
  groupPath: string;
  cluster: number;
  group: string | null;
  student: string | null;
  metrics: Record<string, ClusteringMetricValue>;
}

export interface ExcludedMetricRow {
  runId: string;
  path: string;
  groupPath: string;
  group: string | null;
  student: string | null;
  reason: string;
  metrics: Record<string, ClusteringMetricValue>;
}

export interface ClusterGroupShare {
  groupPath: string;
  total: number;
  shares: Record<string, number>;
}

export interface ClusterGroupDistribution {
  cluster: number;
  counts: Record<string, number>;
}
