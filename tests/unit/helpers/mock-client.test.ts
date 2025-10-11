import { describe, it, expect, beforeEach } from 'vitest';

import {
  MockActivityWatchClient,
  createMockAFKEvents,
  createMockBrowserEvents,
  createMockBucket,
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
});
