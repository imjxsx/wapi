import { contacts, groups } from "../../cache/index.js";
import { Context } from "../../context/index.js";
import { isGroup, isLid, isPn, toError } from "../../utils/index.js";
import type { Bot } from "../bot.js";

export function messagesUpsert(bot: Bot): void {
  try {
    bot.ws?.ev.on("messages.upsert", async (upsert) => {
      try {
        if (upsert.type !== "notify") {
          return;
        }
        for (const message of upsert.messages) {
          const ctx = new Context(bot, message);
          if (isGroup(ctx.chat.jid)) {
            if (!groups.has(ctx.chat.jid)) {
              const metadata = await bot.groupMetadata(ctx.chat.jid);
              if (metadata) {
                groups.set(ctx.chat.jid, metadata);
              }
            }
          }
          if (isLid(ctx.from.jid) && isPn(ctx.from.pn)) {
            contacts.set(ctx.from.jid, { jid: ctx.from.jid, pn: ctx.from.pn, name: ctx.from.name });
          }
          const middlewares = [
            ...bot.middlewares,
            ...(bot.commands.get(ctx.commandName) ?? []),
          ];
          if (middlewares.length) {
            let index = -1;
            async function runner(i: number): Promise<void> {
              if (i <= index) {
                throw new Error("next() called multiple times.");
              }
              index = i;
              const fn = middlewares[i];
              if (!fn) {
                return;
              }
              await fn(ctx, async () => {
                await runner(i + 1);
              });
            };
            await runner(0);
          }
        }
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
