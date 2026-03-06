import cron, { ScheduledTask } from "node-cron";
import { isNotionEnabled, listTasks } from "../integrations/notion";
import { getKSTNow, toDateString } from "../utils/korean";
import { logger } from "../utils/logger";

let globalReminders: string[] = [];
const consumedSessions = new Set<string>();
let cronTask: ScheduledTask | null = null;

export function startReminderCron(): void {
  if (!isNotionEnabled()) {
    logger.info("Reminder cron skipped — Notion not enabled");
    return;
  }

  cronTask = cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const tasks = await listTasks();
        const now = getKSTNow();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const todayStr = toDateString(now);
        const tomorrowStr = toDateString(tomorrow);

        const urgent = tasks.filter((t) => {
          if (!t.dueDate || t.status === "완료" || t.status === "취소") return false;
          return t.dueDate >= todayStr && t.dueDate <= tomorrowStr;
        });

        if (urgent.length === 0) {
          globalReminders = [];
          consumedSessions.clear();
          return;
        }

        globalReminders = urgent.map(
          (t) =>
            `[리마인더] "${t.title}" 마감 임박 (${t.dueDate})${t.assignee ? ` - 담당: ${t.assignee}` : ""}`
        );
        consumedSessions.clear();
        logger.info(`Reminder cron: ${urgent.length} urgent tasks found`);
      } catch (err: any) {
        logger.warn("Reminder cron failed", err.message);
      }
    },
    { timezone: "Asia/Seoul" }
  );

  logger.info("Reminder cron started (every hour)");
}

export function getAndClearReminders(sessionId: string): string[] {
  if (globalReminders.length === 0 || consumedSessions.has(sessionId)) {
    return [];
  }
  consumedSessions.add(sessionId);
  return [...globalReminders];
}

export function stopReminderCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
