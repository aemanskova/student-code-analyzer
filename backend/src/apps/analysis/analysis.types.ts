export interface AnalysisRow {
  path: string;
  group: string | null;
  student: string | null;
  [key: string]: string | number | null;
}

export interface GitAnalysisRow {
  path: string;
  group: string | null;
  student: string | null;
  branch: string;
  hash: string;
  date: string;
  message: string;
  author: string;
  filename: string;
  filetype: "binary" | "text";
  extraMetadata: string;
  changes: string;
  added: number;
  deleted: number;
}

export interface AnalysisResponse {
  direction: string;
  metrics: string[];
  data: AnalysisRow[];
  gitData?: GitAnalysisRow[];
  runId?: string | null;
}
