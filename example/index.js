import QRCode from "qrcode";
import { Bot, LocalAuth } from "../src/index.js";
import Logger from "@imjxsx/logger";

const logger = new Logger({
  level: "INFO",
});
const uuid = "1f1332f4-7c2a-4b88-b4ca-bd56d07ed713";
const auth = new LocalAuth(uuid, "sessions");
const account = {
  jid: "",
  pn: "",
  name: "",
};
const bot = new Bot(uuid, auth, account, logger);
bot.on("qr", async (qr) => {
  qr = await QRCode.toString(qr, { type: "terminal", small: true });
  console.log(qr);
});
bot.on("open", (account) => {
  bot.logger.info(`Successful login to @${account.name} (${account.pn})`);
});
bot.on("close", (reason) => {
  bot.logger.warn(reason);
});
bot.on("error", (err) => {
  bot.logger.error(err);
});
bot.use(async (ctx, next) => {
  bot.logger.info(`New message from '${ctx.from.name}' in '${ctx.chat.name}'`);
  await next();
});
bot.command("ping", async (ctx) => {
  await ctx.reply(`> ¡Pong! \`\`\`${bot.ping.toFixed(2)} ms\`\`\``);
});
bot.command("say", async (ctx) => {
  await ctx.reply(ctx.args.join(" "));
});
bot.command("tiktok", async (ctx) => {
  const links = ctx.links.filter((v) => (/https?:\/\/(www|vt|vm|t)?\.?tiktok\.com\/\S+/.test(v)));
  if (!links.length) {
    await ctx.reply("> No valid TikTok link was detected in the message.");
    return;
  }
  await ctx.reply(`> Processing ${links.length} TikTok links.`);
  for (const link of links) {
    const response = await fetch(`https://www.tikwm.com/api?url=${link}`);
    const { data } = await response.json();
    if (!data.play && !data.images?.length) {
      await ctx.reply(`> Could not retrieve link information '${link}'`);
      continue;
    }
    if (data.images?.length) {
      for (let index = 0; index < data.images.length; index++) {
        const link = data.images[index];
        if (!index) {
          await ctx.replyWithImage(link, { caption: `> *Title :* ${data.title}` });
        }
        else {
          await ctx.replyWithImage(link);
        }
      }
    }
    else {
      await ctx.replyWithVideo(data.play, { caption: `> *Title :* ${data.title}` });
    }
  }
});
await bot.login("qr");