import { describe, it, expect } from 'vitest';

import type { AWEvent } from '../../../src/types.js';
import { CapabilitiesService } from '../../../src/services/capabilities.js';
import { QueryService } from '../../../src/services/query.js';
import { MockActivityWatchClient, createMockBucket } from '../../helpers/mock-client.js';

describe('QueryService helper methods', () => {
  it('fetches browser events without AFK buckets', async () => {
    const client = new MockActivityWatchClient();
    client.setBuckets([createMockBucket('aw-watcher-web_test', 'web.tab.current')]);

    const capabilities = new CapabilitiesService(client as any);
    const service = new QueryService(client as any, capabilities);

    const queryKey = [
      'events = query_bucket("aw-watcher-web_test");',
      'RETURN = events;',
    ].join('\n');

    const events: AWEvent[] = [
      {
        timestamp: '2025-01-01T10:00:00Z',
        duration: 180,
        data: { url: 'https://example.com' },
      },
    ];

    client.setQueryResponse(queryKey, [events]);

    const end = new Date('2025-01-01T11:00:00Z');
    const start = new Date(end.getTime() - 60 * 60 * 1000);

    const result = await service.getBrowserEventsFiltered(start, end);
    expect(result.events).toHaveLength(1);
    expect(result.total_duration_seconds).toBe(180);
  });
});
