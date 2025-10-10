/**
 * Simple in-memory cache utility
 */

interface CacheEntry<T> {
  readonly data: T;
  readonly expires: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs: number = 60000) {
    this.defaultTTL = defaultTTLMs;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    const expires = Date.now() + ttl;
    
    this.cache.set(key, { data, expires });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set pattern - fetch if not in cache
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Remove expired entries (garbage collection)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    expired: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (entry.expires < now) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired,
    };
  }
}

/**
 * Create a cached version of an async function
 */
export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    keyGenerator: (...args: TArgs) => string;
    ttlMs?: number;
  }
): (...args: TArgs) => Promise<TResult> {
  const cache = new SimpleCache<TResult>(options.ttlMs);

  return async (...args: TArgs): Promise<TResult> => {
    const key = options.keyGenerator(...args);
    return cache.getOrSet(key, () => fn(...args), options.ttlMs);
  };
}

