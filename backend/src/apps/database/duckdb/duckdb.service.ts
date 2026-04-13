import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as duckdb from 'duckdb';

@Injectable()
export class DuckdbService implements OnModuleDestroy {
  private readonly db: duckdb.Database;

  constructor() {
    const dbPath = process.env.DUCKDB_PATH || '/app/data/duckdb/analysis.duckdb';
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new duckdb.Database(dbPath);
  }

  async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const connection = this.db.connect() as unknown as {
        all: (...args: unknown[]) => void;
        close: () => void;
      };
      connection.all(sql, ...params, (err: Error | null, rows: unknown) => {
        connection.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(((rows as T[]) || []) as T[]);
      });
    });
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.all(sql, params);
  }

  onModuleDestroy() {
    this.db.close();
  }
}
