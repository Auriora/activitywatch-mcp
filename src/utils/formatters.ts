/**
 * Common formatting utilities for response output
 */

import { PeriodSummary, AWEvent, CalendarEvent } from '../types.js';
import { secondsToHours, formatDuration } from './time.js';
import type { CalendarEventsResult } from '../services/calendar.js';

/**
 * Format raw events for concise output
 */
export function formatRawEventsConcise(
  bucketId: string,
  events: unknown[]
): string {
  const preview = events.slice(0, 10);
  const hasMore = events.length > 10;

  return `Retrieved ${events.length} events from bucket ${bucketId}\n\n` +
         JSON.stringify(preview, null, 2) +
         (hasMore ? `\n\n... and ${events.length - 10} more events` : '');
}

/**
 * Format query results for concise output
 */
export function formatQueryResultsConcise(data: {
  events: readonly AWEvent[];
  total_duration_seconds: number;
  query_used: readonly string[];
  buckets_queried: readonly string[];
}): string {
  const lines: string[] = [];

  lines.push('Query Results');
  lines.push('=============');
  lines.push('');
  lines.push(`Total Events: ${data.events.length}`);
  lines.push(`Total Duration: ${secondsToHours(data.total_duration_seconds)} hours`);
  lines.push(`Buckets Queried: ${data.buckets_queried.length}`);
  lines.push('');

  if (data.events.length > 0) {
    lines.push('Sample Events (first 10):');
    lines.push('');

    const preview = data.events.slice(0, 10);
    for (const event of preview) {
      const timestamp = new Date(event.timestamp).toLocaleString();
      const duration = secondsToHours(event.duration);
      const app = event.data.app || event.data.url || 'Unknown';
      const title = event.data.title || '';

      lines.push(`  ${timestamp} | ${duration}h | ${app}`);
      if (title) {
        lines.push(`    ${title}`);
      }
    }

    if (data.events.length > 10) {
      lines.push('');
      lines.push(`... and ${data.events.length - 10} more events`);
    }
  }

  lines.push('');
  lines.push('Query Used:');
  for (const line of data.query_used) {
    lines.push(`  ${line}`);
  }

  return lines.join('\n');
}

/**
 * Format query results for detailed output
 */
