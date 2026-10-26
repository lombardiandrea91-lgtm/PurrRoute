import { Pool, type PoolClient, type QueryResult as PgQueryResult, type QueryResultRow } from 'pg';
import type { Database, QueryExecutor, QueryResult } from './database.ts';

class PostgresExecutor implements QueryExecutor {
  private readonly connection: Pool | PoolClient;

  constructor(connection: Pool | PoolClient) {
    this.connection = connection;
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    const result: PgQueryResult<Row & QueryResultRow> = await this.connection.query(
      statement,
      values as never[],
    );
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  }
}

export class PostgresDatabase implements Database {
  private readonly executor: PostgresExecutor;
  private readonly pool: Pool;

  constructor(
    pool: Pool,
    onIdleError: (code: string | undefined) => void = () => undefined,
  ) {
    this.pool = pool;
    this.executor = new PostgresExecutor(pool);
    pool.on('error', (error) => {
      const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
      onIdleError(code);
    });
  }

  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>> {
    return this.executor.query<Row>(statement, values);
  }

  async transaction<T>(work: (connection: QueryExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const executor = new PostgresExecutor(client);

    try {
      await client.query('BEGIN');
      const result = await work(executor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}

export function createPostgresDatabase(connectionString: string): PostgresDatabase {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
  return new PostgresDatabase(pool);
}