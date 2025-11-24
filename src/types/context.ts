import { proto } from "baileys";

export interface IReplyOptions {
  mentions?: string[];
  contextInfo?: proto.IContextInfo;
}
export interface IReplyWithImageOptions extends IReplyOptions {
  caption?: string;
  mimetype?: string;
  viewOnce?: boolean;
}
export interface IReplyWithVideoOptions extends IReplyOptions {
  caption?: string;
  mimetype?: string;
  viewOnce?: boolean;
  gifPlayback?: boolean;
}
export interface IReplyWithAudioOptions extends IReplyOptions {
  mimetype?: string;
  viewOnce?: boolean;
}
export type ChatType = "private" | "group" | "unknown";
export interface IChat {
  jid: string;
  pn?: string;
  type: ChatType;
  addressing: "pn" | "lid" | "unknown";
  name: string;
}
export interface IFrom {
  jid: string;
  pn: string;
  name: string;
}