import { Pool, type PoolClient } from 'pg';
import type { Store } from './types';
import { PostgresStore } from './postgres-store';

export function createPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL mode');
  return new Pool({ connectionString, max: 10 });
}

export function createPostgresStore(pool: Pool): Store & { pool: Pool } {
  return new PostgresStore(pool);
}

export async function ensureSessionVersionColumn(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_session_version_check;
    ALTER TABLE users
      ADD CONSTRAINT users_session_version_check CHECK (session_version >= 0);
  `);
}

export async function withTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
