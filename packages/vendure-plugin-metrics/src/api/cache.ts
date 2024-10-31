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
  private key(key: any): string {
    return JSON.stringify(key);
  }

  set(key: any, value: T): void {
    this.cache.set(this.key(key), {
      ...value,
      createdAt: new Date(),
    });
  }
  get(key: any): T | undefined {
    const res = this.cache.get(this.key(key));
    if (!res) {
      return undefined;
    }
    const now = new Date();
    if (now.getTime() - res.createdAt.getTime() > this.maxAgeInSeconds * 1000) {
      this.cache.delete(this.key(key));
      return undefined;
    }
  }
}
