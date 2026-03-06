type Level = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: Level = (process.env.LOG_LEVEL as Level) || "info";

function formatTime(): string {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function log(level: Level, message: string, data?: any): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const prefix = `[${formatTime()}] [${level.toUpperCase()}]`;
  const msg = data ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;

  if (level === "error") {
    console.error(msg);
  } else if (level === "warn") {
    console.warn(msg);
  } else {
    console.log(msg);
  }
}

export const logger = {
  debug: (msg: string, data?: any) => log("debug", msg, data),
  info: (msg: string, data?: any) => log("info", msg, data),
  warn: (msg: string, data?: any) => log("warn", msg, data),
  error: (msg: string, data?: any) => log("error", msg, data),
};
