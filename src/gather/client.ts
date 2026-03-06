import { Game } from "@gathertown/gather-game-client";
import WebSocket from "isomorphic-ws";
(global as any).WebSocket = WebSocket;

import { env } from "../config/env";
import { logger } from "../utils/logger";
import { placeInteractionObject } from "./interaction";
import { setupProximityGreeting, stopProximityGreeting } from "./events";

const MAX_RECONNECT = 5;
const RECONNECT_DELAY = 5000;

let game: Game | null = null;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

function isGatherEnabled(): boolean {
  return !!(env.gather.apiKey && env.gather.spaceId);
}

function setupBot(g: Game): void {
  // 스페이스에 플레이어 스폰 (브라우저 없이 SDK만으로 입장)
  g.enter({
    name: env.bot.name,
    textStatus: env.bot.status,
    isNpc: true,
  });
  logger.info("Gather bot entered space");

  placeInteractionObject(g);
  setupProximityGreeting(g);
}

function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT) {
    logger.error("Gather bot max reconnect attempts reached");
    return;
  }
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    logger.info(`Gather bot reconnecting (${reconnectAttempts}/${MAX_RECONNECT})`);
    try {
      game?.connect();
    } catch (err: any) {
      logger.error("Gather bot reconnect failed", err.message);
    }
  }, RECONNECT_DELAY);
}

export function connectGatherBot(): void {
  if (!isGatherEnabled()) {
    logger.info("Gather bot disabled (no API key or space ID)");
    return;
  }

  try {
    game = new Game(
      env.gather.spaceId,
      () => Promise.resolve({ apiKey: env.gather.apiKey }),
    );

    game.subscribeToConnection((connected) => {
      if (connected) {
        logger.info("Gather bot connected");
        reconnectAttempts = 0;
        setupBot(game!);
      } else {
        logger.warn("Gather bot disconnected");
        stopProximityGreeting();
        attemptReconnect();
      }
    });

    game.connect();
  } catch (err: any) {
    logger.error("Gather bot failed to start", err.message);
  }
}

export function disconnectGatherBot(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopProximityGreeting();
  if (game) {
    game.disconnect();
    game = null;
  }
}
