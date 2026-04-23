declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
  }

  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<Row extends QueryResultRow = QueryResultRow> {
    rowCount: number | null;
    rows: Row[];
  }

  export interface PoolClient {
    query<Row extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): this;
    query<Row extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: readonly unknown[],
    ): Promise<QueryResult<Row>>;
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}
