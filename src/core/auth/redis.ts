import { createHash, type UUID } from "node:crypto";
import { initAuthCreds, proto, SignalDataSet, type AuthenticationCreds, type SignalDataTypeMap, type SignalKeyStore } from "baileys";
import type { Redis } from "ioredis";
import { type IBotAuthInit } from "../../types/index.js";
import { AES256GCM, isBuffer, isString, isUint8Array, isUUID } from "../../utils/index.js";

export class RedisAuth {
  private prefix: string;
  private aes: AES256GCM;
  private cache = new Map<string, Buffer>();
  private creds?: AuthenticationCreds;
  private redis: Redis;
  public uuid: UUID;
  constructor(uuid: UUID, redis: Redis, prefix: string) {
    if (!isUUID(uuid)) {
      throw new Error(`'${uuid}' is not a valid UUID.`);
    }
    this.prefix = `${prefix}:${uuid}:`;
    this.aes = new AES256GCM(uuid);
    this.redis = redis;
    this.uuid = uuid;
  }
  private async get<T>(key: string): Promise<T | null> {
    const md5 = createHash("md5").update(key).digest("hex");
    const encrypted = this.cache.get(md5) ?? await this.redis.getBuffer(`${this.prefix + md5}`);
    if (!isBuffer(encrypted)) {
      return null;
    }
    this.cache.set(md5, encrypted);
    const decrypted = this.aes.decrypt(encrypted);
    if (!isBuffer(decrypted)) {
      return null;
    }
    const parsed = JSON.parse(decrypted.toString("utf8"), (_, value) => {
      if (value?.type !== "Buffer" && !isString(value?.data)) {
        return value;
      }
      return Buffer.from(value.data, "base64");
    });
    return parsed;
  }
  private async set(key: string, value: any): Promise<void> {
    const md5 = createHash("md5").update(key).digest("hex");
    const stringified = JSON.stringify(value, (_, value) => {
      if (!isBuffer(value) && !isUint8Array(value) && value?.type !== "Buffer") {
        return value;
      }
      return {
        type: "Buffer",
        data: Buffer.from(value.data ?? value).toString("base64"),
      };
    });
    const encrypted = this.aes.encrypt(Buffer.from(stringified, "utf8"));
    if (!isBuffer(encrypted)) {
      return;
    }
    await this.redis.set(`${this.prefix + md5}`, encrypted);
    this.cache.set(md5, encrypted);
  }
  private async del(key: string): Promise<void> {
    const md5 = createHash("md5").update(key).digest("hex");
    await this.redis.del(`${this.prefix + md5}`);
    this.cache.delete(md5);
  }
  public async init(): Promise<IBotAuthInit> {
    this.creds = await this.get<AuthenticationCreds>("creds") ?? initAuthCreds();
    const keys: SignalKeyStore = {
      get: async (type, ids) => {
        const value: Record<string, SignalDataTypeMap[typeof type]> = {};
        const tasks: Promise<void>[] = [];
        for (const id of ids) {
          const task = async () => {
            let data = await this.get<any>(`${type}-${id}`);
            if (data !== null && type === "app-state-sync-key") {
              data = proto.Message.AppStateSyncKeyData.fromObject(data);
            }
            value[id] = data;
          };
          tasks.push(task());
        }
        await Promise.all(tasks);
        return value;
      },
      set: async (data) => {
        const tasks: Promise<void>[] = [];
        for (const type of (Object.keys(data) as (keyof SignalDataSet)[])) {
          if (!data[type]) {
            continue;
          }
          for (const id of Object.keys(data[type])) {
            const value = data[type][id];
            const task = value ? this.set(`${type}-${id}`, value) : this.del(`${type}-${id}`);
            tasks.push(task);
          }
        }
        await Promise.all(tasks);
      },
    };
    return {
      creds: this.creds,
      keys,
    };
  }
  public async save(): Promise<void> {
    if (!this.creds) {
      throw new Error("Credentials not loaded.");
    }
    await this.set("creds", this.creds);
  }
  public async remove(): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (!keys.length) {
      return;
    }
    await this.redis.del(...keys);
    this.cache.clear();
  }
}