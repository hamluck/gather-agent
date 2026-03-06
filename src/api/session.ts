import { getDb } from "../storage/database";

export interface Session {
  id: string;
  nickname: string;
}

export function registerSession(sessionId: string, nickname: string): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO sessions (id, nickname) VALUES (?, ?)`
  ).run(sessionId, nickname);
}

export function getSession(sessionId: string): Session | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT id, nickname FROM sessions WHERE id = ?`)
    .get(sessionId) as { id: string; nickname: string } | undefined;
  if (!row) return undefined;

  db.prepare(`UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?`).run(
    sessionId
  );
  return row;
}
