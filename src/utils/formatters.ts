/**
 * Common formatting utilities for response output
 */

import { AppUsage, WebUsage, DailySummary } from '../types.js';
import { secondsToHours } from './time.js';

/**
 * Format window activity for concise output
 */
export function formatWindowActivityConcise(data: {
  total_time_seconds: number;
  applications: AppUsage[];
  time_range: { start: string; end: string };
}): string {
  const lines: string[] = [];
  
  lines.push(`Window Activity (${data.time_range.start} to ${data.time_range.end})`);
  lines.push(`Total Active Time: ${secondsToHours(data.total_time_seconds)} hours`);
  lines.push('');
  lines.push('Top Applications:');
  
  for (const app of data.applications) {
    lines.push(
      `  ${app.name}: ${app.duration_hours}h (${app.percentage}%)`
    );
  }

  return lines.join('\n');
}

/**
 * Format web activity for concise output
 */
export function formatWebActivityConcise(data: {
  total_time_seconds: number;
  websites: WebUsage[];
  time_range: { start: string; end: string };
}): string {
  const lines: string[] = [];
  
  lines.push(`Web Activity (${data.time_range.start} to ${data.time_range.end})`);
  lines.push(`Total Browsing Time: ${secondsToHours(data.total_time_seconds)} hours`);
  lines.push('');
  lines.push('Top Websites:');
  
  for (const site of data.websites) {
    lines.push(
      `  ${site.domain}: ${site.duration_hours}h (${site.percentage}%)`
    );
  }

  return lines.join('\n');
}

/**
 * Format daily summary for concise output
 */
export function formatDailySummaryConcise(summary: DailySummary): string {
  const lines: string[] = [];
  
  lines.push(`Daily Summary for ${summary.date}`);
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
  events: unknown[],
  limit: number
): string {
  const preview = events.slice(0, 10);
  const hasMore = events.length > 10;
  
  return `Retrieved ${events.length} events from bucket ${bucketId}\n\n` +
         JSON.stringify(preview, null, 2) +
         (hasMore ? `\n\n... and ${events.length - 10} more events` : '');
}

