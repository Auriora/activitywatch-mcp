import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CapabilitiesService } from '../../../src/services/capabilities.js';
import { MockActivityWatchClient, createMockBucket } from '../../helpers/mock-client.js';
import * as userPrefs from '../../../src/config/user-preferences.js';
import { AWError } from '../../../src/types.js';

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

describe('CapabilitiesService capability detection', () => {
  let client: MockActivityWatchClient;
  let service: CapabilitiesService;

  beforeEach(() => {
    client = new MockActivityWatchClient();
    service = new CapabilitiesService(client as any);
    vi.spyOn(userPrefs, 'loadUserPreferences').mockReturnValue({
      timezone: 'UTC',
      timezoneOffsetMinutes: 0,
      dateFormat: 'YYYY-MM-DD',
      weekStartsOn: 'monday',
      hourFormat: '24h',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    client.clearMethodFailures();
  });

  it('enriches bucket metadata with data ranges and human descriptions', async () => {
    const bucket = createMockBucket('aw-watcher-window_test', 'custom.type');
    client.setBuckets([bucket]);
    client.setEvents(bucket.id, [
      {
        id: 1,
        timestamp: '2025-01-01T09:00:00.000Z',
        duration: 60,
        data: { app: 'Test' },
      },
      {
        id: 2,
        timestamp: '2025-01-02T10:00:00.000Z',
        duration: 120,
        data: { app: 'Test' },
      },
    ]);

    const buckets = await service.getAvailableBuckets();
    expect(buckets).toHaveLength(1);
    const [info] = buckets;
    expect(info?.dataRange?.earliest).toBe('2025-01-01T09:00:00.000Z');
    expect(info?.dataRange?.latest).toBe('2025-01-02T10:00:00.000Z');
    expect(info?.description).toBe('test-client - custom.type');

    // Subsequent calls use cache without re-fetching events
    client.setEvents(bucket.id, []);
    const secondFetch = await service.getAvailableBuckets();
    expect(secondFetch[0]?.dataRange?.earliest).toBe('2025-01-01T09:00:00.000Z');
  });

  it('detects capabilities based on available buckets and caches results', async () => {
    client.setBuckets([
      createMockBucket('aw-watcher-window_test', 'currentwindow'),
      createMockBucket('aw-watcher-web_test', 'web.tab.current'),
      createMockBucket('aw-watcher-afk_test', 'afkstatus'),
      createMockBucket('aw-watcher-editor_test', 'app.editor.activity'),
      createMockBucket('aw-import-ical_team', 'aw-import-ical'),
    ]);

    const capabilities = await service.detectCapabilities();
    expect(capabilities).toMatchObject({
      has_window_tracking: true,
      has_browser_tracking: true,
      has_afk_detection: true,
      has_editor_tracking: true,
      has_calendar_events: true,
      has_categories: false,
      auth_required: false,
      user_preferences: {
        timezone: 'UTC',
        timezone_offset_minutes: 0,
      },
    });

    // Cached result persists even if buckets change until cache cleared
    client.setBuckets([]);
    const cached = await service.detectCapabilities();
    expect(cached.has_window_tracking).toBe(true);

    service.setCategoriesConfigured(true);
    const updated = await service.detectCapabilities();
    expect(updated.has_categories).toBe(true);
  });

  it('suggests tools aligned with available capabilities', async () => {
    client.setBuckets([
      createMockBucket('aw-watcher-window_test', 'currentwindow'),
      createMockBucket('aw-import-ical_team', 'aw-import-ical'),
    ]);

    const tools = await service.getSuggestedTools();
    expect(tools).toEqual([
      'aw_get_capabilities',
      'aw_get_raw_events',
      'aw_get_window_activity',
      'aw_get_calendar_events',
      'aw_get_period_summary',
    ]);
  });

  it('wraps bucket discovery failures in AWError', async () => {
    client.setMethodError('getBuckets', () => new Error('boom'));

    await service.getAvailableBuckets().then(
      () => {
        throw new Error('Expected error');
      },
      error => {
        expect(error).toBeInstanceOf(AWError);
        expect(error.code).toBe('BUCKET_DISCOVERY_ERROR');
      }
    );
  });
});
