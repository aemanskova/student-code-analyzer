import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class InitS3MultipartUploadDto {
  @ApiPropertyOptional({ example: "archive.zip" })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: "application/zip" })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class S3MultipartPartUrlDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  uploadId!: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber!: number;

  @ApiPropertyOptional({ minimum: 60, maximum: 3600, default: 1800 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;
}

export class S3MultipartPartUrlsDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  uploadId!: string;

  @ApiProperty({ type: [Number], minimum: 1, maximum: 10000, maxItems: 1000 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10000, { each: true })
  partNumbers!: number[];

  @ApiPropertyOptional({ minimum: 60, maximum: 3600, default: 1800 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;
}

export class CompletedS3PartDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  PartNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ETag?: string;
}

export class CompleteS3MultipartUploadDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  uploadId!: string;

  @ApiProperty({ type: [CompletedS3PartDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CompletedS3PartDto)
  parts!: CompletedS3PartDto[];
}

export class S3ObjectKeyDto {
  @ApiProperty({ example: "uploads/1/1710000000000-id-archive.zip" })
  @IsString()
  key!: string;
}

export class AbortS3MultipartUploadDto extends S3ObjectKeyDto {
  @ApiProperty()
  @IsString()
  uploadId!: string;
}
