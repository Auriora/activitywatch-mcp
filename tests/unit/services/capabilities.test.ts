import { describe, it, expect, beforeEach } from 'vitest';

import { CapabilitiesService } from '../../../src/services/capabilities.js';
import { MockActivityWatchClient, createMockBucket } from '../../helpers/mock-client.js';

describe('CapabilitiesService helper methods', () => {
  let client: MockActivityWatchClient;
  let service: CapabilitiesService;

  beforeEach(() => {
    client = new MockActivityWatchClient();
    service = new CapabilitiesService(client as any);
  });

  it('finds buckets by type', async () => {
    client.setBuckets([
      createMockBucket('aw-watcher-window_test', 'currentwindow'),
      createMockBucket('aw-watcher-web_test', 'web.tab.current'),
    ]);

    const windowBuckets = await service.findBucketsByType('window');
    expect(windowBuckets.map(bucket => bucket.id)).toContain('aw-watcher-window_test');
  });

  it('clears caches when requested', async () => {
    client.setBuckets([createMockBucket('bucket-one', 'currentwindow')]);
    const firstFetch = await service.getAvailableBuckets();
    expect(firstFetch).toHaveLength(1);

    client.setBuckets([createMockBucket('bucket-two', 'web.tab.current')]);
    service.clearCache();
    const refreshed = await service.getAvailableBuckets();
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]!.id).toBe('bucket-two');
  });
});
