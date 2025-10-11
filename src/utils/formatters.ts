/**
 * Common formatting utilities for response output
 */

import { DailySummary, AWEvent } from '../types.js';
import { secondsToHours } from './time.js';

/**
 * Format daily summary for concise output
 */
export function formatDailySummaryConcise(summary: DailySummary): string {
  const lines: string[] = [];

  lines.push(`Daily Summary for ${summary.date} (${summary.timezone})`);
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Active Time: ${summary.total_active_time_hours}h`);
  lines.push(`AFK Time: ${summary.total_afk_time_hours}h`);
  lines.push('');

  if (summary.top_applications.length > 0) {
    lines.push('Top Applications:');
    for (const app of summary.top_applications) {
      lines.push(`  ${app.name}: ${app.duration_hours}h (${app.percentage}%)`);
    }
    lines.push('');
  }

  if (summary.top_websites.length > 0) {
    lines.push('Top Websites:');
    for (const site of summary.top_websites) {
      lines.push(`  ${site.domain}: ${site.duration_hours}h (${site.percentage}%)`);
    }
    lines.push('');
  }

  if (summary.top_categories && summary.top_categories.length > 0) {
    lines.push('Top Categories:');
    for (const category of summary.top_categories) {
      lines.push(`  ${category.category_name}: ${category.duration_hours}h (${category.percentage}%)`);
    }
    lines.push('');
  }

  if (summary.hourly_breakdown && summary.hourly_breakdown.length > 0) {
    lines.push(`Hourly Breakdown (${summary.timezone}):`);
    lines.push('');

    // Create a visual timeline
    const maxActiveSeconds = Math.max(...summary.hourly_breakdown.map(h => h.active_seconds));
    const barWidth = 40; // characters for the bar

    for (const hourData of summary.hourly_breakdown) {
      const hour = hourData.hour.toString().padStart(2, '0');
      const activeHours = secondsToHours(hourData.active_seconds);

      // Create a visual bar
      const barLength = maxActiveSeconds > 0
        ? Math.round((hourData.active_seconds / maxActiveSeconds) * barWidth)
        : 0;
      const bar = '█'.repeat(barLength);

      // Format the line
      let line = `  ${hour}:00 │${bar.padEnd(barWidth, ' ')}│ ${activeHours}h`;

      if (hourData.top_app) {
        line += ` (${hourData.top_app})`;
      }

      lines.push(line);
    }
    lines.push('');
  }

  if (summary.insights.length > 0) {
    lines.push('Insights:');
    for (const insight of summary.insights) {
      lines.push(`  • ${insight}`);
    }
  }

  return lines.join('\n');
}

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

