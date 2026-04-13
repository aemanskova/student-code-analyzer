import { Module } from '@nestjs/common';
import { DuckdbService } from './duckdb.service';

@Module({
  providers: [DuckdbService],
  exports: [DuckdbService],
})
export class DuckdbModule {}
