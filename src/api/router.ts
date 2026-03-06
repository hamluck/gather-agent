import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { registerSession } from "./session";
import {
  sessionRequired,
  validateChatInput,
  validateNickname,
  apiRateLimit,
} from "./middleware";
import { processChat, getChatHistory, clearChatHistory } from "../features/chat";
import { startMeeting, endMeeting, listMeetings, recordMessage } from "../features/meeting";
import { isNotionEnabled, listTasks as notionListTasks } from "../integrations/notion";
import { getAndClearReminders } from "../features/reminder";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";

const router = Router();

router.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "세션 등록 한도를 초과했습니다." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/api/session/register",
  registerLimiter,
  validateNickname,
  (req: Request, res: Response) => {
    const { nickname, sessionId } = req.body;
    const id = sessionId || uuidv4();
    registerSession(id, nickname.trim());
    res.json({ sessionId: id, nickname: nickname.trim() });
  }
);

router.post(
  "/api/chat",
  sessionRequired,
  validateChatInput,
  apiRateLimit,
  async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { message } = req.body;

    try {
      if (message.startsWith("/")) {
        const reply = await handleSlashCommand(session.id, session.nickname, message);
        res.json({ reply });
        return;
      }

      recordMessage(session.id, session.nickname, message);
      const reply = await processChat(session.id, session.nickname, message);
      res.json({ reply });
    } catch (err: any) {
      logger.error("Chat error", err.message);
      res.status(500).json({ error: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
    }
  }
);

router.get(
  "/api/chat/history",
  sessionRequired,
  (req: Request, res: Response) => {
    const session = (req as any).session;
    const history = getChatHistory(session.id);
    const reminders = getAndClearReminders(session.id);
    res.json({ history, reminders });
  }
);

router.get(
  "/api/tasks",
  sessionRequired,
  async (req: Request, res: Response) => {
    if (!isNotionEnabled()) {
      res.status(503).json({ error: "태스크 기능이 비활성화되어 있습니다." });
      return;
    }
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const tasks = await notionListTasks(status);
      res.json({ tasks });
    } catch (err: any) {
      logger.error("Tasks error", err.message);
      res.status(500).json({ error: "태스크 조회 중 오류가 발생했습니다." });
    }
  }
);

async function handleSlashCommand(
  sessionId: string,
  nickname: string,
  message: string
): Promise<string> {
  const parts = message.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (command) {
    case "/help":
      return [
        "사용 가능한 명령어:",
        "/help - 도움말 표시",
        "/meeting start [제목] - 회의 시작",
        "/meeting end - 회의 종료 + 요약 생성",
        "/meeting list - 회의록 목록",
        "/reset - 대화 초기화",
        "",
        "자연어로 태스크를 요청할 수도 있습니다.",
        '예: "내일까지 디자인 검토해야 해"',
      ].join("\n");

    case "/meeting":
      return await handleMeetingCommand(sessionId, nickname, args);

    case "/reset":
      clearChatHistory(sessionId);
      return "대화 내역을 초기화했습니다.";

    default:
      return `알 수 없는 명령어: ${command}. /help 로 사용 가능한 명령어를 확인하세요.`;
  }
}

async function handleMeetingCommand(
  sessionId: string,
  nickname: string,
  args: string
): Promise<string> {
  const subParts = args.split(/\s+/);
  const subCommand = subParts[0]?.toLowerCase();
  const subArgs = subParts.slice(1).join(" ");

  switch (subCommand) {
    case "start":
      return startMeeting(sessionId, subArgs || "무제");
    case "end":
      return await endMeeting(sessionId);
    case "list":
      return await listMeetings();
    default:
      return "사용법: /meeting start [제목] | /meeting end | /meeting list";
  }
}

export default router;
