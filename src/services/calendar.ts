/**
 * Service for working with ActivityWatch calendar import buckets
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import {
  CalendarEvent,
  CalendarEventSummary,
  AWEvent,
  TimePeriod,
} from '../types.js';
import { AWError } from '../types.js';
import {
  getTimeRange,
  formatDateForAPI,
  parseDate,
} from '../utils/time.js';
import { logger } from '../utils/logger.js';

export interface CalendarEventsParams {
  readonly time_period?: TimePeriod;
  readonly custom_start?: string;
  readonly custom_end?: string;
  readonly include_all_day?: boolean;
  readonly include_cancelled?: boolean;
  readonly summary_query?: string;
  readonly limit?: number;
}

export interface CalendarEventsResult {
  readonly events: readonly CalendarEvent[];
  readonly buckets: readonly string[];
  readonly time_range: {
    readonly start: string;
    readonly end: string;
  };
}

/**
 * Extracts normalized calendar data from import buckets while ensuring
 * calendar events are always preserved regardless of AFK status.
 */
export class CalendarService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService
  ) {}

  /**
   * Retrieve calendar events within the requested window.
   * Calendar events are always returned even if the user was AFK during the meeting,
   * satisfying the precedence requirement of calendars over AFK detection.
   */
  async getEvents(params: CalendarEventsParams): Promise<CalendarEventsResult> {
    const buckets = await this.capabilities.findCalendarBuckets();

    if (buckets.length === 0) {
      throw new AWError(
        'No calendar import buckets found. Ensure aw-import-ical is running and data is available.',
        'CALENDAR_BUCKET_MISSING'
      );
    }

    const { start, end } = this.resolveTimeRange(params);
    const startIso = formatDateForAPI(start);
    const endIso = formatDateForAPI(end);

    const includeAllDay = params.include_all_day ?? true;
    const includeCancelled = params.include_cancelled ?? false;
    const limit = params.limit ?? 100;
    const summaryQuery = params.summary_query?.toLowerCase();

    logger.debug('Fetching calendar events', {
      buckets: buckets.length,
      start: startIso,
      end: endIso,
      includeAllDay,
      includeCancelled,
      summaryQuery,
      limit,
    });

    const allEvents: CalendarEvent[] = [];

    for (const bucket of buckets) {
      const events = await this.client.getEvents(bucket.id, {
        start: startIso,
        end: endIso,
        limit,
      });

      for (const event of events) {
        const normalized = this.normalizeEvent(event, bucket.id);

        if (!normalized) {
          continue;
        }

        if (!includeAllDay && normalized.all_day) {
          continue;
        }

        if (!includeCancelled && normalized.status?.toLowerCase() === 'cancelled') {
          continue;
        }

        if (summaryQuery && !this.matchesQuery(normalized, summaryQuery)) {
          continue;
        }

        allEvents.push(normalized);
      }
    }

    // Sort by start time ascending and cap to requested limit overall
    const sorted = allEvents
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, limit);

    return {
      events: sorted,
      buckets: buckets.map(b => b.id),
      time_range: {
        start: startIso,
        end: endIso,
      },
    };
  }

  /**
   * Convert normalized events into lightweight summaries for dashboards.
   */
  summarizeEvents(
    events: readonly CalendarEvent[],
    limit: number = 5
  ): CalendarEventSummary[] {
    return events
      .slice(0, limit)
      .map(event => ({
        summary: event.summary,
        start: event.start,
        end: event.end,
        status: event.status,
        all_day: event.all_day,
        location: event.location,
        calendar: event.calendar,
      }));
  }

  private resolveTimeRange(params: CalendarEventsParams): { start: Date; end: Date } {
    if (params.time_period && params.time_period !== 'custom') {
      return getTimeRange(params.time_period);
    }

    if (params.time_period === 'custom') {
      if (!params.custom_start || !params.custom_end) {
        throw new AWError(
          'custom_start and custom_end are required when time_period is "custom"',
          'CALENDAR_INVALID_RANGE'
        );
      }

      const start = parseDate(params.custom_start);
      const end = parseDate(params.custom_end);

      if (start >= end) {
        throw new AWError(
          'custom_end must be after custom_start for calendar events',
          'CALENDAR_INVALID_RANGE'
        );
      }

      return { start, end };
    }

    if (params.custom_start && params.custom_end) {
      const start = parseDate(params.custom_start);
      const end = parseDate(params.custom_end);

      if (start >= end) {
        throw new AWError(
          'custom_end must be after custom_start for calendar events',
          'CALENDAR_INVALID_RANGE'
        );
      }

      return { start, end };
    }

    // Default to today
    return getTimeRange('today');
  }

  private normalizeEvent(event: AWEvent, bucketId: string): CalendarEvent | null {
    const data = event.data || {};
    const summary: string = String(data.summary ?? data.title ?? 'Untitled event');
    const rawStart = (data.start ?? data.begin) as unknown;
    const rawEnd = (data.end ?? data.finish) as unknown;

    const start = this.toIsoTimestamp(rawStart);
    const end = this.toIsoTimestamp(rawEnd);

    if (!start || !end) {
      logger.warn('Skipping calendar event without valid start/end', {
        eventId: event.id,
        bucketId,
      });
      return null;
    }

    const allDay = Boolean(data.all_day ?? data.allDay ?? false);
    const status = data.status ? String(data.status) : undefined;
    const calendar = data.calendar ? String(data.calendar) : undefined;
    const location = data.location ? String(data.location) : undefined;
    const description = data.description ? String(data.description) : undefined;
    const isRecurring = Boolean(data.recurring ?? data.is_recurring ?? false);
    const attendees = Array.isArray(data.attendees)
      ? data.attendees.map(attendee => ({
          name: attendee?.name ?? attendee?.displayName,
          email: attendee?.email ?? attendee?.address,
          response_status: attendee?.responseStatus ?? attendee?.status,
          organizer: Boolean(attendee?.organizer),
        }))
      : undefined;

    const durationSeconds = this.calculateDuration(start, end, allDay, event.duration);

    return {
      id: this.buildEventId(event, bucketId),
      summary,
      description,
      location,
      calendar,
      start,
      end,
      all_day: allDay,
      status,
      is_recurring: isRecurring,
      source_bucket: bucketId,
      attendees,
      metadata: data,
      duration_seconds: durationSeconds,
    };
  }

  private buildEventId(event: AWEvent, bucketId: string): string {
    const uid = event.data?.uid ?? event.data?.id ?? event.id;
    return `${bucketId}:${uid ?? Math.random().toString(36).slice(2)}`;
  }

  private toIsoTimestamp(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      // If it's already ISO or YYYY-MM-DD, Date can handle it
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }

      // Try to treat as date only
      const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnlyMatch) {
        const [year, month, day] = dateOnlyMatch.slice(1).map(Number);
        return new Date(Date.UTC(year, month - 1, day)).toISOString();
      }

      return null;
    }

    if (typeof value === 'object') {
      const maybeDate = value as Record<string, unknown>;
      if (typeof maybeDate.dateTime === 'string') {
        const parsed = new Date(maybeDate.dateTime);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      if (typeof maybeDate.date === 'string') {
        const parsed = new Date(maybeDate.date);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
    }

    return null;
  }

  private calculateDuration(
    startIso: string,
    endIso: string,
    allDay: boolean,
    fallbackDuration?: number
  ): number {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();

    if (!isNaN(start) && !isNaN(end) && end > start) {
      const diff = Math.floor((end - start) / 1000);
      if (diff > 0) {
        return diff;
      }
    }

    if (typeof fallbackDuration === 'number' && fallbackDuration > 0) {
      return Math.floor(fallbackDuration);
    }

    // Default for all-day events is 24h to make precedence calculations clearer
    if (allDay) {
      return 86400;
    }

    return 0;
  }

  private matchesQuery(event: CalendarEvent, query: string): boolean {
    const haystacks = [
      event.summary,
      event.description,
      event.location,
      event.calendar,
    ]
      .filter(Boolean)
      .map(value => value!.toLowerCase());

    return haystacks.some(text => text.includes(query));
  }
}
