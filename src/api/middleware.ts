import { Request, Response, NextFunction } from "express";
import { getSession } from "./session";
import { MAX_CHAT_LENGTH, MAX_NICKNAME_LENGTH } from "../config/constants";
import { RateLimiter, PerUserRateLimiter, DailyBudget, ConcurrencyLimiter } from "../utils/throttle";
import { env } from "../config/env";

const globalLimiter = new RateLimiter(env.rateLimit.maxPerMinute);
const userLimiter = new PerUserRateLimiter(env.rateLimit.maxPerUserPerMinute);
const dailyBudget = new DailyBudget(env.rateLimit.maxPerDay);
export const concurrencyLimiter = new ConcurrencyLimiter(env.rateLimit.maxConcurrent);

export function sessionRequired(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers["x-session-id"] as string;
  if (!sessionId) {
    res.status(401).json({ error: "세션 ID가 필요합니다." });
    return;
  }
  const session = getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: "유효하지 않은 세션입니다. 닉네임을 다시 등록해주세요." });
    return;
  }
  (req as any).session = session;
  next();
}

export function validateChatInput(req: Request, res: Response, next: NextFunction): void {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "메시지를 입력해주세요." });
    return;
  }
  if (message.length > MAX_CHAT_LENGTH) {
    res.status(400).json({ error: `메시지는 ${MAX_CHAT_LENGTH}자 이내로 입력해주세요.` });
    return;
  }
  next();
}

export function validateNickname(req: Request, res: Response, next: NextFunction): void {
  const { nickname } = req.body;
  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    res.status(400).json({ error: "닉네임을 입력해주세요." });
    return;
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    res.status(400).json({ error: `닉네임은 ${MAX_NICKNAME_LENGTH}자 이내로 입력해주세요.` });
    return;
  }
  next();
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!dailyBudget.canProceed()) {
    res.status(429).json({ error: "오늘 AI 사용량을 모두 소진했습니다. 내일 다시 이용해주세요." });
    return;
  }
  if (!globalLimiter.canProceed()) {
    res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." });
    return;
  }
  const sessionId = (req as any).session?.id;
  if (sessionId && !userLimiter.canProceed(sessionId)) {
    res.status(429).json({ error: "너무 많은 요청을 보내셨습니다. 잠시 후 다시 시도해주세요." });
    return;
  }
  next();
}

export function recordApiUsage(sessionId: string): void {
  globalLimiter.record();
  userLimiter.record(sessionId);
  dailyBudget.record();
}
