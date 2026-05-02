import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const parseMetricsValue = (value: unknown): string[] | undefined => {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      return undefined;
    }
  }
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const parseBooleanValue = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(text)) {
    return true;
  }
  if (["false", "0", "no"].includes(text)) {
    return false;
  }
  return undefined;
};

export class RunFromS3AsyncDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  direction!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => parseMetricsValue(value))
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  student?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  @IsBoolean()
  r?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  depth?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  @IsBoolean()
  includeGitMetrics?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  @IsBoolean()
  includePlagiarismHeatmap?: boolean;
}

export class S3HeatmapLimitDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseBooleanValue(value))
  @IsBoolean()
  r?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  depth?: number;
}

export class StandaloneHeatmapBuildDto extends S3HeatmapLimitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalName?: string;
}

export class StandaloneHeatmapListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class AnalysisJobsQueryDto {
  @ApiPropertyOptional({ example: "queued,running" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class SavedResultsQueryDto {
  @ApiProperty()
  @IsString()
  path!: string;

  @ApiProperty()
  @IsString()
  direction!: string;
}

export class SavedAnalysisListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;
}
