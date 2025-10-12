import { describe, it, expect, vi } from 'vitest';

import { AfkActivityService } from '../../../src/services/afk-activity.js';

const bucket = (id: string) => ({ id, type: 'afkstatus' });

const makeEvent = (timestamp: string, duration: number, status: string) => ({
  timestamp,
  duration,
  data: { status },
});

describe('AfkActivityService', () => {
  it('returns active-only summary when no AFK buckets exist', async () => {
    const client = { getEvents: vi.fn() } as any;
    const capabilities = { findAfkBuckets: vi.fn().mockResolvedValue([]) } as any;

    const service = new AfkActivityService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T10:00:00.000Z');

    const summary = await service.getAfkActivity(start, end);

    expect(summary.total_afk_seconds).toBe(0);
    expect(summary.total_active_seconds).toBe(3600);
    expect(summary.afk_periods).toHaveLength(0);
  });

  it('aggregates AFK and active periods from bucket events', async () => {
    const events = [
      makeEvent('2025-01-01T09:00:00.000Z', 300, 'afk'),
      makeEvent('2025-01-01T09:05:00.000Z', 600, 'not-afk'),
      makeEvent('2025-01-01T09:15:00.000Z', 60, 'unknown'),
    ];

    const client = {
      getEvents: vi.fn().mockResolvedValueOnce(events),
    } as any;

    const capabilities = {
      findAfkBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-afk_main')]),
    } as any;

    const service = new AfkActivityService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T10:30:00.000Z');

    const summary = await service.getAfkActivity(start, end);

    expect(summary.total_afk_seconds).toBe(300);
    expect(summary.total_active_seconds).toBe(600);
    expect(summary.afk_percentage).toBeCloseTo(33.33, 2);
    expect(summary.afk_periods).toHaveLength(2);
    expect(summary.afk_periods[0]?.status).toBe('afk');
    expect(summary.afk_periods[1]?.status).toBe('not-afk');
  });

  it('exposes simple AFK stats wrapper', async () => {
    const client = { getEvents: vi.fn().mockResolvedValueOnce([makeEvent('2025-01-01T09:00:00.000Z', 120, 'afk')]) } as any;
    const capabilities = { findAfkBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-afk_main')]) } as any;

    const service = new AfkActivityService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T09:10:00.000Z');

    const stats = await service.getAfkStats(start, end);
    expect(stats).toEqual({ afk_seconds: 120, active_seconds: 0 });
  });
});
