import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class RunAnalysisDto {
  @IsString()
  direction!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  student?: string;

  @IsOptional()
  @IsString()
  csvFile?: string;

  @IsOptional()
  @IsString()
  rootPath?: string;

  @IsOptional()
  @IsBoolean()
  r?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  depth?: number;

  // Internal callback for background job progress. Not intended for request body.
  onAnalyzeProgress?: (
    completed: number,
    total: number,
    currentPath: string
  ) => Promise<void> | void;
}
