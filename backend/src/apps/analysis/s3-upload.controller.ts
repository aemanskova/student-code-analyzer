import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AnalysisService } from "./analysis.service";

@Controller("s3")
@UseGuards(JwtAuthGuard)
@ApiTags("S3 Multipart")
@ApiBearerAuth("bearer")
export class S3UploadController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("multipart/init")
  @ApiOperation({ summary: "Инициализация multipart загрузки в S3/MinIO" })
  async initS3MultipartUpload(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.initS3MultipartUpload({
      userId,
      fileName: String(body.fileName || "archive.zip"),
      contentType: body.contentType ? String(body.contentType) : undefined
    });
  }

  @Post("multipart/presign-part")
  @ApiOperation({ summary: "Получить presigned URL для части multipart загрузки" })
  async presignS3MultipartPart(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.getS3MultipartPartUrl({
      userId,
      key: String(body.key || ""),
      uploadId: String(body.uploadId || ""),
      partNumber: Number(body.partNumber || 0),
      expiresInSeconds: body.expiresInSeconds ? Number(body.expiresInSeconds) : undefined
    });
  }

  @Post("multipart/complete")
  @ApiOperation({ summary: "Завершить multipart загрузку" })
  async completeS3MultipartUpload(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    const parts = Array.isArray(body.parts)
      ? body.parts.map((part) => {
          const item = part as Record<string, unknown>;
          return {
            partNumber: Number(item.partNumber || item.PartNumber || 0),
            etag: String(item.etag || item.ETag || "")
          };
        })
      : [];
    return this.analysisService.completeS3MultipartUpload({
      userId,
      key: String(body.key || ""),
      uploadId: String(body.uploadId || ""),
      parts
    });
  }
}
