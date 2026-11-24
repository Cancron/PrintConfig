import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

let pool: Pool | undefined;
const transactionClient = new AsyncLocalStorage<PoolClient>();

export function getPostgresPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  pool = new Pool({ connectionString });
  return pool;
}

export function getPostgresClient() {
  return transactionClient.getStore() ?? getPostgresPool();
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const existing = transactionClient.getStore();
  if (existing) return work(existing);
  const client = await getPostgresPool().connect();
  try {
    await client.query('BEGIN');
    const result = await transactionClient.run(client, () => work(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresPool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
