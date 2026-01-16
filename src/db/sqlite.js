/**
 * SQLite database connection using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/orchestrator.db');

let db = null;

/**
 * Get the database instance
 * @returns {Database.Database} The database instance
 * @throws {Error} If database not initialized
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Initialize the database connection and run migrations
 */
export function initDb() {
  if (db) {
    return db;
  }

  db = new Database(DB_PATH);

  // Enable foreign keys and WAL mode for better performance
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  console.log(`[DB] SQLite database initialized at ${DB_PATH}`);

  return db;
}

/**
 * Close the database connection gracefully
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

// Graceful shutdown handlers
process.on('exit', closeDb);
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
