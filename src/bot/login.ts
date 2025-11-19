import makeWASocket from "baileys";
import type { Bot } from "./bot.js";
import os from "node:os";
import { connectionUpdate, contactsUpdate, credsUpdate, groupsUpdate, messagesUpsert } from "./events/index.js";
import { isGroup, isLid, isPn, toError } from "../utils/index.js";
import { groups } from "../cache/index.js";

export async function login(bot: Bot, method: "qr" | "otp"): Promise<void> {
  try {
    const auth = await bot.auth.init();
    bot.ws = makeWASocket({
      auth,
      browser: [os.platform(), "Firefox", os.release()],
      logger: bot.logger.child({ name: `WASocket ${bot.uuid} ` }),
      qrTimeout: 60_000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => (false),
      generateHighQualityLinkPreview: true,
      linkPreviewImageThumbnailWidth: 1_980,
      shouldIgnoreJid: (jid) => {
        if (!isGroup(jid) && !isPn(jid) && !isLid(jid)) {
          return false;
        }
        else {
          return false;
        }
      },
      cachedGroupMetadata: async (jid) => {
        return groups.get(jid);
      },
    });
    credsUpdate(bot);
    connectionUpdate(bot, method);
    messagesUpsert(bot);
    contactsUpdate(bot);
    groupsUpdate(bot);
  }
  catch (e) {
    bot.emit("error", toError(e));
  }
}