import { contacts } from "../../cache/index.js";
import { isLid, toError } from "../../utils/index.js";
import { Bot } from "../index.js";

export function contactsUpdate(bot: Bot): void {
  try {
    bot.ws?.ev.on("contacts.update", (updates) => {
      for (const update of updates) {
        if (!isLid(update.id) || !contacts.has(update.id)) {
          continue;
        }
        const name = update.verifiedName ?? update.notify;
        const contact = contacts.get(update.id)!;
        if (name && contact.name !== name) {
          contact.name = name;
        }
      }
    });
  }
  catch (e) {
    bot.emit("error", toError(e));
  }
}