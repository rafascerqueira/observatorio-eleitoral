import { Inject, Injectable, Logger, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { CONFIG, type AppConfig } from '../config';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.pool = new Pool({ connectionString: config.DATABASE_URL, max: 5, connectionTimeoutMillis: 2000, statement_timeout: 2000, query_timeout: 2500 });
    this.pool.on('error', () => this.logger.error('Conexão ociosa com PostgreSQL interrompida.'));
  }

  async check(): Promise<void> {
    await this.query('SELECT 1');
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, parameters: unknown[] = []): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, parameters);
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'unavailable', message: 'Banco de dados indisponível. Tente novamente em instantes.' });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
