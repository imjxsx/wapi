import { groups } from "../../cache/index.js";
import { isGroup, toError } from "../../utils/index.js";
import { Bot } from "../index.js";

export function groupsUpdate(bot: Bot): void {
  try {
    bot.ws?.ev.on("groups.update", async (updates) => {
      for (const update of updates) {
        if (!isGroup(update.id)) {
          continue;
        }
        groups.delete(update.id);
        const metadata = await bot.groupMetadata(update.id);
        if (metadata) {
          groups.set(update.id, metadata);
        }
      }
    });
  }
  catch (e) {
    bot.emit("error", toError(e));
  }
}