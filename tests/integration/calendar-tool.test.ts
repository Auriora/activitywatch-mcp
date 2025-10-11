import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarService } from '../../src/services/calendar.js';
import { CapabilitiesService } from '../../src/services/capabilities.js';
import { formatCalendarEventsConcise, formatCalendarEventsDetailed } from '../../src/utils/formatters.js';
import { MockActivityWatchClient, createMockBucket, createMockEvent } from '../helpers/mock-client.js';

describe('Calendar tool integration', () => {
  let mockClient: MockActivityWatchClient;
  let capabilities: CapabilitiesService;
  let calendarService: CalendarService;

  const bucketId = 'aw-import-ical_bruce-5560';

  beforeEach(() => {
    mockClient = new MockActivityWatchClient();
    capabilities = new CapabilitiesService(mockClient as any);
    calendarService = new CalendarService(mockClient as any, capabilities);

    mockClient.setBuckets([
      createMockBucket(bucketId, 'aw-import-ical'),
    ]);

    mockClient.setEvents(bucketId, [
      createMockEvent('2025-02-10T14:00:00Z', 3600, {
        summary: 'Project Sync',
        start: '2025-02-10T14:00:00Z',
        end: '2025-02-10T15:00:00Z',
        status: 'confirmed',
        location: 'Teams',
      }),
    ]);
  });

  it('formats concise output with calendar precedence message', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: '2025-02-10T00:00:00Z',
      custom_end: '2025-02-11T00:00:00Z',
    });

    const output = formatCalendarEventsConcise(result);

    expect(output).toContain('Calendar Events');
    expect(output).toContain('Project Sync');
    expect(output).toContain(bucketId);
  });

  it('provides detailed output including metadata', async () => {
    const result = await calendarService.getEvents({
      time_period: 'custom',
      custom_start: '2025-02-10T00:00:00Z',
      custom_end: '2025-02-11T00:00:00Z',
    });

    const output = formatCalendarEventsDetailed(result);

    expect(output).toContain('Calendar Events (Detailed)');
    expect(output).toContain('Project Sync');
    expect(output).toContain('Teams');
  });
});
