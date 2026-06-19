declare module 'hono' {
  // Loosen Context get/set types to accept string keys and any values
  interface Context {
    get(key: string): any;
    set(key: string, value: any): void;
  }
}
