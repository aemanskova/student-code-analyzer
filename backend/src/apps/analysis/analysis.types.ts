export interface AnalysisRow {
  path: string;
  group: string | null;
  student: string | null;
  [key: string]: string | number | null;
}

export interface AnalysisResponse {
  direction: string;
  metrics: string[];
  data: AnalysisRow[];
  runId?: string | null;
}
