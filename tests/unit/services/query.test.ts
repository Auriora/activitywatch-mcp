import { describe, it, expect, vi } from 'vitest';

import { QueryService } from '../../../src/services/query.js';

type BucketStub = { id: string; type: string };

const bucket = (id: string, type: string): BucketStub => ({ id, type });

const createClient = (results: unknown[]) => {
  const queryMock = vi.fn().mockResolvedValue(results);
  return {
    query: queryMock,
  } as any;
};

const createCapabilities = (overrides: Partial<Record<string, any>>) => {
  const defaults = {
    findWindowBuckets: vi.fn().mockResolvedValue([]),
    findEditorBuckets: vi.fn().mockResolvedValue([]),
    findBrowserBuckets: vi.fn().mockResolvedValue([]),
    findAfkBuckets: vi.fn().mockResolvedValue([]),
  };
  return { ...defaults, ...overrides } as any;
};

const event = (duration: number, data: Record<string, any> = {}) => ({
  timestamp: '2025-01-01T10:00:00.000Z',
  duration,
  data,
});

describe('QueryService helper methods', () => {
  it('merges window and editor buckets while filtering AFK periods', async () => {
    const client = createClient([[event(120), event(60)]]);
    const capabilities = createCapabilities({
      findWindowBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-window_main', 'currentwindow')]),
      findEditorBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-editor_code', 'app.editor.activity')]),
      findAfkBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-afk_main', 'afkstatus')]),
    });

    const service = new QueryService(client, capabilities);

    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T10:00:00.000Z');
    const result = await service.getWindowEventsFiltered(start, end);

    expect(result.total_duration_seconds).toBe(180);
    expect(result.events).toHaveLength(2);

    const [timeperiods, query] = client.query.mock.calls[0];
    expect(timeperiods).toEqual(['2025-01-01T09:00:00.000Z/2025-01-01T10:00:00.000Z']);
    expect(query).toContain('events = merge_events([query_bucket("aw-watcher-window_main"), query_bucket("aw-watcher-editor_code")]);');
    expect(query).toContain('afk_events = query_bucket("aw-watcher-afk_main");');
    expect(query).toContain('events = filter_period_intersect(events, not_afk);');
  });

  it('returns empty results when no browser buckets available', async () => {
    const client = createClient([]);
    const capabilities = createCapabilities({
      findBrowserBuckets: vi.fn().mockResolvedValue([]),
    });

    const service = new QueryService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T10:00:00.000Z');

    const result = await service.getBrowserEventsFiltered(start, end);
    expect(result).toEqual({ events: [], total_duration_seconds: 0 });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('builds browser query with AFK filtering when buckets exist', async () => {
    const client = createClient([[event(200, { url: 'https://example.com' })]]);
    const capabilities = createCapabilities({
      findBrowserBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-web_chrome', 'web.tab.current')]),
      findAfkBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-afk_main', 'afkstatus')]),
    });

    const service = new QueryService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T11:00:00.000Z');

    const result = await service.getBrowserEventsFiltered(start, end);
    expect(result.total_duration_seconds).toBe(200);
    expect(client.query).toHaveBeenCalled();

    const query = client.query.mock.calls[0][1];
    expect(query).toContain('afk_events = query_bucket("aw-watcher-afk_main");');
  });

  it('aggregates canonical events across window, browser, and editor buckets', async () => {
    const client = createClient([{
      window_events: [event(300, { app: 'Google Chrome' })],
      browser_events: [event(100, { url: 'https://example.com' })],
      editor_events: [event(200, { file: 'index.ts' })],
    }]);

    const capabilities = createCapabilities({
      findWindowBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-window_main', 'currentwindow')]),
      findBrowserBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-web-chrome_main', 'web.tab.current')]),
      findEditorBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-editor-code_main', 'app.editor.activity')]),
      findAfkBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-afk_main', 'afkstatus')]),
    });

    const service = new QueryService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T12:00:00.000Z');

    const result = await service.getCanonicalEvents(start, end);

    expect(result.total_duration_seconds).toBe(300);
    expect(result.browser_events).toHaveLength(1);
    expect(result.editor_events).toHaveLength(1);

    const queryLines = client.query.mock.calls[0][1];
    expect(queryLines.join('\n')).toContain('filter_keyvals(window_events, "app"');
    expect(queryLines.join('\n')).toContain('RETURN = {');
  });

  it('combines window and editor event results for categorisation', async () => {
    const client = createClient([]);
    client.query
      .mockResolvedValueOnce([[event(100)]])
      .mockResolvedValueOnce([[event(50)]]);

    const capabilities = createCapabilities({
      findWindowBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-window_main', 'currentwindow')]),
      findEditorBuckets: vi.fn().mockResolvedValue([bucket('aw-watcher-editor_code', 'app.editor.activity')]),
      findAfkBuckets: vi.fn().mockResolvedValue([]),
    });

    const service = new QueryService(client, capabilities);
    const start = new Date('2025-01-01T09:00:00.000Z');
    const end = new Date('2025-01-01T10:00:00.000Z');

    const events = await service.getAllEventsFiltered(start, end);
    expect(events).toHaveLength(2);
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});
