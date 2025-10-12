import { describe, it, expect, vi } from 'vitest';

import {
  createServerWithDependencies,
  type ServerDependencies,
} from '../../src/server-factory.js';

const createDeps = () => {
  const client = {
    getBuckets: vi.fn().mockResolvedValue({
      'aw-watcher-window_test': { id: 'aw-watcher-window_test', type: 'currentwindow' },
    }),
    getEvents: vi.fn().mockResolvedValue([
      {
        timestamp: '2025-01-01T09:00:00.000Z',
        duration: 120,
        data: { app: 'TestApp' },
      },
    ]),
    query: vi.fn(),
  };

  const capabilitiesService = {
    getAvailableBuckets: vi.fn().mockResolvedValue([]),
    detectCapabilities: vi.fn().mockResolvedValue({
      has_window_tracking: true,
      has_browser_tracking: true,
      has_afk_detection: true,
      has_editor_tracking: true,
      has_calendar_events: true,
      has_categories: true,
      user_preferences: {},
    }),
    getSuggestedTools: vi.fn().mockResolvedValue(['aw_get_activity']),
    setCategoriesConfigured: vi.fn(),
  };

  const categoryService = {
    loadFromActivityWatch: vi.fn().mockResolvedValue(undefined),
    hasCategories: vi.fn().mockReturnValue(false),
    getCategories: vi.fn().mockReturnValue([]),
    reloadCategories: vi.fn().mockResolvedValue(undefined),
    getCategoryById: vi.fn().mockReturnValue(undefined),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  };

  const unifiedService = {
    getActivity: vi.fn().mockResolvedValue({
      total_time_seconds: 3600,
      activities: [
        {
          app: 'TestApp',
          duration_hours: 1,
          percentage: 100,
          category: 'Work',
          event_count: 2,
        },
      ],
    }),
  };

  const calendarService = {
    getEvents: vi.fn().mockResolvedValue({
      events: [
        {
          summary: 'Weekly Sync',
          start: '2025-01-01T10:00:00.000Z',
          end: '2025-01-01T11:00:00.000Z',
          duration_seconds: 3600,
          all_day: false,
          status: 'confirmed',
          location: 'Room 1',
          calendar: 'Team',
          attendees: [],
        },
      ],
      buckets: ['aw-import-ical_team'],
      time_range: {
        start: '2025-01-01T09:00:00.000Z',
        end: '2025-01-01T12:00:00.000Z',
      },
    }),
  };

  const queryBuilderService = {
    queryEvents: vi.fn().mockResolvedValue({
      events: [
        {
          timestamp: '2025-01-01T09:00:00.000Z',
          duration: 120,
          data: { app: 'TestApp' },
        },
      ],
      total_duration_seconds: 120,
      query_used: ['RETURN = events;'],
      buckets_queried: ['aw-watcher-window_test'],
    }),
  };

  const queryService = {
    getWindowEventsFiltered: vi.fn(),
    getBrowserEventsFiltered: vi.fn(),
    getEditorEventsFiltered: vi.fn(),
    getAllEventsFiltered: vi.fn(),
    getCanonicalEvents: vi.fn(),
  };

  const afkService = {
    getAfkActivity: vi.fn(),
    getAfkStats: vi.fn(),
  };

  const periodSummaryService = {
    getPeriodSummary: vi.fn().mockResolvedValue({
      total_time_seconds: 3600,
      summary: 'Test Summary',
    }),
  };

  return {
    client: client as unknown as ServerDependencies['client'],
    capabilitiesService: capabilitiesService as unknown as ServerDependencies['capabilitiesService'],
    categoryService: categoryService as unknown as ServerDependencies['categoryService'],
    queryService: queryService as unknown as ServerDependencies['queryService'],
    queryBuilderService: queryBuilderService as unknown as ServerDependencies['queryBuilderService'],
    calendarService: calendarService as unknown as ServerDependencies['calendarService'],
    afkService: afkService as unknown as ServerDependencies['afkService'],
    unifiedService: unifiedService as unknown as ServerDependencies['unifiedService'],
    periodSummaryService: periodSummaryService as unknown as ServerDependencies['periodSummaryService'],
  } as ServerDependencies;
};

const createServer = async (
  overrides: Partial<ServerDependencies> = {},
) => {
  const deps = createDeps();
  const merged = { ...deps, ...overrides } as ServerDependencies;
  const server = await createServerWithDependencies(merged, {
    loadCategories: false,
    performHealthCheck: false,
  });
  return { server, deps: merged };
};

const callTool = async (server: any, name: string, args: Record<string, unknown>) => {
  const handlers: Map<string, any> = (server as any)._requestHandlers;
  const handler = handlers.get('tools/call');
  if (!handler) {
    throw new Error('tools/call handler not registered');
  }

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  };

  return handler(request, {
    signal: new AbortController().signal,
    requestId: 1,
    sendNotification: vi.fn(),
    sendRequest: vi.fn(),
  });
};

describe('Server tool handlers', () => {
  it('returns concise activity summary', async () => {
    const { server } = await createServer();

    const response = await callTool(server, 'aw_get_activity', {
      response_format: 'concise',
      time_period: 'today',
    });

    const text = response.content[0]?.text ?? '';
    expect(text).toContain('Activity Summary');
    expect(text).toContain('Total Active Time');
  });

  it('returns detailed JSON for activity when no format specified', async () => {
    const { server } = await createServer();

    const response = await callTool(server, 'aw_get_activity', {
      time_period: 'today',
    });

    const payload = JSON.parse(response.content[0]?.text ?? '{}');
    expect(payload.total_time_seconds).toBe(3600);
  });

  it('formats calendar events in detailed mode', async () => {
    const { server } = await createServer();

    const response = await callTool(server, 'aw_get_calendar_events', {
      response_format: 'detailed',
      time_period: 'today',
    });

    const text = response.content[0]?.text ?? '';
    expect(text).toContain('Calendar Events (Detailed)');
    expect(text).toContain('Weekly Sync');
  });

  it('formats query events in detailed mode', async () => {
    const { server } = await createServer();

    const response = await callTool(server, 'aw_query_events', {
      response_format: 'detailed',
      query_type: 'window',
      start_time: '2025-01-01T00:00:00.000Z',
      end_time: '2025-01-02T00:00:00.000Z',
    });

    const text = response.content[0]?.text ?? '';
    expect(text).toContain('Query Results (Detailed)');
    expect(text).toContain('Total Duration');
  });

  it('returns raw events payload for aw_get_raw_events', async () => {
    const { server } = await createServer();

    const response = await callTool(server, 'aw_get_raw_events', {
      bucket_id: 'aw-watcher-window_test',
      start_time: '2025-01-01T00:00:00.000Z',
      end_time: '2025-01-01T01:00:00.000Z',
      response_format: 'raw',
    });

    const payload = JSON.parse(response.content[0]?.text ?? '[]');
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]?.duration).toBe(120);
  });
});
