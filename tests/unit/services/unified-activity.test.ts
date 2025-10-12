import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedActivityService } from '../../../src/services/unified-activity.js';
import type { AWEvent, CalendarEvent, UnifiedActivityResult } from '../../../src/types.js';

const makeAwEvent = (timestamp: string, duration: number, data: Record<string, unknown>): AWEvent => ({
  id: Math.floor(Math.random() * 100000),
  timestamp,
  duration,
  data,
});

const makeCalendarEvent = (id: string, start: string, end: string, summary: string): CalendarEvent => ({
  id,
  summary,
  start,
  end,
  all_day: false,
  status: 'confirmed',
  calendar: 'Primary',
  source_bucket: 'aw-import-ical_primary',
  duration_seconds: (new Date(end).getTime() - new Date(start).getTime()) / 1000,
});

describe('UnifiedActivityService calendar overlay', () => {
  const queryService = {
    getCanonicalEvents: vi.fn(),
  } as any;

  const categoryService = {
    getCategories: vi.fn().mockReturnValue([]),
  } as any;

  const calendarService = {
    getEvents: vi.fn(),
  } as any;

  let service: UnifiedActivityService;

  beforeEach(() => {
    queryService.getCanonicalEvents.mockReset();
    categoryService.getCategories.mockReset();
    calendarService.getEvents.mockReset();

    categoryService.getCategories.mockReturnValue([]);

    service = new UnifiedActivityService(
      queryService,
      categoryService,
      calendarService
    );
  });

  it('adds calendar metadata and calendar-only events without double-counting', async () => {
    const windowEvent = makeAwEvent('2025-01-01T09:00:00.000Z', 3600, {
      app: 'FocusApp',
      title: 'Coding Session',
    });

    queryService.getCanonicalEvents.mockResolvedValue({
      window_events: [windowEvent],
      browser_events: [],
      editor_events: [],
      total_duration_seconds: 3600,
    });

    const overlappingMeeting = makeCalendarEvent(
      'meeting-1',
      '2025-01-01T09:00:00.000Z',
      '2025-01-01T10:00:00.000Z',
      'Daily Standup'
    );

    const calendarOnlyMeeting = makeCalendarEvent(
      'meeting-2',
      '2025-01-01T10:30:00.000Z',
      '2025-01-01T11:00:00.000Z',
      'One-on-one'
    );

    calendarService.getEvents.mockResolvedValue({
      events: [overlappingMeeting, calendarOnlyMeeting],
      buckets: ['aw-import-ical_primary'],
      time_range: {
        start: '2025-01-01T08:00:00.000Z',
        end: '2025-01-01T12:00:00.000Z',
      },
    });

    const params = {
      time_period: 'custom',
      custom_start: '2025-01-01T08:00:00.000Z',
      custom_end: '2025-01-01T12:00:00.000Z',
      response_format: 'detailed',
    } as const;

    const result: UnifiedActivityResult = await service.getActivity(params);

    expect(result.total_time_seconds).toBeCloseTo(5400); // 3600 focus + 1800 meeting-only

    expect(result.calendar_summary).toBeDefined();
    expect(result.calendar_summary?.focus_seconds).toBeCloseTo(3600);
    expect(result.calendar_summary?.meeting_seconds).toBeCloseTo(5400);
    expect(result.calendar_summary?.meeting_only_seconds).toBeCloseTo(1800);
    expect(result.calendar_summary?.union_seconds).toBeCloseTo(5400);
    expect(result.calendar_summary?.meeting_count).toBe(2);

    const focusEntry = result.activities.find(activity => activity.app === 'FocusApp');
    expect(focusEntry).toBeDefined();
    expect(focusEntry?.calendar?.[0].summary).toBe('Daily Standup');
    expect(focusEntry?.meeting_overlap_seconds).toBeCloseTo(3600);

    const calendarEntry = result.activities.find(activity => activity.app === 'Primary');
    expect(calendarEntry).toBeDefined();
    expect(calendarEntry?.calendar_only).toBe(true);
    expect(calendarEntry?.duration_seconds).toBeCloseTo(1800);
  });

  it('respects system app filtering and multi-level grouping', async () => {
    const focusWindow = makeAwEvent('2025-01-01T09:00:00.000Z', 1200, {
      app: 'FocusApp',
      title: 'Feature Work',
    });
    const finderWindow = makeAwEvent('2025-01-01T09:05:00.000Z', 300, {
      app: 'Finder',
      title: 'System',
    });

    queryService.getCanonicalEvents.mockResolvedValue({
      window_events: [focusWindow, finderWindow],
      browser_events: [
        makeAwEvent('2025-01-01T09:10:00.000Z', 600, {
          url: 'https://example.com/docs',
          title: 'Docs',
        }),
      ],
      editor_events: [
        makeAwEvent('2025-01-01T09:00:00.000Z', 1200, {
          file: 'main.ts',
          project: 'ProjectX',
          language: 'TypeScript',
        }),
      ],
      total_duration_seconds: 1500,
    });

    categoryService.getCategories.mockReturnValue([
      {
        id: 1,
        name: ['Work', 'Coding'],
        rule: { type: 'regex', regex: 'Focus' },
      },
    ]);

    const params = {
      time_period: 'custom',
      custom_start: '2025-01-01T09:00:00.000Z',
      custom_end: '2025-01-01T11:00:00.000Z',
      exclude_system_apps: true,
      min_duration_seconds: 600,
      group_by: ['category', 'application'] as const,
      top_n: 5,
    };

    const result: UnifiedActivityResult = await service.getActivity(params);

    expect(result.activities.some(a => a.app.includes('Finder'))).toBe(false);
    const activity = result.activities.find(a => a.app.includes('FocusApp'));
    expect(activity).toBeDefined();
    if (!activity) return;
    expect(activity.browser?.domain).toBe('example.com');
    expect(activity.editor?.project).toBe('ProjectX');
    expect(activity.category).toBe('Work > Coding');
    expect(categoryService.getCategories).toHaveBeenCalled();
  });
});
