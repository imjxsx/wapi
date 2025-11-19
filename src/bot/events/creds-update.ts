import { toError } from "../../utils/index.js";
import type { Bot } from "../bot.js";

export function credsUpdate(bot: Bot): void {
  try {
    bot.ws?.ev.on("creds.update", async () => {
      try {
        await bot.auth.save();
      }
      catch (e) {
        bot.emit("error", toError(e));
      }
    });
  }
  catch (e) {
    bot.emit("error", toError(e));
  }
}