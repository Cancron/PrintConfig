import 'dotenv/config';
import { getPostgresPool, closePostgresPool } from '../config/postgres.js';

try {
  const result = await getPostgresPool().query('SELECT current_database() AS database');
  console.log(`Connected to PostgreSQL database ${result.rows[0].database}`);
} catch (error) {
  console.error('PostgreSQL connection failed:', error);
  process.exitCode = 1;
} finally {
  await closePostgresPool();
}
