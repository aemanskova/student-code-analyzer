import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalysisGitResult } from "../analysis/entities/analysis-git-result.entity";
import { AnalysisJob } from "../analysis/entities/analysis-job.entity";
import { AnalysisResult } from "../analysis/entities/analysis-result.entity";
import { AuthModule } from "../auth/auth.module";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClusteringController } from "./clustering.controller";
import { ClusteringService } from "./clustering.service";

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisResult, AnalysisGitResult, AnalysisJob]), AuthModule],
  controllers: [ClusteringController],
  providers: [ClusteringService, JwtAuthGuard]
})
export class ClusteringModule {}
