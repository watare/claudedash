/**
 * Database migration runner
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Create migrations tracking table if it doesn't exist
 * @param {import('better-sqlite3').Database} db
 */
function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get list of already applied migrations
 * @param {import('better-sqlite3').Database} db
 * @returns {Set<string>}
 */
function getAppliedMigrations(db) {
  const rows = db.prepare('SELECT name FROM migrations').all();
  return new Set(rows.map(row => row.name));
}

/**
 * Get sorted list of migration files
 * @returns {string[]}
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

/**
 * Run pending migrations
 * @param {import('better-sqlite3').Database} db
 */
export function runMigrations(db) {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const migrationFiles = getMigrationFiles();

  const insertMigration = db.prepare(
    'INSERT INTO migrations (name) VALUES (?)'
  );

  let appliedCount = 0;

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`[DB] Running migration: ${file}`);

    // Run migration in a transaction
    db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    })();

    appliedCount++;
  }

  if (appliedCount > 0) {
    console.log(`[DB] Applied ${appliedCount} migration(s)`);
  } else {
    console.log('[DB] No new migrations to apply');
  }
}
