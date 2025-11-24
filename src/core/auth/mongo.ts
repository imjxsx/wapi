import { createHash, type UUID } from "node:crypto";
import { initAuthCreds, proto, SignalDataSet, type AuthenticationCreds, type SignalDataTypeMap, type SignalKeyStore } from "baileys";
import type { Collection, Document } from "mongodb";
import { AES256GCM, isBuffer, isString, isUint8Array, isUUID } from "../../utils/index.js";
import type { IBotAuthInit } from "../../types/index.js";

interface IAuthState extends Document {
  uuid: UUID;
  key: string;
  encrypted: string;
}
export class MongoAuth {
  private aes: AES256GCM;
  private cache = new Map<string, Buffer>();
  private creds?: AuthenticationCreds;
  private collection: Collection<IAuthState>;
  public uuid: UUID;
  constructor(uuid: UUID, collection: Collection<IAuthState>) {
    if (!isUUID(uuid)) {
      throw new Error(`'${uuid}' is not a valid UUID.`);
    }
    this.collection = collection;
    this.aes = new AES256GCM(uuid);
    this.uuid = uuid;
  }
  private async get<T>(key: string): Promise<T | null> {
    const md5 = createHash("md5").update(key).digest("hex");
    let encrypted = this.cache.get(md5);
    if (!encrypted) {
      const document = await this.collection.findOne({ uuid: this.uuid, key: md5 });
      if (!document) {
        return null;
      }
      encrypted = Buffer.from(document.encrypted, "base64");
    }
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
    await this.collection.updateOne({ uuid: this.uuid, key: md5 }, {
      $set: {
        encrypted: encrypted.toString("base64"),
      },
    }, { upsert: true });
    this.cache.set(md5, encrypted);
  }
  private async delete(key: string): Promise<void> {
    const md5 = createHash("md5").update(key).digest("hex");
    await this.collection.deleteOne({ uuid: this.uuid, key: md5 });
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
            const task = value ? this.set(`${type}-${id}`, value) : this.delete(`${type}-${id}`);
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
    await this.collection.deleteMany({ uuid: this.uuid });
    this.cache.clear();
  }
}