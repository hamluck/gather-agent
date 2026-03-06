import * as meetingRepo from "../storage/repositories/meeting.repo";
import { sendMessage } from "../claude/client";
import { MEETING_SUMMARY_PROMPT } from "../claude/prompts";
import * as notion from "../integrations/notion";
import { isNotionEnabled } from "../integrations/notion";
import { sendNotification, isSlackEnabled } from "../integrations/slack";
import { concurrencyLimiter, recordApiUsage } from "../api/middleware";
import { logger } from "../utils/logger";

export function startMeeting(sessionId: string, title: string): string {
  const active = meetingRepo.getActiveMeeting(sessionId);
  if (active) {
    return `이미 진행 중인 회의가 있습니다: "${active.title || "제목 없음"}". /meeting end 로 먼저 종료해주세요.`;
  }

  const meeting = meetingRepo.createMeeting(sessionId, title || null);
  return `회의를 시작합니다: "${title || "제목 없음"}"\n이후 대화 내용이 회의록에 기록됩니다. 종료하려면 /meeting end 를 입력하세요.`;
}

export function recordMessage(sessionId: string, nickname: string, message: string): void {
  const active = meetingRepo.getActiveMeeting(sessionId);
  if (active) {
    meetingRepo.appendChatLog(active.id, `[${nickname}] ${message}`);
    meetingRepo.addParticipant(active.id, nickname);
  }
}

export async function endMeeting(sessionId: string): Promise<string> {
  const active = meetingRepo.getActiveMeeting(sessionId);
  if (!active) {
    return "진행 중인 회의가 없습니다. /meeting start [제목] 으로 회의를 시작해주세요.";
  }

  meetingRepo.endMeeting(active.id);

  if (!active.rawChatLog || active.rawChatLog.trim().length === 0) {
    return "회의를 종료했습니다. (기록된 대화가 없어 요약을 생성하지 않았습니다.)";
  }

  await concurrencyLimiter.acquire();
  try {
    recordApiUsage(sessionId);
    const result = await sendMessage(
      MEETING_SUMMARY_PROMPT + active.rawChatLog,
      [{ role: "user", content: "위 회의 내용을 요약해주세요." }],
      sessionId
    );

    const summary = result.text || "요약을 생성하지 못했습니다.";
    meetingRepo.saveSummary(active.id, summary, []);

    if (isNotionEnabled()) {
      try {
        await notion.createMeetingNote({
          title: active.title || "회의록",
          date: new Date().toISOString().split("T")[0],
          participants: active.participants.join(", "),
          summary,
          actionItems: "",
        });
      } catch (err: any) {
        logger.error("Notion meeting note creation failed", err.message);
      }
    }

    if (isSlackEnabled()) {
      sendNotification(
        `[회의록] ${active.title || "회의"}\n${summary.substring(0, 500)}`
      );
    }

    return `회의를 종료하고 요약을 생성했습니다.\n\n${summary}`;
  } finally {
    concurrencyLimiter.release();
  }
}

export async function listMeetings(): Promise<string> {
  if (isNotionEnabled()) {
    try {
      const meetings = await notion.listMeetings();
      if (meetings.length === 0) return "저장된 회의록이 없습니다.";
      return meetings
        .map((m, i) => `${i + 1}. ${m.title} (${m.date})`)
        .join("\n");
    } catch (err: any) {
      logger.error("Notion meeting list failed", err.message);
    }
  }
  return "Notion이 연결되어 있지 않아 회의록 목록을 조회할 수 없습니다.";
}
