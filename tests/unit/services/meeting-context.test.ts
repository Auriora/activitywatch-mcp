import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedActivityService } from '../../../src/services/unified-activity.js';
import type { AWEvent, CalendarEvent } from '../../../src/types.js';

const makeAwEvent = (timestamp: string, duration: number, data: Record<string, unknown>): AWEvent => ({
  id: Math.floor(Math.random() * 100000),
  timestamp,
  duration,
  data,
});

const makeMeeting = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => {
  const start = overrides.start ?? '2025-10-15T09:00:00.000Z';
  const end = overrides.end ?? '2025-10-15T10:00:00.000Z';
  return {
    id: overrides.id ?? 'aw-import-ical_primary:meeting-1',
    summary: overrides.summary ?? 'Product Sync',
    start,
    end,
    duration_seconds: overrides.duration_seconds ?? ((new Date(end).getTime() - new Date(start).getTime()) / 1000),
    all_day: false,
    status: overrides.status ?? 'confirmed',
    calendar: overrides.calendar ?? 'Primary',
    source_bucket: overrides.source_bucket ?? 'aw-import-ical_primary',
    attendees: overrides.attendees ?? [
      { name: 'Alice Example', email: 'alice@example.com', response_status: 'accepted', organizer: true },
    ],
    metadata: overrides.metadata,
    description: overrides.description,
    location: overrides.location ?? 'Zoom',
    is_recurring: overrides.is_recurring ?? false,
  };
};

describe('UnifiedActivityService.getMeetingContext', () => {
  const queryService = {
    getCanonicalEvents: vi.fn(),
  } as any;

  const categoryService = {
    getCategories: vi.fn().mockReturnValue([]),
  } as any;

  const calendarService = {
    getEventById: vi.fn(),
    getEvents: vi.fn(),
  } as any;

  let service: UnifiedActivityService;

  beforeEach(() => {
    queryService.getCanonicalEvents.mockReset();
    calendarService.getEventById.mockReset();
    calendarService.getEvents.mockReset();
    service = new UnifiedActivityService(
      queryService,
      categoryService,
      calendarService
    );
  });

  it('returns focused app overlap for a specific meeting id', async () => {
    const meeting = makeMeeting();
    calendarService.getEventById.mockResolvedValue(meeting);

    const windowEvent = makeAwEvent('2025-10-15T09:15:00.000Z', 1800, {
      app: 'Code',
      title: 'Review PR #42',
    });

    queryService.getCanonicalEvents.mockResolvedValue({
      window_events: [windowEvent],
      browser_events: [],
      editor_events: [
        makeAwEvent('2025-10-15T09:20:00.000Z', 900, {
          file: 'src/index.ts',
          project: 'mcp-adapter',
          language: 'TypeScript',
        }),
      ],
    });

    const result = await service.getMeetingContext({
      meeting_id: meeting.id,
      min_duration_seconds: 60,
      exclude_system_apps: true,
    });

    expect(result.meetings).toHaveLength(1);
    const [entry] = result.meetings;
    expect(entry.meeting.summary).toBe('Product Sync');
    expect(entry.totals.scheduled_seconds).toBe(3600);
    expect(entry.totals.overlap_seconds).toBe(1800);
    expect(entry.totals.meeting_only_seconds).toBe(1800);
    expect(entry.focus).toHaveLength(1);
    expect(entry.focus[0]?.app).toBe('Code');
    expect(entry.focus[0]?.duration_seconds).toBe(1800);
    expect(entry.focus[0]?.percentage).toBeCloseTo(50);
    expect(entry.focus[0]?.editor?.file).toBe('src/index.ts');
  });

  it('reports meeting-only time when no overlapping focus is present', async () => {
    const meeting = makeMeeting({
      id: 'aw-import-ical_primary:meeting-2',
      start: '2025-10-15T13:00:00.000Z',
      end: '2025-10-15T13:30:00.000Z',
      summary: 'Customer Call',
    });

    calendarService.getEventById.mockResolvedValue(null);
    calendarService.getEvents.mockResolvedValue({
      events: [meeting],
      buckets: ['aw-import-ical_primary'],
      time_range: {
        start: '2025-10-15T13:00:00.000Z',
        end: '2025-10-15T14:00:00.000Z',
      },
    });

    queryService.getCanonicalEvents.mockResolvedValue({
      window_events: [],
      browser_events: [],
      editor_events: [],
    });

    const result = await service.getMeetingContext({
      time_period: 'custom',
      custom_start: '2025-10-15T13:00:00.000Z',
      custom_end: '2025-10-15T14:00:00.000Z',
    });

    expect(result.meetings).toHaveLength(1);
    const [entry] = result.meetings;
    expect(entry.focus).toEqual([]);
    expect(entry.totals.overlap_seconds).toBe(0);
    expect(entry.totals.meeting_only_seconds).toBe(1800);
  });

  it('returns graceful message when meeting is not found', async () => {
    calendarService.getEventById.mockResolvedValue(null);

    const result = await service.getMeetingContext({
      meeting_id: 'aw-import-ical_primary:missing',
    });

    expect(result.meetings).toEqual([]);
    expect(result.message).toContain('No meeting found');
  });
});
