import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global {
  var __basa3d_pool: Pool | undefined;
}

let pool: Pool | undefined;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be configured for database access.');
  return url;
}

export function getPool(): Pool {
  if (globalThis.__basa3d_pool) return globalThis.__basa3d_pool;
  pool ??= new Pool({
    connectionString: databaseUrl(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__basa3d_pool = pool;
  }
  return pool;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}
