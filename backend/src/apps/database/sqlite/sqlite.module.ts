import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Role } from "../../auth/entities/role.entity";
import { User } from "../../auth/entities/user.entity";
import { AnalysisJob } from "../../analysis/entities/analysis-job.entity";
import { AnalysisResult } from "../../analysis/entities/analysis-result.entity";
import { AnalysisGitResult } from "../../analysis/entities/analysis-git-result.entity";
import { AnalysisUpload } from "../../analysis/entities/analysis-upload.entity";
import { AnalysisPlagiarism } from "../../analysis/entities/analysis-plagiarism.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const database = process.env.SQLITE_DB_PATH || "/app/data/sqlite/app.db";
        mkdirSync(dirname(database), { recursive: true });

        return {
          type: "sqlite",
          database,
          entities: [
            User,
            Role,
            AnalysisResult,
            AnalysisGitResult,
            AnalysisJob,
            AnalysisUpload,
            AnalysisPlagiarism
          ],
          synchronize: true
        };
      }
    })
  ]
})
export class SqliteDatabaseModule {}
