import { Message } from "./client";
import * as conversationRepo from "../storage/repositories/conversation.repo";

export function getHistory(playerId: string): Message[] {
  const rows = conversationRepo.getRecentMessages(playerId);
  return rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));
}

export function addUserMessage(playerId: string, playerName: string | null, content: string): void {
  conversationRepo.addMessage(playerId, playerName, "user", content);
}

export function addAssistantMessage(playerId: string, content: string): void {
  conversationRepo.addMessage(playerId, null, "assistant", content);
}

export function clearHistory(playerId: string): void {
  conversationRepo.clearHistory(playerId);
}
