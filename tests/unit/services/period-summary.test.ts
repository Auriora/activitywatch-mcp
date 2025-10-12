import { describe, it, expect, vi, afterEach } from 'vitest';
import { PeriodSummaryService } from '../../../src/services/period-summary.js';
import type { AWEvent } from '../../../src/types.js';

const buildActivity = () => ({
  total_time_seconds: 5400,
  time_range: {
    start: '2025-01-01T09:00:00.000Z',
    end: '2025-01-01T11:00:00.000Z',
  },
  activities: [
    {
      app: 'FocusApp',
      title: 'Coding Session',
      duration_seconds: 3600,
      duration_hours: 1,
      percentage: 66.67,
      event_count: 1,
      first_seen: '2025-01-01T09:00:00.000Z',
      last_seen: '2025-01-01T10:00:00.000Z',
      calendar: [
        {
          meeting_id: 'meeting-1',
          summary: 'Daily Standup',
          start: '2025-01-01T09:00:00.000Z',
          end: '2025-01-01T10:00:00.000Z',
          status: 'confirmed',
          all_day: false,
          overlap_seconds: 3600,
        },
      ],
      meeting_overlap_seconds: 3600,
    },
    {
      app: 'Primary',
      title: 'One-on-one',
      duration_seconds: 1800,
      duration_hours: 0.5,
      percentage: 33.33,
      event_count: 1,
      first_seen: '2025-01-01T10:30:00.000Z',
      last_seen: '2025-01-01T11:00:00.000Z',
      calendar_only: true,
      calendar: [
        {
          meeting_id: 'meeting-2',
          summary: 'One-on-one',
          start: '2025-01-01T10:30:00.000Z',
          end: '2025-01-01T11:00:00.000Z',
          status: 'confirmed',
          all_day: false,
          overlap_seconds: 0,
          meeting_only_seconds: 1800,
        },
      ],
    },
  ],
  calendar_summary: {
    focus_seconds: 3600,
    meeting_seconds: 5400,
    meeting_only_seconds: 1800,
    overlap_seconds: 3600,
    union_seconds: 5400,
    meeting_count: 2,
  },
});

