import { downloadMediaMessage, type WAMediaUpload, type WAMessage } from "baileys";
import type { IReplyOptions, IReplyWithAudioOptions, IReplyWithImageOptions, IReplyWithVideoOptions } from "../../types/context.js";
import { isBuffer, isLink, toString } from "../../utils/index.js";
import { Message } from "./message.js";
import type { Bot } from "../bot.js";

export class Context extends Message {
  public bot: Bot;
  public prefixUsed = "";
  public commandName = "";
  public args: string[] = [];
  constructor(bot: Bot, message: WAMessage) {
    super(bot, message);
    this.bot = bot;
    if (this.text) {
      const match = (this.text.match(/^\s*([/!])\s*([a-zA-Z0-9_$>?-]+)(?:\s+(.+))?/i) ?? []).filter(Boolean).map((v) => (v.trim()));
      if (match.length) {
        this.prefixUsed = match[1] ?? "";
        this.commandName = (match[2] ?? "").toLowerCase();
        this.args = (match[3] ?? "").split(/\s+/).filter(Boolean).map((v) => (v.trim()));
      }
    }
  }
  public async reply(text: string, options?: IReplyOptions): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      text: toString(text),
      ...options,
    }, {
      quoted: this.message,
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async replyWithImage(image: string | Buffer, options?: IReplyWithImageOptions): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    let media: WAMediaUpload;
    if (isBuffer(image)) {
      media = image;
    }
    else if (isLink(image)) {
      media = {
        url: image,
      };
    }
    else {
      throw new Error("Image type not supported.");
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      image: media,
      mimetype: "image/jpeg",
      ...options,
    }, {
      quoted: this.message,
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async replyWithVideo(video: string | Buffer, options?: IReplyWithVideoOptions): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    let media: WAMediaUpload;
    if (isBuffer(video)) {
      media = video;
    }
    else if (isLink(video)) {
      media = {
        url: video,
      };
    }
    else {
      throw new Error("Video type not supported.");
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      video: media,
      mimetype: "video/mp4",
      ...options,
    }, {
      quoted: this.message,
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async replyWithAudio(video: string | Buffer, options?: IReplyWithAudioOptions): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    let media: WAMediaUpload;
    if (isBuffer(video)) {
      media = video;
    }
    else if (isLink(video)) {
      media = {
        url: video,
      };
    }
    else {
      throw new Error("Video type not supported.");
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      audio: media,
      mimetype: "audio/mpeg",
      ...options,
    }, {
      quoted: this.message,
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async replyWithSticker(sticker: Buffer, options?: IReplyOptions): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    if (!isBuffer(sticker)) {
      throw new Error("Image type not supported.");
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      sticker,
      mimetype: "image/webp",
      ...options,
    }, {
      quoted: this.message,
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async del(): Promise<void> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    await this.bot.sendMessage(this.chat.jid, {
      delete: this.message.key,
    });
  }
  public async edit(text: string): Promise<Context> {
    if (!this.chat.jid) {
      throw new Error("Unknown chat.");
    }
    if (!this.message.key.fromMe) {
      throw new Error(`The '${this.id}' message cannot be edited because it was not sent by the client.`);
    }
    const context = await this.bot.sendMessage(this.chat.jid, {
      edit: this.message.key,
      text: toString(text),
    }, {
      addressing: this.chat.addressing === "lid" ? "lid" : "pn",
    });
    if (!context) {
      throw new Error("The message could not be sent.");
    }
    return context;
  }
  public async download(): Promise<Buffer> {
    return await downloadMediaMessage(this.message, "buffer", {});
  }
}