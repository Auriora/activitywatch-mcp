import { describe, expect, it } from 'vitest';

import {
  formatRawEventsConcise,
  formatQueryResultsConcise,
  formatQueryResultsDetailed,
  formatCalendarEventsConcise,
  formatCalendarEventsDetailed,
  formatPeriodSummaryConcise,
} from '../../../src/utils/formatters.js';
import type { PeriodSummary } from '../../../src/types.js';

const sampleEvent = (overrides: Partial<any> = {}) => ({
  timestamp: '2025-01-01T09:00:00.000Z',
  duration: 120,
  data: {
    app: 'TestApp',
    title: 'Focused work',
    url: 'https://example.com',
    ...overrides,
  },
});

describe('formatRawEventsConcise', () => {
  it('limits preview to 10 events and notes remaining count', () => {
    const events = Array.from({ length: 12 }, () => ({ foo: 'bar' }));
    const formatted = formatRawEventsConcise('aw-watcher-window', events);

    expect(formatted).toContain('Retrieved 12 events from bucket aw-watcher-window');
    expect(formatted).toContain('... and 2 more events');
  });
});

describe('formatQueryResults', () => {
  const base = {
    events: [sampleEvent()],
    total_duration_seconds: 3600,
    query_used: ['RETURN = events;'],
    buckets_queried: ['aw-watcher-window'],
  } as const;

  it('renders concise summary with sample events and query', () => {
    const formatted = formatQueryResultsConcise(base);

    expect(formatted).toContain('Query Results');
    expect(formatted).toContain('Total Events: 1');
    expect(formatted).toContain('TestApp');
    expect(formatted).toContain('RETURN = events;');
  });

  it('renders detailed summary including event payload details', () => {
    const formatted = formatQueryResultsDetailed(base);

    expect(formatted).toContain('Query Results (Detailed)');
    expect(formatted).toContain('Total Duration: 1 hours (3600s)');
    expect(formatted).toContain('Event 1:');
    expect(formatted).toContain('title: "Focused work"');
  });

  it('renders additional events and preserves browser metadata', () => {
    const formatted = formatQueryResultsDetailed({
      events: [
        sampleEvent({ app: 'Editor' }),
        sampleEvent({ url: 'https://example.com/docs', title: 'Docs' }),
      ],
      total_duration_seconds: 7200,
      query_used: ['RETURN = events;'],
      buckets_queried: ['aw-watcher-window'],
    });

    expect(formatted).toContain('Event 2:');
    expect(formatted).toContain('url');
  });
});

describe('formatCalendarEvents', () => {
  const baseResult = {
    events: [
      {
        summary: 'Weekly Sync',
        start: '2025-01-01T10:00:00.000Z',
        end: '2025-01-01T11:00:00.000Z',
        duration_seconds: 3600,
        all_day: false,
        status: 'confirmed',
        location: 'Conference Room',
        calendar: 'Team',
        attendees: [
          { name: 'Alice', email: 'alice@example.com', response_status: 'accepted', organizer: true },
        ],
      },
    ],
    buckets: ['aw-import-ical_team'],
    time_range: { start: '2025-01-01T09:00:00.000Z', end: '2025-01-01T12:00:00.000Z' },
  } as const;

  it('formats concise calendar output with preview and counts', () => {
    const formatted = formatCalendarEventsConcise(baseResult);

    expect(formatted).toContain('Calendar Events');
    expect(formatted).toContain('Events Found: 1');
    expect(formatted).toContain('Weekly Sync');
    expect(formatted).toContain('Buckets Queried: aw-import-ical_team');
  });

  it('formats detailed calendar output including attendees', () => {
    const formatted = formatCalendarEventsDetailed(baseResult);

    expect(formatted).toContain('Calendar Events (Detailed)');
    expect(formatted).toContain('Event 1: Weekly Sync');
    expect(formatted).toContain('Duration: 1h 0m');
    expect(formatted).toContain('Attendees:');
    expect(formatted).toContain('Alice <alice@example.com> (accepted) [organizer]');
  });

  it('handles empty event lists gracefully', () => {
    const baseEmpty = { ...baseResult, events: [] };

    expect(formatCalendarEventsConcise(baseEmpty)).toContain('No calendar events scheduled in this window.');
    expect(formatCalendarEventsDetailed(baseEmpty)).toContain('No calendar events scheduled in this window.');
  });

  it('prints optional calendar fields when present', () => {
    const formatted = formatCalendarEventsDetailed({
      ...baseResult,
      events: [
        {
          summary: 'All Hands',
          start: '2025-01-02T09:00:00.000Z',
          end: '2025-01-02T10:00:00.000Z',
          duration_seconds: 3600,
          all_day: true,
          status: 'tentative',
          location: 'Room 1',
          calendar: 'Org',
          attendees: [],
        },
      ],
    });

    expect(formatted).toContain('All Day: yes');
    expect(formatted).toContain('Status: tentative');
    expect(formatted).toContain('Location: Room 1');
  });
});

