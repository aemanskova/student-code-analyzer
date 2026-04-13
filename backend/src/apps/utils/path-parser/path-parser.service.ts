import { Injectable } from '@nestjs/common';
import { ParsedPath, PathParserConfig } from './path-parser.types';

@Injectable()
export class PathParserService {
  private readonly config: PathParserConfig;

  constructor() {
    this.config = {
      groupSegmentIndex: Number(process.env.PATH_GROUP_INDEX ?? 0),
      studentSegmentIndex: Number(process.env.PATH_STUDENT_INDEX ?? 1),
    };
  }

  parse(pathValue: string): ParsedPath {
    const normalized = String(pathValue || '').replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    return {
      path: normalized,
      group: segments[this.config.groupSegmentIndex] || null,
      student: segments[this.config.studentSegmentIndex] || null,
    };
  }
}
