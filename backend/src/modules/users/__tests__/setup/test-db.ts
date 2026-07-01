import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@/db/schema';
import type { Database } from '@/db';
import "dotenv/config"

const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = Number(process.env.TEST_DB_PORT) || 5432;
const TEST_DB_USER = process.env.TEST_DB_USER || 'edgar';
const TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || '123456';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'vendeaqui_test';

const adminConnectionString = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/postgres`;
const testConnectionString = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}`;

let testSql: ReturnType<typeof postgres> | null = null;
let testDb: Database | null = null;

async function ensureTestDatabaseExists() {
  const sql = postgres(adminConnectionString, { max: 1 });
  try {
    const result = await sql`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB_NAME}`;
    if (result.length === 0) {
      console.log(`Test database '${TEST_DB_NAME}' not found. Creating...`);
      await sql`CREATE DATABASE ${sql(TEST_DB_NAME)}`;
    }
  } finally {
    await sql.end();
  }
}

export const setupTestDatabase = async (): Promise<Database> => {
  if (testDb) {
    return testDb;
  }
  await ensureTestDatabaseExists();

  testSql = postgres(testConnectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}, 
  });

  testDb = drizzle(testSql, { schema });

  const migrationSql = postgres(testConnectionString, { max: 1 });
  const migrationDb = drizzle(migrationSql, { schema });

  try {
    await migrationSql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await migrationSql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    await migrationSql`
      CREATE OR REPLACE FUNCTION uuid_generate_v7()
      RETURNS uuid
      LANGUAGE plpgsql
      AS $$
      DECLARE
        unix_ts_ms bigint;
        uuid_bytes bytea;
      BEGIN
        unix_ts_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
        uuid_bytes := overlay(gen_random_bytes(16)
          placing substring(int8send(unix_ts_ms), 3, 6)
          from 1 for 6);
        uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
        uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
        return encode(uuid_bytes, 'hex')::uuid;
      END
      $$;
    `;

    await migrate(migrationDb, { migrationsFolder: './drizzle' });
  } finally {
    await migrationSql.end();
  }

  return testDb;
};

export const getTestDatabase = (): Database => {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
};

export const resetTestDatabase = async (): Promise<void> => {
  const db = getTestDatabase();
  await db.delete(schema.sessions);
  await db.delete(schema.users);
};

export const cleanupTestDatabase = async (): Promise<void> => {
  if (testSql) {
    await testSql.end({ timeout: 5 });
    testSql = null;
    testDb = null;
  }
};

export const checkTestDatabaseConnection = async (): Promise<boolean> => {
  try {
    if (!testSql) {
      return false;
    }
    await testSql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};