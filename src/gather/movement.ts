import type { Game } from "@gathertown/gather-game-client";
import { MoveDirection } from "@gathertown/gather-game-client";
import { PATROL_WAYPOINTS, MOVE_INTERVAL_MS } from "../config/constants";
import { logger } from "../utils/logger";

let patrolTimer: NodeJS.Timeout | null = null;
let currentWaypointIndex = 0;

export function startPatrol(game: Game): void {
  stopPatrol();
  currentWaypointIndex = 0;

  patrolTimer = setInterval(() => {
    try {
      const me = game.getMyPlayer();
      if (!me) return;

      const target = PATROL_WAYPOINTS[currentWaypointIndex];
      const dx = target.x - me.x;
      const dy = target.y - me.y;

      if (dx === 0 && dy === 0) {
        currentWaypointIndex = (currentWaypointIndex + 1) % PATROL_WAYPOINTS.length;
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
