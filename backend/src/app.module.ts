import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./apps/auth/auth.module";
import { AnalysisModule } from "./apps/analysis/analysis.module";
import { SqliteDatabaseModule } from "./apps/database/sqlite/sqlite.module";
import { DuckdbModule } from "./apps/database/duckdb/duckdb.module";
import { PathParserModule } from "./apps/utils/path-parser/path-parser.module";
import { MetricsModule } from "./apps/metrics/metrics.module";
import { UsersModule } from "./apps/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SqliteDatabaseModule,
    DuckdbModule,
    PathParserModule,
    MetricsModule,
    UsersModule,
    AuthModule,
    AnalysisModule
  ]
})
export class AppModule {}
