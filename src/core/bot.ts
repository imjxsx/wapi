import Logger from "@imjxsx/logger";
import type { UUID } from "node:crypto";
import EventEmitter from "node:events";
import { Boom } from "@hapi/boom";
import type { BotStatus, BotWASocket, IBotAccount, IBotAuth, IBotEventMap, IBotSendMessageOptions, MiddlewareFn } from "../types/index.js";
import { BaileysEventMap, makeWASocket, type AnyMessageContent, type GroupMetadata, type JidServer } from "baileys";
import { Context } from "./context/context.js";
import { decode, isGroup, isLid, isPn, normalize, toError } from "../utils/index.js";
import os from "node:os";
import { contacts, groups } from "../cache/index.js";
import { Autolinker } from "autolinker";
import { load } from "cheerio";

export class Bot extends EventEmitter<IBotEventMap> {
  public uuid: UUID;
  public ws: BotWASocket | null = null;
  public auth: IBotAuth;
  public account: IBotAccount;
  public status: BotStatus = "close";
  public logger: Logger;
  public ping = 0;
  /** @private */
  private middlewares: MiddlewareFn[] = [];
  /** @private */
  private commands = new Map<string, MiddlewareFn[]>();
  constructor(uuid: UUID, auth: IBotAuth, account: IBotAccount, logger?: Logger) {
    super();
    this.uuid = uuid;
    this.auth = auth;
    this.account = account;
    this.logger = logger ?? new Logger({
      name: `Bot ${this.uuid}`,
      colorize: process.env["NODE_ENV"] !== "production",
      level: process.env["NODE_ENV"] !== "production" ? "TRACE" : "INFO",
    });
  }
  public use(...middlewares: MiddlewareFn[]): void {
    this.middlewares.push(...middlewares);
  }
  public command(name: string, ...middlewares: MiddlewareFn[]): void {
    if (!name) {
      throw new Error("The command name must be at least 1 character long.");
    }
    this.commands.set(name, middlewares);
  }
  public async login(method: "qr" | "otp"): Promise<void> {
    try {
      const auth = await this.auth.init();
      this.ws = makeWASocket({
        auth,
        browser: [os.platform(), "Firefox", os.release()],
        logger: this.logger.child({ name: `WASocket ${this.uuid} ` }),
        qrTimeout: 60_000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => (false),
        generateHighQualityLinkPreview: true,
        linkPreviewImageThumbnailWidth: 1_980,
        shouldIgnoreJid: (jid) => {
          if (!isGroup(jid) && !isPn(jid) && !isLid(jid)) {
            return true;
          }
          return false;
        },
        cachedGroupMetadata: async (jid) => {
          return groups.get(jid);
        },
        version: [2, 3_000, 1_027_934_701],
      });
      this.ws.ev.on("creds.update", async () => {
        try {
          await this.auth.save();
        }
        catch (e) {
          this.emit("error", toError(e));
        }
      });
      this.ws.ev.on("connection.update", async (update) => {
        try {
          if (update.qr) {
            if (method === "otp") {
              if (!isPn(this.account.pn)) {
                await this.disconnect(new Boom("The OTP code cannot be generated because a number was not provided.", { statusCode: 400 }));
                return;
              }
              const otp = await this.ws?.requestPairingCode(decode(this.account.pn).jid);
              if (!otp) {
                await this.disconnect(new Boom(`An OTP code could not be generated for '@${decode(this.account.pn).jid}'`, { statusCode: 400 }));
                return;
              }
              this.emit("otp", otp);
            }
            else {
              this.emit("qr", update.qr);
            }
          }
          if (update.connection === "close") {
            this.ws?.ev.removeAllListeners(undefined as unknown as keyof BaileysEventMap);
            const output = new Boom(update.lastDisconnect?.error).output;
            this.emit("close", `${output.payload.error} ${output.payload.statusCode}: ${output.payload.message}`);
            switch (output.payload.statusCode) {
              case 405:
              case 404:
              case 403:
              case 401:
              case 400: {
                await this.auth.remove();
                this.ws = null;
                this.removeAllListeners();
                this.status = "close";
                break;
              }
              case 503: {
                await new Promise((resolve) => (setTimeout(resolve, 30_000)));
                this.status = "reconnecting";
                await this.login(method);
                break;
              }
              case 515: {
                this.status = "reconnecting";
                await this.login(method);
                break;
              }
              default: {
                await new Promise((resolve) => (setTimeout(resolve, 5_000)));
                this.status = "reconnecting";
                await this.login(method);
              }
            }
            return;
          }
          else if (update.connection === "open") {
            const jid = normalize(this.ws?.user?.lid);
            const pn = normalize(this.ws?.user?.id);
            const name = this.ws?.user?.verifiedName ?? this.ws?.user?.name ?? "";
            if (!isPn(pn) || !isLid(jid)) {
              await this.disconnect(new Boom("Restart required.", { statusCode: 515 }));
              return;
            }
            this.account = { jid, pn, name };
            contacts.set(jid, { jid, pn, name });
            this.status = "open";
            this.emit("open", this.account);
            return;
          }
        }
        catch (e) {
          this.emit("error", toError(e));
        }
      });
      this.ws.ev.on("messages.upsert", async (upsert) => {
        try {
          if (upsert.type !== "notify" || !upsert.messages.length) {
            return;
          }
          for (const message of upsert.messages) {
            const ctx = new Context(this, message);
            if (isGroup(ctx.chat.jid)) {
              if (!groups.has(ctx.chat.jid)) {
                const metadata = await this.groupMetadata(ctx.chat.jid);
                if (metadata) {
                  groups.set(ctx.chat.jid, metadata);
                }
              }
            }
            if (isLid(ctx.from.jid) && isPn(ctx.from.pn)) {
              contacts.set(ctx.from.jid, { jid: ctx.from.jid, pn: ctx.from.pn, name: ctx.from.name });
            }
            const middlewares = [
              ...this.middlewares,
              ...(this.commands.get(ctx.commandName) ?? []),
            ];
            if (middlewares.length) {
              let index = -1;
              const runner = async (i: number): Promise<void> => {
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
          this.emit("error", toError(e));
        }
      });
      this.ws.ev.on("contacts.update", (updates) => {
        try {
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
        }
        catch (e) {
          this.emit("error", toError(e));
        }
      });
      this.ws.ev.on("groups.update", async (updates) => {
        try {
          for (const update of updates) {
            if (!isGroup(update.id)) {
              continue;
            }
            groups.delete(update.id);
            const metadata = await this.groupMetadata(update.id);
            if (metadata) {
              groups.set(update.id, metadata);
            }
          }
        }
        catch (e) {
          this.emit("error", toError(e));
        }
      });
    }
    catch (e) {
      this.emit("error", toError(e));
    }
  }
  public async disconnect(reason?: Boom): Promise<void> {
    try {
      reason ??= new Boom("Intentional disconnection.", { statusCode: 204 });
      this.ws?.end(reason);
    }
    catch (e) {
      this.emit("error", toError(e));
    }
  }
  public async logout(reason?: Boom): Promise<void> {
    try {
      await this.ws?.logout(reason?.message);
    }
    catch (e) {
      this.emit("error", toError(e));
    }
  }
  public parseMentions(text: string, server: JidServer): string[] {
    try {
      const mentions = new Set<string>();
      for (const match of text.matchAll(/@(\d{7,})/g)) {
        if (!match[1]) {
          continue;
        }
        mentions.add(`${match[1]}@${server}`);
      }
      return Array.from(mentions.values());
    }
    catch (e) {
      this.emit("error", toError(e));
      return [];
    }
  }
  public parseLinks(text: string): string[] {
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
      this.emit("error", toError(e));
      return [];
    }
  }
  public async sendMessage(jid: string, content: AnyMessageContent, options?: IBotSendMessageOptions): Promise<Context | null> {
    try {
      if (!this.ws?.ws.isOpen) {
        throw new Error("The WASocket connection is not open.");
      }
      const before = performance.now();
      const text = "text" in content && content.text ? content.text : "caption" in content && content.caption ? content.caption : "";
      const mentions = this.parseMentions(text, options?.addressing === "lid" ? "lid" : "s.whatsapp.net");
      const message = await this.ws.sendMessage(jid, {
        ...content,
        mentions: "mentions" in content && content.mentions ? content.mentions.concat(...mentions) : mentions,
      }, options);
      if (!message) {
        return null;
      }
      const after = performance.now();
      this.ping = after - before;
      return new Context(this, message);
    }
    catch (e) {
      this.emit("error", toError(e));
      return null;
    }
  }
  public async groupMetadata(jid: string): Promise<GroupMetadata | null> {
    try {
      if (!this.ws?.ws.isOpen) {
        throw new Error("The WASocket connection is not open.");
      }
      return groups.get(jid) ?? await this.ws.groupMetadata(jid);
    }
    catch (e) {
      this.emit("error", toError(e));
      return null;
    }
  }
  public async profilePictureUrl(jid: string): Promise<string> {
    try {
      if (!this.ws?.ws.isOpen) {
        throw new Error("The WASocket connection is not open.");
      }
      return await this.ws.profilePictureUrl(jid, "image") ?? "https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg";
    }
    catch (e) {
      this.emit("error", toError(e));
      return "https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg";
    }
  }
}