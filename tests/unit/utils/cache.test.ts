import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimpleCache, cached } from '../../../src/utils/cache.js';

describe('SimpleCache', () => {
  let cache: SimpleCache<string>;

  beforeEach(() => {
    cache = new SimpleCache<string>(1000); // 1 second TTL
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create cache with default TTL', () => {
      const defaultCache = new SimpleCache<string>();
      expect(defaultCache).toBeInstanceOf(SimpleCache);
    });

    it('should create cache with custom TTL', () => {
      const customCache = new SimpleCache<string>(5000);
      expect(customCache).toBeInstanceOf(SimpleCache);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should handle multiple keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('expiration', () => {
    it('should return undefined for expired entries', () => {
      cache.set('key1', 'value1', 1000);
      
      // Before expiration
      expect(cache.get('key1')).toBe('value1');
      
      // After expiration
      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', () => {
      cache.set('key1', 'value1');
      
      // Before default TTL (1000ms)
      vi.advanceTimersByTime(999);
      expect(cache.get('key1')).toBe('value1');
      
      // After default TTL
      vi.advanceTimersByTime(2);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use custom TTL when specified', () => {
      cache.set('key1', 'value1', 500);
      
      vi.advanceTimersByTime(499);
      expect(cache.get('key1')).toBe('value1');
      
      vi.advanceTimersByTime(2);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should delete expired entries on get', () => {
      cache.set('key1', 'value1', 1000);
      const stats1 = cache.getStats();
      expect(stats1.size).toBe(1);
      
      vi.advanceTimersByTime(1001);
      cache.get('key1'); // Should trigger deletion
      
      const stats2 = cache.getStats();
      expect(stats2.size).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      cache.set('key1', 'value1', 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should fetch and cache value if not present', async () => {
      const fetcher = vi.fn().mockResolvedValue('fetched-value');
      
      const result = await cache.getOrSet('key1', fetcher);
      
      expect(result).toBe('fetched-value');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fetched-value');
    });

    it('should return cached value without calling fetcher', async () => {
      const fetcher = vi.fn().mockResolvedValue('fetched-value');
      
      cache.set('key1', 'cached-value');
      const result = await cache.getOrSet('key1', fetcher);
      
      expect(result).toBe('cached-value');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should refetch after expiration', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce('first-value')
        .mockResolvedValueOnce('second-value');
      
      const result1 = await cache.getOrSet('key1', fetcher, 1000);
      expect(result1).toBe('first-value');
      
      vi.advanceTimersByTime(1001);
      
      const result2 = await cache.getOrSet('key1', fetcher, 1000);
      expect(result2).toBe('second-value');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should handle async errors', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      
      await expect(cache.getOrSet('key1', fetcher)).rejects.toThrow('Fetch failed');
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 1500);
      cache.set('key3', 'value3', 2000);

      vi.advanceTimersByTime(1000);
      
      const removed = cache.cleanup();
      
      expect(removed).toBe(1); // key1 expired
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should return 0 when no entries expired', () => {
      cache.set('key1', 'value1', 2000);
      cache.set('key2', 'value2', 2000);

      vi.advanceTimersByTime(1000);
      
      const removed = cache.cleanup();
      expect(removed).toBe(0);
    });

    it('should remove all entries when all expired', () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 500);

      vi.advanceTimersByTime(1000);
      
      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it('should count expired entries', () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 1500);

      vi.advanceTimersByTime(1000);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.expired).toBe(1);
    });

    it('should return zero for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });
});

describe('cached function wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache function results', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const cachedFn = cached(fn, {
      keyGenerator: (arg: string) => arg,
      ttlMs: 1000,
    });

    const result1 = await cachedFn('test');
    const result2 = await cachedFn('test');

    expect(result1).toBe('result');
    expect(result2).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use different cache keys for different arguments', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce('result1')
      .mockResolvedValueOnce('result2');
    
    const cachedFn = cached(fn, {
      keyGenerator: (arg: string) => arg,
    });

    const result1 = await cachedFn('arg1');
    const result2 = await cachedFn('arg2');

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should refetch after TTL expires', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    
    const cachedFn = cached(fn, {
      keyGenerator: (arg: string) => arg,
      ttlMs: 1000,
    });

    const result1 = await cachedFn('test');
    vi.advanceTimersByTime(1001);
    const result2 = await cachedFn('test');

    expect(result1).toBe('first');
    expect(result2).toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

