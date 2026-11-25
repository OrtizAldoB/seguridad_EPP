import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from './env';

const dbFilePath = path.resolve(process.cwd(), env.DB_PATH);
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

export const db = new Database(dbFilePath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: string }).version),
  );
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      console.log(`[migrate] aplicada: ${file}`);
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
      }
      throw new Error(
        `Error aplicando migracion ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export function withImmediateTx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
    }
    throw error;
  }
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/.test(error.message);
}

export function isForeignKeyConstraint(error: unknown): boolean {
  return error instanceof Error && /SQLITE_CONSTRAINT_FOREIGNKEY/.test(error.message);
}
