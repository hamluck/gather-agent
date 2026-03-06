import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database";
import { Meeting } from "../models";

export function createMeeting(roomId: string, title: string | null): Meeting {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO meetings (id, room_id, title, started_at, participants, raw_chat_log, action_items, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, roomId, title, now, "[]", "", "[]", "active");

  return {
    id,
    roomId,
    title,
    startedAt: now,
    endedAt: null,
    participants: [],
    rawChatLog: "",
    summary: null,
    actionItems: [],
    status: "active",
  };
}

export function getActiveMeeting(roomId?: string): Meeting | null {
  const db = getDb();
  const query = roomId
    ? `SELECT * FROM meetings WHERE status = 'active' AND room_id = ? LIMIT 1`
    : `SELECT * FROM meetings WHERE status = 'active' LIMIT 1`;
  const row = roomId
    ? (db.prepare(query).get(roomId) as any)
    : (db.prepare(query).get() as any);

  if (!row) return null;
  return rowToMeeting(row);
}

export function appendChatLog(meetingId: string, line: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE meetings SET raw_chat_log = raw_chat_log || ? WHERE id = ?`
  ).run(line + "\n", meetingId);
}

export function addParticipant(meetingId: string, playerId: string): void {
  const db = getDb();
  const row = db.prepare(`SELECT participants FROM meetings WHERE id = ?`).get(meetingId) as any;
  if (!row) return;

  const participants: string[] = JSON.parse(row.participants);
  if (!participants.includes(playerId)) {
    participants.push(playerId);
    db.prepare(`UPDATE meetings SET participants = ? WHERE id = ?`).run(
      JSON.stringify(participants),
      meetingId
    );
  }
}

export function endMeeting(meetingId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE meetings SET status = 'ended', ended_at = datetime('now') WHERE id = ?`
  ).run(meetingId);
}

export function saveSummary(
  meetingId: string,
  summary: string,
  actionItems: string[]
): void {
  const db = getDb();
  db.prepare(
    `UPDATE meetings SET summary = ?, action_items = ?, status = 'summarized' WHERE id = ?`
  ).run(summary, JSON.stringify(actionItems), meetingId);
}

export function getMeeting(meetingId: string): Meeting | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(meetingId) as any;
  if (!row) return null;
  return rowToMeeting(row);
}

function rowToMeeting(row: any): Meeting {
  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    participants: JSON.parse(row.participants || "[]"),
    rawChatLog: row.raw_chat_log || "",
    summary: row.summary,
    actionItems: JSON.parse(row.action_items || "[]"),
    status: row.status,
  };
}
