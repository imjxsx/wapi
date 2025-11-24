import { toString } from "./index.js";

export interface IJidDecoded {
  jid: string;
  server: string;
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
  return decode(jid).server === "g.us";
}
export function isPn(jid: unknown): jid is `${string}@s.whatsapp.net` {
  return decode(jid).server === "s.whatsapp.net";
}
export function isLid(jid: unknown): jid is `${string}@lid` {
  return decode(jid).server === "lid";
}