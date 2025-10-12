import { describe, it, expect, beforeEach } from 'vitest';

import {
  MockActivityWatchClient,
  createMockAFKEvents,
  createMockBrowserEvents,
  createMockBucket,
  createApiError,
  createTimeoutError,
  createAbortError,
  createMockWindowEvents,
} from '../../helpers/mock-client.js';

describe('MockActivityWatchClient helpers', () => {
  let client: MockActivityWatchClient;

  beforeEach(() => {
    client = new MockActivityWatchClient();
  });

  it('provides bucket and event utilities for tests', async () => {
    const bucket = createMockBucket('aw-watcher-window_test', 'currentwindow');
    const events = createMockWindowEvents(2);

    client.setBuckets([bucket]);
    client.setEvents(bucket.id, events);

    const bucketInfo = await client.getBucketInfo(bucket.id);
    expect(bucketInfo?.id).toBe(bucket.id);

    const fetched = await client.getEvents(bucket.id);
    expect(fetched).toHaveLength(2);
  });

  it('returns deterministic mock event collections', () => {
    const browserEvents = createMockBrowserEvents(3);
    expect(browserEvents).toHaveLength(3);
    expect(browserEvents[0]?.data.url).toContain('https://');

    const afkEvents = createMockAFKEvents(2, 1);
    expect(afkEvents).toHaveLength(3);
  });

  it('allows injecting API errors for specific methods', async () => {
    const apiError = createApiError(500, 'Server Error');
    client.setMethodError('getBuckets', () => apiError);

    await expect(client.getBuckets()).rejects.toBe(apiError);
  });

  it('supports timeout simulation helpers', async () => {
    client.setMethodTimeout('getEvents', 1500, '/api/mock');

    await expect(client.getEvents('test-bucket')).rejects.toMatchObject({
      code: 'TIMEOUT_ERROR',
      details: { timeout: 1500, path: '/api/mock' },
    });
  });

  it('provides reusable timeout errors for consumers', () => {
    const timeoutError = createTimeoutError(5000, '/api/test');
    expect(timeoutError.code).toBe('TIMEOUT_ERROR');
    expect(timeoutError.details).toMatchObject({ timeout: 5000, path: '/api/test' });
  });

  it('creates AbortError-compatible errors when DOMException unavailable', () => {
    const abortError = createAbortError('Custom abort');
    expect(abortError.name).toBe('AbortError');
  });
});
