export interface QueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface QueryExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface Database extends QueryExecutor {
  transaction<T>(work: (connection: QueryExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}