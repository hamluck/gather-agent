import { logger } from "./logger";

/**
 * Sliding-window rate limiter.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    return this.timestamps.length < this.maxRequests;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  get remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }
}

/**
 * Per-user sliding-window rate limiter.
 */
export class PerUserRateLimiter {
  private limiters = new Map<string, RateLimiter>();
  private readonly maxPerUser: number;
  private readonly windowMs: number;
  private lastCleanup = Date.now();

  constructor(maxPerUser: number, windowMs: number = 60000) {
    this.maxPerUser = maxPerUser;
    this.windowMs = windowMs;
  }

  canProceed(userId: string): boolean {
    this.maybeCleanup();
    if (!this.limiters.has(userId)) {
      this.limiters.set(userId, new RateLimiter(this.maxPerUser, this.windowMs));
    }
    return this.limiters.get(userId)!.canProceed();
  }

  record(userId: string): void {
    if (!this.limiters.has(userId)) {
      this.limiters.set(userId, new RateLimiter(this.maxPerUser, this.windowMs));
    }
    this.limiters.get(userId)!.record();
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.windowMs * 2) return;
    this.lastCleanup = now;
    for (const [userId, limiter] of this.limiters) {
      if (limiter.remaining === limiter.maxRequests) {
        this.limiters.delete(userId);
      }
    }
  }
}

/**
 * Daily budget cap — hard limit on total API calls per day to control costs.
 */
export class DailyBudget {
  private count = 0;
  private readonly maxPerDay: number;
  private resetDate: string;

  constructor(maxPerDay: number) {
    this.maxPerDay = maxPerDay;
    this.resetDate = this.today();
  }

  canProceed(): boolean {
    this.maybeReset();
    return this.count < this.maxPerDay;
  }

  record(): void {
    this.maybeReset();
    this.count++;
    if (this.count % 100 === 0) {
      logger.info(`Daily API budget: ${this.count}/${this.maxPerDay} used`);
    }
  }

  get remaining(): number {
    this.maybeReset();
    return Math.max(0, this.maxPerDay - this.count);
  }

  private maybeReset(): void {
    const t = this.today();
    if (t !== this.resetDate) {
      this.count = 0;
      this.resetDate = t;
      logger.info("Daily API budget reset.");
    }
  }

  private today(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }
}

/**
 * Per-user sequential queue — ensures one user's requests are processed
 * one at a time so conversation context never gets interleaved.
 */
export class UserRequestQueue {
  private queues = new Map<string, Promise<void>>();

  async enqueue<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(userId) ?? Promise.resolve();
    let resolve!: () => void;
    const next = new Promise<void>((r) => { resolve = r; });
    this.queues.set(userId, next);

    await prev;
    try {
      return await fn();
    } finally {
      resolve();
    }
  }
}

/**
 * Global concurrency limiter — caps how many Claude API calls
 * can be in-flight simultaneously (prevents burst cost spikes).
 */
export class ConcurrencyLimiter {
  private inFlight = 0;
  private readonly maxConcurrent: number;
  private waiters: (() => void)[] = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.inFlight++;
        resolve();
      });
    });
  }

  release(): void {
    this.inFlight--;
    const next = this.waiters.shift();
    if (next) next();
  }

  get active(): number {
    return this.inFlight;
  }
}
