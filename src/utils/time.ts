/**
 * Time utilities for handling date ranges and formatting
 */

import { TimePeriod, AWError } from '../types.js';

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Timezone offset in minutes for common timezones
 * Positive values are east of UTC, negative are west
 */
const TIMEZONE_OFFSETS: Record<string, number> = {
  'UTC': 0,
  'GMT': 0,
  'IST': 60,  // Irish Standard Time (UTC+1 in summer, UTC+0 in winter)
  'BST': 60,  // British Summer Time
  'CET': 60,  // Central European Time
  'CEST': 120, // Central European Summer Time
  'EST': -300, // Eastern Standard Time
  'EDT': -240, // Eastern Daylight Time
  'CST': -360, // Central Standard Time
  'CDT': -300, // Central Daylight Time
  'MST': -420, // Mountain Standard Time
  'MDT': -360, // Mountain Daylight Time
  'PST': -480, // Pacific Standard Time
  'PDT': -420, // Pacific Daylight Time
};

/**
 * Parse timezone string to offset in minutes
 * Supports: "UTC", "GMT", timezone abbreviations, "UTC+1", "UTC-5", IANA timezone names
 */
export function parseTimezoneOffset(timezone: string): number {
  // Check if it's a known abbreviation
  if (TIMEZONE_OFFSETS[timezone.toUpperCase()]) {
    return TIMEZONE_OFFSETS[timezone.toUpperCase()];
  }

  // Check for UTC+X or UTC-X format
  const utcMatch = timezone.match(/^UTC([+-]\d+)$/i);
  if (utcMatch) {
    return parseInt(utcMatch[1]) * 60;
  }

  // Check for +X or -X format
  const offsetMatch = timezone.match(/^([+-]\d+)$/);
  if (offsetMatch) {
    return parseInt(offsetMatch[1]) * 60;
  }

  // For IANA timezone names (e.g., "Europe/Dublin"), we need to calculate offset
  // This is a simplified approach - for production, consider using a library like date-fns-tz
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60));
  } catch (error) {
    throw new AWError(
      `Invalid timezone: ${timezone}. Use UTC, timezone abbreviations (IST, EST, etc.), UTC+X format, or IANA timezone names (Europe/Dublin)`,
      'INVALID_TIMEZONE',
      { timezone, error }
    );
  }
}

/**
 * Get the system timezone offset in minutes
 */
export function getSystemTimezoneOffset(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * Format timezone offset as string (e.g., "UTC+1", "UTC-5")
 */
export function formatTimezoneOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert a date from UTC to a specific timezone
 */
export function convertToTimezone(utcDate: Date, timezoneOffsetMinutes: number): Date {
  return new Date(utcDate.getTime() + timezoneOffsetMinutes * 60 * 1000);
}

/**
 * Convert a date from a specific timezone to UTC
 */
export function convertFromTimezone(localDate: Date, timezoneOffsetMinutes: number): Date {
  return new Date(localDate.getTime() - timezoneOffsetMinutes * 60 * 1000);
}

/**
 * Get start of day in a specific timezone
 */
export function getStartOfDayInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  // Convert to local timezone
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);

  // Get start of day in local time
  const startOfDay = new Date(Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    0, 0, 0, 0
  ));

  // Convert back to UTC
  return convertFromTimezone(startOfDay, timezoneOffsetMinutes);
}

/**
 * Get end of day in a specific timezone
 */
export function getEndOfDayInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  // Convert to local timezone
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);

  // Get end of day in local time
  const endOfDay = new Date(Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    23, 59, 59, 999
  ));

  // Convert back to UTC
  return convertFromTimezone(endOfDay, timezoneOffsetMinutes);
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
export function parseDate(dateStr: string): Date {
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

/**
 * Get start of week (Monday) for a given date
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of week (Sunday) for a given date
 */
export function getEndOfWeek(date: Date): Date {
  const result = getStartOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of month for a given date
 */
export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get end of month for a given date
 */
export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Get start of week in a specific timezone
 */
export function getStartOfWeekInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);
  const startOfWeek = getStartOfWeek(localDate);
  return convertFromTimezone(startOfWeek, timezoneOffsetMinutes);
}

/**
 * Get end of week in a specific timezone
 */
export function getEndOfWeekInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);
  const endOfWeek = getEndOfWeek(localDate);
  return convertFromTimezone(endOfWeek, timezoneOffsetMinutes);
}

/**
 * Get start of month in a specific timezone
 */
export function getStartOfMonthInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);
  const startOfMonth = getStartOfMonth(localDate);
  return convertFromTimezone(startOfMonth, timezoneOffsetMinutes);
}

/**
 * Get end of month in a specific timezone
 */
export function getEndOfMonthInTimezone(date: Date, timezoneOffsetMinutes: number): Date {
  const localDate = convertToTimezone(date, timezoneOffsetMinutes);
  const endOfMonth = getEndOfMonth(localDate);
  return convertFromTimezone(endOfMonth, timezoneOffsetMinutes);
}

/**
 * Generate array of dates between start and end (inclusive)
 */
export function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Generate array of week ranges between start and end
 */
export function getWeeksBetween(start: Date, end: Date): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  let current = getStartOfWeek(start);

  while (current <= end) {
    const weekEnd = getEndOfWeek(current);
    weeks.push({
      start: new Date(current),
      end: weekEnd > end ? new Date(end) : new Date(weekEnd),
    });
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return weeks;
}
