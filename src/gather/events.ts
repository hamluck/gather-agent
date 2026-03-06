import type { Game } from "@gathertown/gather-game-client";
import {
  PROXIMITY_DISTANCE,
  PROXIMITY_CHECK_INTERVAL_MS,
  GREET_COOLDOWN_MS,
  GREET_MESSAGE,
} from "../config/constants";
import { logger } from "../utils/logger";

const greetedPlayers = new Map<string, number>();
let proximityTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

export function setupProximityGreeting(game: Game): void {
  stopProximityGreeting();

  proximityTimer = setInterval(() => {
    try {
      const me = game.getMyPlayer();
      if (!me) return;

      for (const [playerId, player] of Object.entries(game.players)) {
        if (playerId === me.id) continue;
        if (player.map !== me.map) continue;

        const distance = Math.abs(player.x - me.x) + Math.abs(player.y - me.y);
        if (distance > PROXIMITY_DISTANCE) continue;

        const lastGreeted = greetedPlayers.get(playerId);
        if (lastGreeted && Date.now() - lastGreeted < GREET_COOLDOWN_MS) continue;

        greetedPlayers.set(playerId, Date.now());
        game.chat(playerId, [], me.map, { contents: GREET_MESSAGE });
        logger.info(`Greeted player: ${player.name || playerId}`);
      }
    } catch {
      // ignore proximity check errors
    }
  }, PROXIMITY_CHECK_INTERVAL_MS);

  // 10분마다 만료된 쿨다운 정리
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, time] of greetedPlayers) {
      if (now - time > GREET_COOLDOWN_MS) {
        greetedPlayers.delete(id);
      }
    }
  }, 10 * 60 * 1000);

  logger.info("Gather bot proximity greeting started");
}

export function stopProximityGreeting(): void {
  if (proximityTimer) {
    clearInterval(proximityTimer);
    proximityTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
