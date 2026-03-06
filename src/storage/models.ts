export interface Conversation {
  id: string;
  playerId: string;
  playerName: string | null;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Meeting {
  id: string;
  roomId: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  participants: string[];
  rawChatLog: string;
  summary: string | null;
  actionItems: string[];
  status: "active" | "ended" | "summarized";
}


