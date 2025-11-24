import type { MiscMessageGenerationOptions, AuthenticationCreds, SignalKeyStore, makeWASocket } from "baileys";
import type { Context } from "../core/context/context.js";

export interface IBotEventMap {
  error: [error: Error];
  close: [reason: string];
  open: [account: IBotAccount];
  qr: [qr: string];
  otp: [otp: string];
}
export type BotWASocket = ReturnType<typeof makeWASocket>;
export interface IBotAccount {
  jid: string;
  pn: string;
  name: string;
}
export type BotStatus = "close" | "open" | "reconnecting";
export type BotLoginMethod = "qr" | "otp";
export interface IBotAuth {
  init: () => Promise<IBotAuthInit>;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}
export interface IBotAuthInit {
  creds: AuthenticationCreds;
  keys: SignalKeyStore;
}
export type NextFn = () => Promise<void>;
export type MiddlewareFn = (ctx: Context, next: NextFn) => Promise<void>;
export interface IBotSendMessageOptions extends MiscMessageGenerationOptions {
  addressing?: "pn" | "lid";
}