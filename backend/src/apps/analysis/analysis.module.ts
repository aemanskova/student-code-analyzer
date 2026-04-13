import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { DuckdbModule } from "../database/duckdb/duckdb.module";
import { MetricsModule } from "../metrics/metrics.module";
import { PathParserModule } from "../utils/path-parser/path-parser.module";
import { HtmlCssFullAnalyzerService } from "./html-css-full-analyzer.service";
import { AnalysisResult } from "./entities/analysis-result.entity";
import { AnalysisJob } from "./entities/analysis-job.entity";
import { AnalysisUpload } from "./entities/analysis-upload.entity";
import { AuthModule } from "../auth/auth.module";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { S3UploadController } from "./s3-upload.controller";

@Module({
  imports: [
    DuckdbModule,
    MetricsModule,
    PathParserModule,
    TypeOrmModule.forFeature([AnalysisResult, AnalysisJob, AnalysisUpload]),
    AuthModule
  ],
  controllers: [AnalysisController, S3UploadController],
  providers: [AnalysisService, HtmlCssFullAnalyzerService, JwtAuthGuard]
})
export class AnalysisModule {}
