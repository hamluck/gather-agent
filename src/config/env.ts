import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const env = {
  gather: {
    apiKey: optionalEnv("GATHER_API_KEY", ""),
    spaceId: optionalEnv("GATHER_SPACE_ID", ""),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: optionalEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
  },
  bot: {
    name: optionalEnv("BOT_NAME", "기획자 Claude"),
    status: optionalEnv("BOT_STATUS", "DM으로 대화해보세요!"),
  },
  db: {
    path: optionalEnv("DB_PATH", "./data/gather-agent.db"),
  },
  server: {
    port: parseInt(process.env.PORT || optionalEnv("EXPRESS_PORT", "3000")),
    allowedOrigins: optionalEnv("ALLOWED_ORIGINS", "https://app.gather.town,https://gather.town"),
  },
  notion: {
    apiKey: optionalEnv("NOTION_API_KEY", ""),
    tasksDbId: optionalEnv("NOTION_TASKS_DB_ID", ""),
    meetingsDbId: optionalEnv("NOTION_MEETINGS_DB_ID", ""),
  },
  slack: {
    webhookUrl: optionalEnv("SLACK_WEBHOOK_URL", ""),
  },
  rateLimit: {
    maxPerMinute: parseInt(optionalEnv("CLAUDE_MAX_REQUESTS_PER_MINUTE", "60")),
    maxPerUserPerMinute: parseInt(optionalEnv("CLAUDE_MAX_REQUESTS_PER_USER_PER_MINUTE", "10")),
    maxPerDay: parseInt(optionalEnv("CLAUDE_MAX_REQUESTS_PER_DAY", "1000")),
    maxConcurrent: parseInt(optionalEnv("CLAUDE_MAX_CONCURRENT", "5")),
    maxPerIpPerMinute: parseInt(optionalEnv("MAX_REQUESTS_PER_IP_PER_MINUTE", "20")),
  },
};
