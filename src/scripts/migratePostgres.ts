import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const testMode = process.argv.includes('--test');
const connectionString = testMode ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!connectionString) throw new Error(`${testMode ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is required.`);

const pool = new Pool({ connectionString });
try {
  const client = await pool.connect();
  try {
    const database = (await client.query<{ current_database: string }>('SELECT current_database()')).rows[0].current_database;
    if (testMode && database !== 'printconfig_test') throw new Error('Test migrations may run only against printconfig_test.');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = path.resolve('db/migrations');
    const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      const sql = await readFile(path.join(directory, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`Applied ${name} to ${database}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
