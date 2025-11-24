import { UUID } from "node:crypto";
import { toString } from "./index.js";

export function isString(arg: unknown): arg is string {
  return typeof arg === "string";
}
export function isNumber(arg: unknown): arg is number {
  return typeof arg === "number" && !isNaN(arg);
}
export function isObject(arg: unknown): arg is object {
  return typeof arg === "object" && arg !== null;
}
export function isArray(arg: unknown): arg is unknown[] {
  return Array.isArray(arg);
}
export function isBuffer(arg: unknown): arg is Buffer {
  return Buffer.isBuffer(arg);
}
export function isUint8Array(arg: unknown): arg is Uint8Array {
  return arg instanceof Uint8Array;
}
export function isError(arg: unknown): arg is Error {
  return arg instanceof Error;
}
export function isLink(arg: unknown): arg is NonNullable<string> {
  try {
    new URL(toString(arg));
    return true;
  }
  catch {
    return false;
  }
}
export function isUUID(arg: unknown): arg is UUID {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(toString(arg));
}