describe('PeriodSummaryService calendar integration', () => {
  it('reports focus and meeting hours separately', async () => {
    const unifiedService = {
      getActivity: vi.fn().mockResolvedValue(buildActivity()),
    } as any;

    const queryService = {
      getAllEventsFiltered: vi.fn(),
    } as any;

    const afkService = {
      getAfkStats: vi.fn().mockRejectedValue(new Error('no afk data')),
    } as any;

    const categoryService = {
      hasCategories: vi.fn().mockReturnValue(false),
    } as any;

    const calendarService = {
      getEvents: vi.fn().mockResolvedValue({
        events: [],
        buckets: [],
        time_range: {
          start: '2025-01-01T09:00:00.000Z',
          end: '2025-01-01T11:00:00.000Z',
        },
      }),
      summarizeEvents: vi.fn().mockReturnValue([]),
    } as any;

    const service = new PeriodSummaryService(
      unifiedService,
      queryService,
      afkService,
      categoryService,
      calendarService
    );

    const summary = await service.getPeriodSummary({
      period_type: 'daily',
      date: '2025-01-01',
      detail_level: 'none',
    });

    expect(summary.total_active_time_hours).toBeCloseTo(1.5);
    expect(summary.focus_time_hours).toBeCloseTo(1);
    expect(summary.meeting_time_hours).toBeCloseTo(1.5);
    expect(summary.total_afk_time_hours).toBeGreaterThanOrEqual(0);
  });

  it('produces hourly breakdown and uses AFK stats fallback', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T12:00:00.000Z'));

    const unifiedService = {
      getActivity: vi.fn().mockResolvedValue({
        total_time_seconds: 3600,
        activities: [
          {
            app: 'Editor',
            duration_seconds: 3600,
            duration_hours: 1,
            percentage: 100,
            event_count: 1,
          },
        ],
      }),
    } as any;

    const windowEvents: AWEvent[] = [
      {
        id: 1,
        timestamp: '2025-01-07T09:00:00.000Z',
        duration: 1800,
        data: { app: 'Editor', title: 'Feature Work' },
      },
    ];

    const queryService = {
      getWindowEventsFiltered: vi.fn().mockResolvedValue({ events: windowEvents }),
      getAllEventsFiltered: vi.fn().mockResolvedValue([]),
    } as any;

    const afkService = {
      getAfkActivity: undefined,
      getAfkStats: vi.fn().mockResolvedValue({ afk_seconds: 600, active_seconds: 3000 }),
    } as any;

    const service = new PeriodSummaryService(
      unifiedService,
      queryService,
      afkService,
    );

    const summary = await service.getPeriodSummary({
      period_type: 'last_24_hours',
      detail_level: 'hourly',
    });

    expect(summary.hourly_breakdown).toBeDefined();
    expect(summary.hourly_breakdown?.length).toBeGreaterThan(0);
    expect(summary.total_afk_time_hours).toBeCloseTo(0.17, 2);
    expect(summary.total_active_time_hours).toBeGreaterThan(0.5);

    vi.useRealTimers();
  });

  it('builds daily breakdown with categories and calendar summaries', async () => {
    const unifiedService = {
      getActivity: vi.fn().mockResolvedValue({
        total_time_seconds: 5400,
        activities: [
          {
            app: 'Editor',
            duration_seconds: 3600,
            duration_hours: 1,
            percentage: 66,
            event_count: 1,
          },
        ],
      }),
    } as any;

    const windowEvents: AWEvent[] = [
      {
        id: 1,
        timestamp: '2025-01-01T09:00:00.000Z',
        duration: 3600,
        data: { app: 'Editor', title: 'Feature Work' },
      },
    ];

    const browserEvents: AWEvent[] = [
      {
        id: 2,
        timestamp: '2025-01-01T09:15:00.000Z',
        duration: 900,
        data: { url: 'https://example.com/docs', title: 'Docs' },
      },
    ];

    const queryService = {
      getWindowEventsFiltered: vi.fn().mockResolvedValue({ events: windowEvents }),
      getBrowserEventsFiltered: vi.fn().mockResolvedValue({ events: browserEvents }),
      getAllEventsFiltered: vi.fn().mockResolvedValue(windowEvents),
    } as any;

    const afkService = {
      getAfkActivity: vi.fn().mockResolvedValue({
        total_afk_seconds: 600,
        total_active_seconds: 3000,
        afk_periods: [
          { start: '2025-01-01T11:00:00.000Z', end: '2025-01-01T11:10:00.000Z', duration_seconds: 600, status: 'afk' },
        ],
      }),
    } as any;

    const categoryService = {
      hasCategories: vi.fn().mockReturnValue(true),
      categorizeEvents: vi.fn().mockReturnValue([
        {
          category_name: 'Work > Coding',
          duration_seconds: 3000,
          duration_hours: 0.83,
          percentage: 90,
          event_count: 1,
        },
      ]),
    } as any;

    const calendarService = {
      getEvents: vi.fn().mockResolvedValue({
        events: [],
        buckets: [],
        time_range: { start: '2025-01-01T00:00:00.000Z', end: '2025-01-02T00:00:00.000Z' },
      }),
      summarizeEvents: vi.fn().mockReturnValue([{ summary: 'Retrospective' }]),
    } as any;

    const service = new PeriodSummaryService(
      unifiedService,
      queryService,
      afkService,
      categoryService,
      calendarService
    );

    const summary = await service.getPeriodSummary({
      period_type: 'daily',
      date: '2025-01-01',
      detail_level: 'daily',
    });

    expect(summary.daily_breakdown).toBeDefined();
    expect(summary.daily_breakdown?.[0].top_app).toBe('Editor');
    expect(summary.daily_breakdown?.[0].top_website).toBe('example.com');
    expect(summary.top_categories?.[0].category_name).toBe('Work > Coding');
    expect(summary.notable_calendar_events?.[0].summary).toBe('Retrospective');
    expect(summary.insights.length).toBeGreaterThan(0);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
