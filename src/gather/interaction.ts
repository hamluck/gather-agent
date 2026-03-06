import type { Game } from "@gathertown/gather-game-client";
import { BOT_SPAWN_X, BOT_SPAWN_Y } from "../config/constants";
import { logger } from "../utils/logger";

export function placeInteractionObject(game: Game): void {
  setTimeout(() => {
    try {
      const me = game.getMyPlayer();
      if (!me) {
        logger.warn("Cannot place interaction object: player not found");
        return;
      }

      game.addObject(me.map, {
        x: BOT_SPAWN_X,
        y: BOT_SPAWN_Y,
        width: 1,
        height: 1,
        type: 1, // EMBEDDED_WEBSITE
        normal: "",
        properties: {
          url: "https://gather-agent-production.up.railway.app",
        },
        distThreshold: 2,
        previewMessage: "기획자 Claude와 대화하기",
        _tags: [],
      });

      logger.info(`Interaction object placed at (${BOT_SPAWN_X}, ${BOT_SPAWN_Y})`);
    } catch (err: any) {
      logger.error("Failed to place interaction object", err.message);
    }
  }, 3000);
}
