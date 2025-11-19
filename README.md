<div align="center">
  <h1>⚡ @imjxsx/wapi (v1.1.0-beta)</h1>
  <p>Framework for developing bots for the WhatsApp application: fast, secure, and elegant, powered by Baileys and developed 100% in TypeScript</p>
</div>

---

<div align="center">
  <h3>📥 Installation</h3>
</div>

```bash
# With NPM
npm install @imjxsx/wapi

# With PNPM
pnpm add @imjxsx/wapi

# With Yarn
yarn add @imjxsx/wapi

# With Bun
bun add @imjxsx/wapi
```

---

<div align="center">
  <h3>🚀 Use</h3>
</div>

```javascript
// index.js
import { Bot, LocalAuth  } from "@imjxsx/wapi";
import QRCode from "qrcode";

const uuid = "1f1332f4-7c2a-4b88-b4ca-bd56d07ed713";
// (uuid: UUID, directory: string)
const auth = new LocalAuth(uuid, "sessions"); // or RedisAuth, MongoAuth
/**
 * The 'pn' field is required if you want to log in with an OTP code; if you are going to log in with a QR code, put "" in all three fields.
 * 
 * The 'jid' field must follow this format: "id@lid"
 * The 'pn' field must follow this format: "phone@s.whatsapp.net"
*/
const account = {
  jid: "",
  pn: "",
  name: "",
};
// (uuid: UUID, auth: IBotAuth, account: IBotAccount, logger?: Logger)
const bot = new Bot(uuid, auth, account);
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
// It supports middlewares.
bot.use(async (ctx, next) => {
  bot.logger.info(`New message from '${ctx.from.name}' in '${ctx.chat.name}'`);
  await next();
});
// The supported prefixes are '/' and '!'
bot.command("ping", async (ctx) => {
  await ctx.reply(`> ¡Pong! \`\`\`${bot.ping.toFixed(2)} ms\`\`\``);
});
await bot.login("qr");
```

---

<div align="center">
  <p>
    <b>Created and maintained with ❤ by <a href="https://github.com/imjxsx">I'm Jxsx</a></b>
  </p>
</div>

---
