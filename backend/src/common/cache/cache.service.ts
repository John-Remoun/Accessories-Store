class MemoryCache {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }

  public set(key: string, value: any, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public invalidate(prefixOrKey: string): void {
    for (const key of this.cache.keys()) {
      if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const memoryCache = new MemoryCache();
