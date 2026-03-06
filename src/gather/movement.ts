import type { Game } from "@gathertown/gather-game-client";
import { MoveDirection } from "@gathertown/gather-game-client";
import { PATROL_RADIUS, MOVE_INTERVAL_MS } from "../config/constants";
import { logger } from "../utils/logger";

let patrolTimer: NodeJS.Timeout | null = null;
let currentWaypointIndex = 0;
let waypoints: { x: number; y: number }[] = [];

export function startPatrol(game: Game): void {
  stopPatrol();
  currentWaypointIndex = 0;

  // 스폰 위치 기준으로 웨이포인트 생성
  const me = game.getMyPlayer();
  if (!me) {
    logger.warn("Gather bot player not found, patrol delayed");
    return;
  }

  const cx = me.x;
  const cy = me.y;
  const r = PATROL_RADIUS;
  waypoints = [
    { x: cx + r, y: cy },
    { x: cx + r, y: cy + r },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
    { x: cx - r, y: cy - r },
    { x: cx, y: cy - r },
  ];
  logger.info(`Patrol center: (${cx}, ${cy}), radius: ${r}`);

  patrolTimer = setInterval(() => {
    try {
      const me = game.getMyPlayer();
      if (!me) return;

      const target = waypoints[currentWaypointIndex];
      const dx = target.x - me.x;
      const dy = target.y - me.y;

      if (dx === 0 && dy === 0) {
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        game.move(dx > 0 ? MoveDirection.Right : MoveDirection.Left);
      } else {
        game.move(dy > 0 ? MoveDirection.Down : MoveDirection.Up);
      }
    } catch {
      // ignore movement errors
    }
  }, MOVE_INTERVAL_MS);

  logger.info("Gather bot patrol started");
}

export function stopPatrol(): void {
  if (patrolTimer) {
    clearInterval(patrolTimer);
    patrolTimer = null;
  }
}
