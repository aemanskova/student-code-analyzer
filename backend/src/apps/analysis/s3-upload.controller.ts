import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUserId } from "../auth/current-user-id.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AnalysisService } from "./analysis.service";
import {
  AbortS3MultipartUploadDto,
  CompleteS3MultipartUploadDto,
  InitS3MultipartUploadDto,
  S3MultipartPartUrlDto,
  S3MultipartPartUrlsDto,
  S3ObjectKeyDto
} from "./dto/s3-multipart.dto";

@Controller("s3")
@UseGuards(JwtAuthGuard)
@ApiTags("S3 Multipart")
@ApiBearerAuth("bearer")
export class S3UploadController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("multipart/init")
  @ApiOperation({ summary: "Инициализация multipart загрузки в S3/MinIO" })
  async initS3MultipartUpload(
    @Body() body: InitS3MultipartUploadDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.initS3MultipartUpload({
      userId,
      fileName: body.fileName || "archive.zip",
      contentType: body.contentType
    });
  }

  @Post("multipart/presign-part")
  @ApiOperation({ summary: "Получить presigned URL для части multipart загрузки" })
  async presignS3MultipartPart(
    @Body() body: S3MultipartPartUrlDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getS3MultipartPartUrl({
      userId,
      key: body.key,
      uploadId: body.uploadId,
      partNumber: body.partNumber,
      expiresInSeconds: body.expiresInSeconds
    });
  }

  @Post("multipart/presign-parts")
  @ApiOperation({ summary: "Получить пачку presigned URL для частей multipart загрузки" })
  async presignS3MultipartParts(
    @Body() body: S3MultipartPartUrlsDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getS3MultipartPartUrls({
      userId,
      key: body.key,
      uploadId: body.uploadId,
      partNumbers: body.partNumbers,
      expiresInSeconds: body.expiresInSeconds
    });
  }

  @Post("multipart/complete")
  @ApiOperation({ summary: "Завершить multipart загрузку" })
  async completeS3MultipartUpload(
    @Body() body: CompleteS3MultipartUploadDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.completeS3MultipartUpload({
      userId,
      key: body.key,
      uploadId: body.uploadId,
      parts: body.parts.map((part) => ({
        partNumber: Number(part.partNumber || part.PartNumber || 0),
        etag: String(part.etag || part.ETag || "")
      }))
    });
  }

  @Post("multipart/abort")
  @ApiOperation({ summary: "Отменить multipart загрузку и удалить незавершенные части" })
  async abortS3MultipartUpload(
    @Body() body: AbortS3MultipartUploadDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.abortS3MultipartUpload({
      userId,
      key: body.key,
      uploadId: body.uploadId
    });
  }

  @Post("object/delete")
  @ApiOperation({ summary: "Удалить загруженный объект из S3/MinIO" })
  async deleteUploadedS3Object(@Body() body: S3ObjectKeyDto, @CurrentUserId() userId: number) {
    return this.analysisService.deleteUploadedS3Object({
      userId,
      key: body.key
    });
  }
}
