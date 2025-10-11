import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarService } from '../../../src/services/calendar.js';
import { CapabilitiesService } from '../../../src/services/capabilities.js';
import { MockActivityWatchClient, createMockBucket, createMockEvent } from '../../helpers/mock-client.js';

describe('CalendarService', () => {
  let mockClient: MockActivityWatchClient;
  let capabilities: CapabilitiesService;
  let calendarService: CalendarService;

  const bucketId = 'aw-import-ical_bruce-5560';
  const customStart = '2025-01-01T00:00:00Z';
  const customEnd = '2025-01-02T00:00:00Z';

  beforeEach(() => {
    mockClient = new MockActivityWatchClient();
    capabilities = new CapabilitiesService(mockClient as any);
    calendarService = new CalendarService(mockClient as any, capabilities);

    mockClient.setBuckets([
      createMockBucket(bucketId, 'aw-import-ical'),
    ]);

    mockClient.setEvents(bucketId, [
      createMockEvent('2025-01-01T09:00:00Z', 1800, {
        summary: 'Daily Standup',
        start: '2025-01-01T09:00:00Z',
        end: '2025-01-01T09:30:00Z',
        location: 'Zoom',
        status: 'confirmed',
        attendees: [
          { name: 'Bruce', email: 'bruce@example.com', responseStatus: 'accepted', organizer: true },
        ],
      }),
      createMockEvent('2025-01-01T12:00:00Z', 0, {
        summary: 'Focus Day',
        start: '2025-01-01',
        end: '2025-01-02',
        all_day: true,
        status: 'confirmed',
      }),
      createMockEvent('2025-01-01T15:00:00Z', 3600, {
        summary: 'Cancelled Sync',
        start: '2025-01-01T15:00:00Z',
        end: '2025-01-01T16:00:00Z',
        status: 'cancelled',
      }),
    ]);
  });

  it('returns normalized events with calendar precedence over AFK', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: customStart,
      custom_end: customEnd,
      include_cancelled: false,
      include_all_day: true,
    });

    expect(result.events.length).toBe(2);
    const standup = result.events.find(event => event.summary === 'Daily Standup');
    expect(standup).toBeDefined();
    if (!standup) throw new Error('Expected Daily Standup event');
    expect(standup.summary).toBe('Daily Standup');
    expect(standup.location).toBe('Zoom');
    expect(standup.duration_seconds).toBeGreaterThan(0);
    expect(standup.attendees?.[0]?.organizer).toBe(true);
    expect(result.buckets).toContain(bucketId);
  });

  it('filters out all-day and cancelled events when requested', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: customStart,
      custom_end: customEnd,
      include_all_day: false,
      include_cancelled: false,
    });

    expect(result.events.every(event => event.all_day === false)).toBe(true);
    expect(result.events.every(event => event.status?.toLowerCase() !== 'cancelled')).toBe(true);
  });

  it('applies text filtering across summary, location, and description', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: customStart,
      custom_end: customEnd,
      summary_query: 'standup',
    });

    expect(result.events.length).toBe(1);
    expect(result.events[0].summary).toBe('Daily Standup');
  });

  it('summarizes events with limited output', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: customStart,
      custom_end: customEnd,
      include_all_day: true,
      include_cancelled: true,
    });

    const summaries = calendarService.summarizeEvents(result.events, 1);
    expect(summaries.length).toBe(1);
    expect(summaries[0].summary).toBeDefined();
    expect(summaries[0].start).toBeDefined();
  });
});
