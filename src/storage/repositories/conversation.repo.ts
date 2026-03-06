import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database";
import { Conversation } from "../models";
import { MAX_CONVERSATION_HISTORY } from "../../config/constants";

export function addMessage(
  playerId: string,
  playerName: string | null,
  role: "user" | "assistant",
  content: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, player_id, player_name, role, content)
     VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), playerId, playerName, role, content);
}

export function getRecentMessages(playerId: string): Conversation[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, player_id, player_name, role, content, created_at
       FROM conversations
       WHERE player_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(playerId, MAX_CONVERSATION_HISTORY) as any[];

  return rows.reverse().map((row) => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export function clearHistory(playerId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM conversations WHERE player_id = ?`).run(playerId);
}
