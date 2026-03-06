import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { env } from "./config/env";
import { BODY_SIZE_LIMIT } from "./config/constants";
import { initDatabase, closeDatabase } from "./storage/database";
import router from "./api/router";
import { startReminderCron, stopReminderCron } from "./features/reminder";
import { connectGatherBot, disconnectGatherBot } from "./gather/client";
import { logger } from "./utils/logger";

const app = express();

app.use(helmet({
  frameguard: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'self'", "https://app.gather.town", "https://gather.town"],
    },
  },
}));

const allowedOrigins = env.server.allowedOrigins.split(",").map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "X-Session-Id"],
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: env.rateLimit.maxPerIpPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "요청이 너무 많습니다." },
}));

app.use(express.json({ limit: BODY_SIZE_LIMIT }));

app.use(express.static(path.join(__dirname, "../public")));
app.use(router);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", err.message);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

initDatabase();
logger.info("Database initialized");
startReminderCron();
connectGatherBot();

const PORT = env.server.port;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Notion: ${env.notion.apiKey ? "enabled" : "disabled"}`);
  logger.info(`Slack: ${env.slack.webhookUrl ? "enabled" : "disabled"}`);
});

function shutdown() {
  logger.info("Shutting down...");
  stopReminderCron();
  disconnectGatherBot();
  server.close(() => {
    closeDatabase();
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
