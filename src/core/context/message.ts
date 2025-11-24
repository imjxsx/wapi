import { proto, type WAMessage } from "baileys";
import type { IChat, IFrom } from "../../types/index.js";
import Long from "long";
import type { Bot } from "../bot.js";
import { isGroup, isLid, isLink, isPn, isString } from "../../utils/index.js";
import { contacts, groups } from "../../cache/index.js";

export class Message {
  public message: WAMessage;
  public chat: IChat = {
    jid: "",
    type: "unknown",
    addressing: "unknown",
    name: "",
  };
  public from: IFrom = {
    jid: "",
    pn: "",
    name: "",
  };
  public type: keyof proto.IMessage = "conversation";
  public id = "";
  public timestamp = 0;
  public hash = "";
  public mimetype = "";
  public text = "";
  public size = 0;
  public mentions: string[] = [];
  public links: string[] = [];
  public quoted?: Message;
  constructor(bot: Bot, message: WAMessage) {
    this.message = message;
    this.id = this.message.key.id ?? "";
    this.timestamp = this.message.messageTimestamp ? Long.fromValue(this.message.messageTimestamp).toNumber() : 0;
    this.serialize(bot);
    this.parse(bot, this.message.message ?? {});
    if (this.text) {
      this.mentions.push(...bot.parseMentions(this.text, this.chat.addressing === "lid" ? "lid" : "s.whatsapp.net"));
      this.links.push(...bot.parseLinks(this.text));
    }
    if (this.quoted) {
      if (this.quoted.chat.type === "unknown") {
        this.quoted.chat = this.chat;
      }
      delete this.quoted.quoted;
    }
    else {
      delete this.quoted;
    }
  }
  private serialize(bot: Bot): void {
    if (this.message.key.remoteJid) {
      if (isGroup(this.message.key.remoteJid)) {
        const jid = this.message.key.remoteJid;
        this.chat = {
          jid,
          type: "group",
          addressing: this.message.key.addressingMode === "lid" ? "lid" : "pn",
          name: groups.get(jid)?.subject ?? "",
        }
      }
      else {
        const jids = [
          this.message.key.remoteJid,
          this.message.key.remoteJidAlt,
        ];
        const jid = jids.find((v) => (isLid(v)));
        const pn = jids.find((v) => (isPn(v)));
        if (jid || pn) {
          this.chat = {
            jid: jid ?? "",
            pn,
            type: "private",
            addressing: "pn",
            name: Array.from(contacts.values()).find((v) => ((jid && jid === v.jid) || (pn && pn === v.pn)))?.name ?? "",
          };
        }
      }
    }
    if (this.message.key.participant) {
      const jids = [
        this.message.key.participant,
        this.message.key.participantAlt,
      ];
      const jid = this.message.key.fromMe ? bot.account.jid : jids.find((v) => (isLid(v)));
      const pn = this.message.key.fromMe ? bot.account.pn : jids.find((v) => (isPn(v)));
      if (jid || pn) {
        this.from = {
          jid: jid ?? "",
          pn: pn ?? "",
          name: this.message.verifiedBizName ?? this.message.pushName ?? "",
        };
      }
    }
    else if (this.chat.type === "private") {
      const jid = this.message.key.fromMe ? bot.account.jid : this.chat.jid;
      const pn = this.message.key.fromMe ? bot.account.pn : this.chat.pn;
      if (isLid(jid)) {
        this.from = {
          jid,
          pn: pn ?? "",
          name: this.message.verifiedBizName ?? this.message.pushName ?? "",
        };
      }
    }
  }
  private parse(bot: Bot, message: proto.IMessage): void {
    const type = (Object.keys(message) as (keyof proto.IMessage)[]).find((v) => (v !== "senderKeyDistributionMessage" && v !== "messageContextInfo"));
    if (!type || !message[type]) {
      return;
    }
    this.type = type;
    switch (type) {
      case "conversation":
      case "extendedTextMessage": {
        const m = message[type];
        this.text = (isString(m) ? m : m.text ?? "").trim();
        this.size = this.text.length;
        break;
      }
      case "viewOnceMessage":
      case "viewOnceMessageV2":
      case "viewOnceMessageV2Extension":
      case "documentWithCaptionMessage": {
        const m = message[type];
        this.parse(bot, m.message ?? {});
        break;
      }
      default: {
        const m = message[type];
        this.type = type;
        this.hash = "fileSha256" in m && m.fileSha256 ? Buffer.from(m.fileSha256).toString("hex") : "";
        this.mimetype = "mimetype" in m && m.mimetype ? m.mimetype : "";
        this.text = "text" in m && m.text ? m.text : "caption" in m && m.caption ? m.caption : "";
        this.size = "fileLength" in m && m.fileLength ? Long.fromValue(m.fileLength).toNumber() : this.text.length;
        break;
      }
    }
    const m = message[type];
    const context = !isString(m) && "contextInfo" in m ? m.contextInfo : {};
    this.mentions = context?.mentionedJid ?? [];
    if (context?.quotedMessage) {
      const message: WAMessage = {
        key: {
          remoteJid: context.remoteJid,
          fromMe: [bot.account.jid, bot.account.pn].some((v) => (v === context.participant)),
          id: context.stanzaId,
          participant: context.participant,
          addressingMode: isLid(context.participant) ? "lid" : "pn",
        },
        message: context.quotedMessage,
      };
      this.quoted = new Message(bot, message);
    }
    if (context?.externalAdReply) {
      if (isLink(context.externalAdReply.sourceUrl)) {
        this.links.push(context.externalAdReply.sourceUrl);
      }
    }
  }
}