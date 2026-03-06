import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function initDatabase(): void {
  const dbPath = path.resolve(env.db.path);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      player_name TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conv_player ON conversations(player_id, created_at);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      participants TEXT,
      raw_chat_log TEXT,
      summary TEXT,
      action_items TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_active_at TEXT DEFAULT (datetime('now'))
    );

  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
