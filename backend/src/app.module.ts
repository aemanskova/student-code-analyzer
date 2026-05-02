import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./apps/auth/auth.module";
import { AnalysisModule } from "./apps/analysis/analysis.module";
import { SqliteDatabaseModule } from "./apps/database/sqlite/sqlite.module";
import { DuckdbModule } from "./apps/database/duckdb/duckdb.module";
import { PathParserModule } from "./apps/utils/path-parser/path-parser.module";
import { MetricsModule } from "./apps/metrics/metrics.module";
import { UsersModule } from "./apps/users/users.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const raw = config.get<string>("THROTTLE_GLOBAL_LIMIT", "400");
        const limit = Number(raw);
        return [
          {
            name: "default",
            ttl: 60_000,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 400
          }
        ];
      }
    }),
    SqliteDatabaseModule,
    DuckdbModule,
    PathParserModule,
    MetricsModule,
    UsersModule,
    AuthModule,
    AnalysisModule
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
