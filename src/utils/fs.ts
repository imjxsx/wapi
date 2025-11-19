import { isBuffer, toError } from "./index.js";
import fs from "node:fs";

export class FS {
  static async readfile(path: string): Promise<Buffer | null> {
    try {
      if (!(await this.exists(path))) {
        return null;
      }
      const buffer = await fs.promises.readFile(path);
      if (!isBuffer(buffer)) {
        return null;
      }
      return buffer;
    }
    catch (e) {
      console.error(toError(e));
      return null;
    }
  }
  static async writefile(path: string, data: Buffer): Promise<void> {
    try {
      await fs.promises.writeFile(path, data);
    }
    catch (e) {
      console.error(toError(e));
    }
  }
  static async rm(path: string): Promise<void> {
    try {
      await fs.promises.rm(path, {
        recursive: true,
        force: true,
      });
    }
    catch (e) {
      console.error(e);
    }
  }
  static async mkdir(path: string): Promise<void> {
    try {
      await fs.promises.mkdir(path, {
        recursive: true,
      });
    }
    catch (e) {
      console.error(e);
    }
  }
  static async exists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path);
      return true;
    }
    catch {
      return false;
    }
  }
  static async readdir(path: string): Promise<string[]> {
    try {
      if (!(await this.exists(path))) {
        return [];
      }
      const files = await fs.promises.readdir(path);
      return files;
    }
    catch (e) {
      console.error(toError(e));
      return [];
    }
  }
}