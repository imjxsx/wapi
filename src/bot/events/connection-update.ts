import type { BaileysEventMap } from "baileys";
import type { Bot } from "../bot.js";
import { Boom } from "@hapi/boom";
import type { BotLoginMethod } from "../../types/index.js";
import { delay, decode, isLid, isPn, normalize, toError } from "../../utils/index.js";
import { contacts } from "../../cache/index.js";

export function connectionUpdate(bot: Bot, method: BotLoginMethod): void {
  try {
    bot.ws?.ev.on("connection.update", async (update) => {
      try {
        if (update.qr) {
          if (method === "otp") {
            if (!isPn(bot.account.pn)) {
              await bot.disconnect(new Boom("The OTP code cannot be generated because a number was not provided.", { statusCode: 400 }));
              return;
            }
            const otp = await bot.ws?.requestPairingCode(decode(bot.account.pn).jid);
            if (!otp) {
              await bot.disconnect(new Boom(`An OTP code could not be generated for '@${decode(bot.account.pn).jid}'`, { statusCode: 400 }));
              return;
            }
            bot.emit("otp", otp);
          }
          else {
            bot.emit("qr", update.qr);
          }
        }
        if (update.connection === "close") {
          bot.ws?.ev.removeAllListeners(undefined as unknown as keyof BaileysEventMap);
          const output = new Boom(update.lastDisconnect?.error).output;
          bot.emit("close", `${output.payload.error} ${output.payload.statusCode}: ${output.payload.message}`);
          switch (output.payload.statusCode) {
            case 405:
            case 404:
            case 403:
            case 401:
            case 400: {
              await bot.auth.remove();
              bot.ws = null;
              bot.removeAllListeners();
              bot.status = "close";
              break;
            }
            case 503: {
              await delay(30_000);
              bot.status = "reconnecting";
              await bot.login(method);
              break;
            }
            case 515: {
              bot.status = "reconnecting";
              await bot.login(method);
              break;
            }
            default: {
              await delay(5_000);
              bot.status = "reconnecting";
              await bot.login(method);
            }
          }
          return;
        }
        else if (update.connection === "open") {
          const jid = normalize(bot.ws?.user?.lid);
          const pn = normalize(bot.ws?.user?.id);
          const name = bot.ws?.user?.verifiedName ?? bot.ws?.user?.name ?? "";
          if (!isPn(pn) || !isLid(jid)) {
            await bot.disconnect(new Boom("Restart required.", { statusCode: 515 }));
            return;
          }
          bot.account = { jid, pn, name };
          contacts.set(jid, { jid, pn, name });
          bot.status = "open";
          bot.emit("open", bot.account);
          return;
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