export function formatQueryResultsDetailed(data: {
  events: readonly AWEvent[];
  total_duration_seconds: number;
  query_used: readonly string[];
  buckets_queried: readonly string[];
}): string {
  const lines: string[] = [];

  lines.push('Query Results (Detailed)');
  lines.push('========================');
  lines.push('');
  lines.push(`Total Events: ${data.events.length}`);
  lines.push(`Total Duration: ${secondsToHours(data.total_duration_seconds)} hours (${data.total_duration_seconds}s)`);
  lines.push(`Buckets Queried: ${data.buckets_queried.join(', ')}`);
  lines.push('');
  lines.push('Query Used:');
  for (const line of data.query_used) {
    lines.push(`  ${line}`);
  }
  lines.push('');
  lines.push('Events:');
  lines.push('');

  for (let i = 0; i < data.events.length; i++) {
    const event = data.events[i];
    const timestamp = new Date(event.timestamp).toISOString();
    const duration = secondsToHours(event.duration);

    lines.push(`Event ${i + 1}:`);
    lines.push(`  Timestamp: ${timestamp}`);
    lines.push(`  Duration: ${duration}h (${event.duration}s)`);
    lines.push(`  Data:`);

    for (const [key, value] of Object.entries(event.data)) {
      lines.push(`    ${key}: ${JSON.stringify(value)}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format calendar events for concise output
 */
export function formatCalendarEventsConcise(result: CalendarEventsResult): string {
  const lines: string[] = [];
  const eventCount = result.events.length;

  lines.push('Calendar Events');
  lines.push('===============');
  lines.push('');
  lines.push(`Events Found: ${eventCount}`);
  lines.push(`Time Range: ${new Date(result.time_range.start).toISOString()} → ${new Date(result.time_range.end).toISOString()}`);
  lines.push(`Buckets Queried: ${result.buckets.join(', ')}`);
  lines.push('');

  if (eventCount === 0) {
    lines.push('No calendar events scheduled in this window.');
    return lines.join('\n');
  }

  const preview = result.events.slice(0, Math.min(10, eventCount));
  for (const event of preview) {
    lines.push(formatCalendarLine(event));
  }

  if (eventCount > preview.length) {
    lines.push('');
    lines.push(`... and ${eventCount - preview.length} more events`);
  }

  return lines.join('\n');
}

/**
 * Format calendar events for detailed output
 */
export function formatCalendarEventsDetailed(result: CalendarEventsResult): string {
  const lines: string[] = [];

  lines.push('Calendar Events (Detailed)');
  lines.push('==========================');
  lines.push('');
  lines.push(`Events Found: ${result.events.length}`);
  lines.push(`Time Range: ${new Date(result.time_range.start).toISOString()} → ${new Date(result.time_range.end).toISOString()}`);
  lines.push(`Buckets Queried: ${result.buckets.join(', ')}`);
  lines.push('');

  if (result.events.length === 0) {
    lines.push('No calendar events scheduled in this window.');
    return lines.join('\n');
  }

  result.events.forEach((event, index) => {
    lines.push(`Event ${index + 1}: ${event.summary}`);
    lines.push(`  When: ${new Date(event.start).toLocaleString()} → ${new Date(event.end).toLocaleString()}`);
    lines.push(`  Duration: ${formatDuration(event.duration_seconds)}`);
    if (event.all_day) {
      lines.push('  All Day: yes');
    }
    if (event.status) {
      lines.push(`  Status: ${event.status}`);
    }
    if (event.location) {
      lines.push(`  Location: ${event.location}`);
    }
    if (event.calendar) {
      lines.push(`  Calendar: ${event.calendar}`);
    }
    if (event.attendees && event.attendees.length > 0) {
      lines.push('  Attendees:');
      event.attendees.forEach(attendee => {
        const details = [
          attendee.name,
          attendee.email ? `<${attendee.email}>` : undefined,
          attendee.response_status ? `(${attendee.response_status})` : undefined,
          attendee.organizer ? '[organizer]' : undefined,
        ]
          .filter(Boolean)
          .join(' ');
        lines.push(`    - ${details}`);
      });
    }
    lines.push(`  Source Bucket: ${event.source_bucket}`);
    if (event.metadata) {
      lines.push('  Raw Data:');
      Object.entries(event.metadata).forEach(([key, value]) => {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      });
    }
    lines.push('');
  });

  return lines.join('\n');
}

function formatCalendarLine(event: CalendarEvent): string {
  const start = new Date(event.start).toLocaleString();
  const end = new Date(event.end).toLocaleString();
  const status = event.status ? ` [${event.status}]` : '';
  const location = event.location ? ` @ ${event.location}` : '';
  const allDay = event.all_day ? ' (all day)' : '';
  const duration = !event.all_day ? ` — ${formatDuration(event.duration_seconds)}` : '';

  return `• ${event.summary}${status}${location}${allDay}\n  ${start} → ${end}${duration}`;
}

/**
 * Format period summary for concise output
 */
export function formatPeriodSummaryConcise(summary: PeriodSummary): string {
  const lines: string[] = [];

  // Header
  const periodLabel = getPeriodLabel(summary.period_type);
  const startDate = new Date(summary.period_start).toISOString().split('T')[0];
  const endDate = new Date(summary.period_end).toISOString().split('T')[0];

  lines.push(`${periodLabel}`);
  lines.push(`Period: ${startDate} to ${endDate} (${summary.timezone})`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Active Time (focus + meetings): ${summary.total_active_time_hours}h`);
  if (summary.focus_time_hours !== undefined) {
    lines.push(`  Focus Time: ${summary.focus_time_hours}h`);
  }
  if (summary.meeting_time_hours !== undefined) {
    lines.push(`  Meeting Time: ${summary.meeting_time_hours}h`);
  }
  lines.push(`AFK Time: ${summary.total_afk_time_hours}h`);
  lines.push('');

  // Top applications
  if (summary.top_applications.length > 0) {
    lines.push('Top Applications:');
    for (const app of summary.top_applications) {
      lines.push(`  ${app.name}: ${app.duration_hours}h (${app.percentage}%)`);
    }
    lines.push('');
  }

  // Top websites
  if (summary.top_websites.length > 0) {
    lines.push('Top Websites:');
    for (const site of summary.top_websites) {
      lines.push(`  ${site.domain}: ${site.duration_hours}h (${site.percentage}%)`);
    }
    lines.push('');
  }

  // Top categories
  if (summary.top_categories && summary.top_categories.length > 0) {
    lines.push('Top Categories:');
    for (const category of summary.top_categories) {
      lines.push(`  ${category.category_name}: ${category.duration_hours}h (${category.percentage}%)`);
    }
    lines.push('');
  }

  // Notable calendar events (calendar OR with activity)
  if (summary.notable_calendar_events && summary.notable_calendar_events.length > 0) {
    lines.push('Notable Calendar Events (Calendar overrides AFK):');
    for (const event of summary.notable_calendar_events) {
      const status = event.status ? ` [${event.status}]` : '';
      const location = event.location ? ` @ ${event.location}` : '';
      const allDay = event.all_day ? ' (all day)' : '';
      lines.push(`  ${event.summary}${status}${location}${allDay}`);
      lines.push(`    ${new Date(event.start).toLocaleString()} → ${new Date(event.end).toLocaleString()}`);
    }
    lines.push('');
  }

  // Hourly breakdown
  if (summary.hourly_breakdown && summary.hourly_breakdown.length > 0) {
    lines.push('Hourly Breakdown:');
    lines.push('');
    const maxActiveSeconds = Math.max(...summary.hourly_breakdown.map(h => h.active_seconds));

    for (const hour of summary.hourly_breakdown) {
      const barLength = maxActiveSeconds > 0
        ? Math.round((hour.active_seconds / maxActiveSeconds) * 30)
        : 0;
      const bar = '█'.repeat(barLength);
      const hours = secondsToHours(hour.active_seconds);
      const hourLabel = `${hour.hour.toString().padStart(2, '0')}:00`;
      const appInfo = hour.top_app ? ` (${hour.top_app})` : '';
      lines.push(`  ${hourLabel} ${bar} ${hours}h${appInfo}`);
    }
    lines.push('');
  }

  // Daily breakdown
  if (summary.daily_breakdown && summary.daily_breakdown.length > 0) {
    lines.push('Daily Breakdown:');
    lines.push('');
    const maxActiveSeconds = Math.max(...summary.daily_breakdown.map(d => d.active_seconds));

    for (const day of summary.daily_breakdown) {
      const barLength = maxActiveSeconds > 0
        ? Math.round((day.active_seconds / maxActiveSeconds) * 30)
        : 0;
      const bar = '█'.repeat(barLength);
      const hours = secondsToHours(day.active_seconds);
      const appInfo = day.top_app ? ` (${day.top_app})` : '';
      lines.push(`  ${day.date} ${bar} ${hours}h${appInfo}`);
    }
    lines.push('');
  }

  // Weekly breakdown
  if (summary.weekly_breakdown && summary.weekly_breakdown.length > 0) {
    lines.push('Weekly Breakdown:');
    lines.push('');
    const maxActiveSeconds = Math.max(...summary.weekly_breakdown.map(w => w.active_seconds));

    for (const week of summary.weekly_breakdown) {
      const barLength = maxActiveSeconds > 0
        ? Math.round((week.active_seconds / maxActiveSeconds) * 30)
        : 0;
      const bar = '█'.repeat(barLength);
      const hours = secondsToHours(week.active_seconds);
      const appInfo = week.top_app ? ` (${week.top_app})` : '';
      lines.push(`  ${week.week_start} to ${week.week_end} ${bar} ${hours}h${appInfo}`);
    }
    lines.push('');
  }

  // Insights
  if (summary.insights.length > 0) {
    lines.push('Insights:');
    for (const insight of summary.insights) {
      lines.push(`  • ${insight}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get human-readable period label
 */
function getPeriodLabel(periodType: string): string {
  switch (periodType) {
    case 'daily':
      return 'Daily Summary';
    case 'weekly':
      return 'Weekly Summary';
    case 'monthly':
      return 'Monthly Summary';
    case 'last_24_hours':
      return 'Last 24 Hours Summary';
    case 'last_7_days':
      return 'Last 7 Days Summary';
    case 'last_30_days':
      return 'Last 30 Days Summary';
    default:
      return 'Period Summary';
  }
}
