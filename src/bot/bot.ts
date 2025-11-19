import Logger from "@imjxsx/logger";
import type { UUID } from "node:crypto";
import EventEmitter from "node:events";
import { login } from "./login.js";
import type { Boom } from "@hapi/boom";
import type { BotStatus, BotWASocket, IBotAccount, IBotAuth, IBotEventMap, IBotSendMessageOptions, MiddlewareFn } from "../types/index.js";
import { disconnect } from "./disconnect.js";
import { logout } from "./logout.js";
import { groupMetadata, parseLinks, parseMentions, profilePictureUrl, sendMessage } from "./utils.js";
import type { AnyMessageContent, GroupMetadata, JidServer } from "baileys";
import { Context } from "../context/index.js";

export class Bot extends EventEmitter<IBotEventMap> {
  public uuid: UUID;
  public ws: BotWASocket | null = null;
  public auth: IBotAuth;
  public account: IBotAccount;
  public status: BotStatus = "close";
  public logger: Logger;
  public ping = 0;
  public middlewares: MiddlewareFn[] = [];
  public commands = new Map<string, MiddlewareFn[]>();
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
    return login(this, method);
  }
  public async disconnect(reason?: Boom): Promise<void> {
    return disconnect(this, reason);
  }
  public async logout(reason?: Boom): Promise<void> {
    return logout(this, reason);
  }
  public parseMentions(text: string, server: JidServer): string[] {
    return parseMentions(this, text, server);
  }
  public parseLinks(text: string): string[] {
    return parseLinks(this, text);
  }
  public async sendMessage(jid: string, content: AnyMessageContent, options?: IBotSendMessageOptions): Promise<Context | null> {
    return sendMessage(this, jid, content, options);
  }
  public async groupMetadata(jid: string): Promise<GroupMetadata | null> {
    return groupMetadata(this, jid);
  }
  public async profilePictureUrl(jid: string): Promise<string> {
    return profilePictureUrl(this, jid);
  }
}