describe('formatPeriodSummaryConcise', () => {
  const summary: PeriodSummary = {
    period_type: 'weekly',
    period_start: '2025-01-01T00:00:00.000Z',
    period_end: '2025-01-07T23:59:59.000Z',
    timezone: 'UTC',
    total_active_time_hours: 40,
    total_afk_time_hours: 8,
    focus_time_hours: 25,
    meeting_time_hours: 6,
    top_applications: [
      { name: 'VS Code', duration_hours: 15, percentage: 37.5 },
    ],
    top_websites: [
      { domain: 'github.com', duration_hours: 8, percentage: 20 },
    ],
    top_categories: [
      { category_name: 'Engineering', duration_hours: 20, percentage: 50 },
    ],
    notable_calendar_events: [
      {
        summary: 'Architecture Review',
        start: '2025-01-03T15:00:00.000Z',
        end: '2025-01-03T16:00:00.000Z',
        duration_seconds: 3600,
        status: 'confirmed',
        location: 'Room 42',
        calendar: 'Team',
        all_day: false,
        attendees: [],
      },
    ],
    hourly_breakdown: [
      { hour: 9, active_seconds: 3600, afk_seconds: 0, top_app: 'VS Code' },
      { hour: 10, active_seconds: 1800, afk_seconds: 600, top_app: 'Slack' },
    ],
    daily_breakdown: [
      { date: '2025-01-01', active_seconds: 7200, afk_seconds: 600, top_app: 'VS Code' },
    ],
    weekly_breakdown: [
      {
        week_start: '2024-12-30',
        week_end: '2025-01-05',
        active_seconds: 28800,
        afk_seconds: 3600,
        top_app: 'VS Code',
      },
    ],
    insights: ['Keep focus blocks in the morning', 'Consider shortening meetings'],
  };

  it('renders all optional sections when data is present', () => {
    const formatted = formatPeriodSummaryConcise(summary);

    expect(formatted).toContain('Weekly Summary');
    expect(formatted).toContain('Top Applications:');
    expect(formatted).toContain('Top Websites:');
    expect(formatted).toContain('Top Categories:');
    expect(formatted).toContain('Notable Calendar Events');
    expect(formatted).toContain('Hourly Breakdown:');
    expect(formatted).toContain('Daily Breakdown:');
    expect(formatted).toContain('Weekly Breakdown:');
    expect(formatted).toContain('Insights:');
  });

  it('falls back to generic label for unknown period types', () => {
    const formatted = formatPeriodSummaryConcise({
      ...summary,
      period_type: 'custom_period' as unknown as PeriodSummary['period_type'],
      top_categories: [],
      notable_calendar_events: [],
      hourly_breakdown: [],
      daily_breakdown: [],
      weekly_breakdown: [],
      insights: [],
    });

    expect(formatted).toContain('Period Summary');
  });
});
