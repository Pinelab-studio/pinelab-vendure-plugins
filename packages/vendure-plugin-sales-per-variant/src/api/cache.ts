/**
 * Very basic in memory cache for storing metric results
 */
export class Cache<T> {
  private cache = new Map<string, T>();
  private key(key: any): string {
    return JSON.stringify(key);
  }

  set(key: any, value: T): void {
    this.cache.set(this.key(key), value);
  }
  get(key: any): T | undefined {
    return this.cache.get(this.key(key));
  }
}
