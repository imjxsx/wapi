import { toString } from "./index.js";
import type { JidServer } from "baileys";

export interface IJidDecoded {
  jid: string;
  server: JidServer | string;
}
export function decode(jid: unknown): IJidDecoded {
  const match = toString(jid).match(/^([\w-]+)(?::\d+)?@([\w.-]+)$/) ?? [];
  return {
    jid: match[1] ?? "",
    server: match[2] ?? "",
  };
}
export function normalize(jid: unknown): string {
  const decoded = decode(toString(jid));
  return `${decoded.jid}@${decoded.server}`;
}
export function isGroup(jid: unknown): jid is `${string}@g.us` {
  return /@g\.us$/.test(toString(jid));
}
export function isPn(jid: unknown): jid is `${string}@s.whatsapp.net` {
  return /@s\.whatsapp\.net$/.test(toString(jid));
}
export function isLid(jid: unknown): jid is `${string}@lid` {
  return /@lid$/.test(toString(jid));
}