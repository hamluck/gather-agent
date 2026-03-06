import type { Game } from "@gathertown/gather-game-client";
import { PATROL_RADIUS, MOVE_INTERVAL_MS } from "../config/constants";
import { logger } from "../utils/logger";

let patrolTimer: NodeJS.Timeout | null = null;
let currentWaypointIndex = 0;
let waypoints: { x: number; y: number }[] = [];

export function startPatrol(game: Game): void {
  stopPatrol();
  currentWaypointIndex = 0;
  waypoints = [];

  patrolTimer = setInterval(() => {
    try {
      const me = game.getMyPlayer();
      if (!me) return;

      // 첫 틱에서 스폰 위치 기준 웨이포인트 생성
      if (waypoints.length === 0) {
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
      }

      const target = waypoints[currentWaypointIndex];

      if (me.x === target.x && me.y === target.y) {
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
        return;
      }

      // teleport로 한 칸씩 이동 (맵 밖으로 나가지 않도록)
      let nx = me.x;
      let ny = me.y;
      const dx = target.x - me.x;
      const dy = target.y - me.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        nx += dx > 0 ? 1 : -1;
      } else {
        ny += dy > 0 ? 1 : -1;
      }

      game.teleport(me.map, nx, ny);
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
