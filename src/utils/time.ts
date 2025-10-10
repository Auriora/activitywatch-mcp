/**
 * Time utilities for handling date ranges and formatting
 */

import { TimePeriod, AWError } from '../types.js';

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Convert a time period to a concrete date range
 */
export function getTimeRange(
  timePeriod: TimePeriod,
  customStart?: string,
  customEnd?: string
): TimeRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (timePeriod) {
    case 'today':
      return {
        start: today,
        end: now,
      };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return {
        start: yesterday,
        end: yesterdayEnd,
      };
    }

    case 'this_week': {
      const startOfWeek = new Date(today);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as start of week
      startOfWeek.setDate(startOfWeek.getDate() + diff);
      return {
        start: startOfWeek,
        end: now,
      };
    }

    case 'last_week': {
      const startOfThisWeek = new Date(today);
      const dayOfWeek = startOfThisWeek.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfThisWeek.setDate(startOfThisWeek.getDate() + diff);
      
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      
      const endOfLastWeek = new Date(startOfThisWeek);
      endOfLastWeek.setSeconds(endOfLastWeek.getSeconds() - 1);
      
      return {
        start: startOfLastWeek,
        end: endOfLastWeek,
      };
    }

    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return {
        start,
        end: now,
      };
    }

    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return {
        start,
        end: now,
      };
    }

    case 'custom': {
      if (!customStart || !customEnd) {
        throw new AWError(
          'Custom time period requires custom_start and custom_end parameters',
          'INVALID_TIME_PERIOD',
          { timePeriod, customStart, customEnd }
        );
      }

      const start = parseDate(customStart);
      const end = parseDate(customEnd);

      if (start >= end) {
        throw new AWError(
          'custom_start must be before custom_end',
          'INVALID_TIME_RANGE',
          { customStart, customEnd }
        );
      }

      return { start, end };
    }

    default:
      throw new AWError(
        `Invalid time period: ${timePeriod}`,
        'INVALID_TIME_PERIOD',
        { timePeriod }
      );
  }
}

/**
 * Parse a date string (supports YYYY-MM-DD and ISO 8601)
 */
function parseDate(dateStr: string): Date {
  // Try ISO 8601 first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try YYYY-MM-DD format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  throw new AWError(
    `Invalid date format: ${dateStr}. Use YYYY-MM-DD or ISO 8601 format.`,
    'INVALID_DATE_FORMAT',
    { dateStr }
  );
}

/**
 * Format a date to ISO 8601 string for ActivityWatch API
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Convert seconds to hours (rounded to 2 decimals)
 */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

/**
 * Get the start of day for a given date
 */
export function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Get the end of day for a given date
 */
export function getEndOfDay(date: Date): Date {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Create time period strings for ActivityWatch query API
 */
export function createTimePeriods(start: Date, end: Date): string[] {
  return [`${formatDateForAPI(start)}/${formatDateForAPI(end)}`];
}

