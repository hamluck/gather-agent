import { env } from "../config/env";
import { logger } from "../utils/logger";

export function isSlackEnabled(): boolean {
  return !!env.slack.webhookUrl;
}

export async function sendNotification(text: string): Promise<void> {
  if (!isSlackEnabled()) return;

  try {
    const res = await fetch(env.slack.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logger.error(`Slack webhook failed: ${res.status}`);
    }
  } catch (err: any) {
    logger.error("Slack notification error", err.message);
  }
}
