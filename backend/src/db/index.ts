import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import "dotenv/config"

// Prefer a full DATABASE_URL (Neon) but fall back to DB_* parts for local/dev
const rawDatabaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || ''
const DB_SSL = process.env.DB_SSL === 'true' || /sslmode=require/.test(rawDatabaseUrl)
const DB_MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS) || 10

let connectionString = rawDatabaseUrl
if (!connectionString) {
  const DB_HOST = process.env.DB_HOST || 'localhost'
  const DB_PORT = Number(process.env.DB_PORT) || 5432
  const DB_USER = process.env.DB_USER || 'postgres'
  const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres'
  const DB_NAME = process.env.DB_DATABASE || process.env.DB_NAME || 'chronus'
  connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
  if (DB_SSL) connectionString += '?sslmode=require'
}

export const sql = postgres(connectionString, {
  max: DB_MAX_CONNECTIONS,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  onnotice: () => {},
})

export const db = drizzle(sql, { schema })

export const migrationClient = postgres(connectionString, {
  max: 1,
  ssl: DB_SSL ? { rejectUnauthorized: false } : false,
})

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export type Database = typeof db;
export * from './schema';
