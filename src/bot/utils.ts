import type { AnyMessageContent, GroupMetadata, JidServer } from "baileys";
import type { Bot } from "./bot.js";
import { toError } from "../utils/index.js";
import type { IBotSendMessageOptions } from "../types/index.js";
import { Autolinker } from "autolinker";
import { load } from "cheerio";
import { groups } from "../cache/index.js";
import { Context } from "../context/index.js";

export function parseMentions(bot: Bot, text: string, server: JidServer): string[] {
  try {
    const mentions = new Set<string>();
    for (const match of text.matchAll(/@(\d{7,16})/g)) {
      if (!match[1]) {
        continue;
      }
      mentions.add(`${match[1]}@${server}`);
    }
    return Array.from(mentions.values());
  }
  catch (e) {
    bot.emit("error", toError(e));
    return [];
  }
}
export function parseLinks(bot: Bot, text: string): string[] {
  try {
    const links = new Set<string>();
    const html = Autolinker.link(text, {
      urls: {
        schemeMatches: true,
        ipV4Matches: false,
        tldMatches: true,
      },
      email: true,
      phone: true,
      mention: false,
      hashtag: false,
      stripPrefix: false,
      stripTrailingSlash: false,
    });
    const $ = load(html);
    $("a").each((_, el) => {
      const link = $(el).attr("href");
      if (!link) {
        return;
      }
      links.add(link);
    });
    return Array.from(links.values());
  }
  catch (e) {
    bot.emit("error", toError(e));
    return [];
  }
}
export async function sendMessage(bot: Bot, jid: string, content: AnyMessageContent, options?: IBotSendMessageOptions): Promise<Context | null> {
  try {
    if (!bot.ws?.ws.isOpen) {
      throw new Error("The WASocket connection is not open.");
    }
    const before = performance.now();
    const text = "text" in content && content.text ? content.text : "caption" in content && content.caption ? content.caption : "";
    const mentions = parseMentions(bot, text, options?.addressing === "lid" ? "lid" : "s.whatsapp.net");
    const message = await bot.ws.sendMessage(jid, {
      ...content,
      mentions: "mentions" in content && content.mentions ? content.mentions.concat(...mentions) : mentions,
    }, options);
    if (!message) {
      return null;
    }
    const after = performance.now();
    bot.ping = after - before;
    return new Context(bot, message);
  }
  catch (e) {
    bot.emit("error", toError(e));
    return null;
  }
}
export async function profilePictureUrl(bot: Bot, jid: string): Promise<string> {
  try {
    if (!bot.ws?.ws.isOpen) {
      throw new Error("The WASocket connection is not open.");
    }
    return await bot.ws.profilePictureUrl(jid, "image") ?? "https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg";
  }
  catch (e) {
    bot.emit("error", toError(e));
    return "https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg";
  }
}
export async function groupMetadata(bot: Bot, jid: string): Promise<GroupMetadata | null> {
  try {
    if (!bot.ws?.ws.isOpen) {
      throw new Error("The WASocket connection is not open.");
    }
    return groups.get(jid) ?? await bot.ws.groupMetadata(jid);
  }
  catch (e) {
    bot.emit("error", toError(e));
    return null;
  }
}