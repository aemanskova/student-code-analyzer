export interface ParsedPath {
  path: string;
  group: string | null;
  student: string | null;
}

export interface PathParserConfig {
  groupSegmentIndex: number;
  studentSegmentIndex: number;
}
