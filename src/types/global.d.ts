declare global {
  interface ObjectConstructor {
    keys<T extends object>(object: T): (keyof T)[];
    entries<T extends object>(object: T): [keyof T, T[keyof T]][];
  }
}
export { };