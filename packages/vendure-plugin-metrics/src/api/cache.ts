interface EntryDate {
  createdAt: Date;
}

/**
 * Very basic in memory cache for storing metric results
 */
export class Cache<T> {
  // Default max age is 12 hours
  constructor(private maxAgeInSeconds: number = 60 * 60 * 12) {}

  private cache = new Map<string, T & EntryDate>();

  set(key: string, value: T): void {
    this.cache.set(key, {
      ...value,
      createdAt: new Date(),
    });
  }
  get(key: string): T | undefined {
    const res = this.cache.get(key);
    if (!res) {
      return undefined;
    }
    const now = new Date();
    if (now.getTime() - res.createdAt.getTime() > this.maxAgeInSeconds * 1000) {
      this.cache.delete(key);
      return undefined;
    }
    return res;
  }
}
