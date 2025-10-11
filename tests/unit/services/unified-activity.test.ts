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
    getCategories: vi.fn().mockResolvedValue([]),
  } as any;

  const calendarService = {
    getEvents: vi.fn(),
  } as any;

  let service: UnifiedActivityService;

  beforeEach(() => {
    queryService.getCanonicalEvents.mockReset();
    categoryService.getCategories.mockReset();
    calendarService.getEvents.mockReset();

    categoryService.getCategories.mockResolvedValue([]);

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
});
