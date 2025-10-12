import { describe, expect, it } from 'vitest';

import {
  formatRawEventsConcise,
  formatQueryResultsConcise,
  formatQueryResultsDetailed,
  formatCalendarEventsConcise,
  formatCalendarEventsDetailed,
} from '../../../src/utils/formatters.js';

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
});
