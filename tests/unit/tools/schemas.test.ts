import { describe, it, expect } from 'vitest';

import {
  GetCalendarEventsSchema,
  QueryEventsSchema,
  ResponseFormatSchema,
  TimePeriodSchema,
} from '../../../src/tools/schemas.js';

describe('TimePeriodSchema', () => {
  it('accepts supported presets', () => {
    expect(() => TimePeriodSchema.parse('today')).not.toThrow();
    expect(() => TimePeriodSchema.parse('custom')).not.toThrow();
  });

  it('rejects unsupported values', () => {
    expect(() => TimePeriodSchema.parse('next_week')).toThrow();
  });
});

describe('GetCalendarEventsSchema', () => {
  it('provides sensible defaults when no overrides supplied', () => {
    const parsed = GetCalendarEventsSchema.parse({});

    expect(parsed.time_period).toBe('today');
    expect(parsed.include_all_day).toBe(true);
    expect(parsed.include_cancelled).toBe(false);
    expect(parsed.limit).toBe(50);
    expect(parsed.response_format).toBe('concise');
  });

  it('requires custom_start and custom_end when time_period is custom', () => {
    expect(() =>
      GetCalendarEventsSchema.parse({
        time_period: 'custom',
        custom_end: '2025-01-02',
      })
    ).toThrow(/custom_start is required/);

    expect(() =>
      GetCalendarEventsSchema.parse({
        time_period: 'custom',
        custom_start: '2025-01-01',
      })
    ).toThrow(/custom_end is required/);
  });

  it('rejects custom ranges where start is after end', () => {
    expect(() =>
      GetCalendarEventsSchema.parse({
        time_period: 'custom',
        custom_start: '2025-01-03',
        custom_end: '2025-01-02',
      })
    ).toThrow(/must be before or equal to custom_end/);
  });

  it('accepts valid custom ranges', () => {
    const parsed = GetCalendarEventsSchema.parse({
      time_period: 'custom',
      custom_start: '2025-01-01',
      custom_end: '2025-01-02',
    });

    expect(parsed.time_period).toBe('custom');
    expect(parsed.custom_start).toBe('2025-01-01');
    expect(parsed.custom_end).toBe('2025-01-02');
  });
});

describe('QueryEventsSchema', () => {
  it('requires minimal inputs and applies defaults', () => {
    const parsed = QueryEventsSchema.parse({
      query_type: 'window',
      start_time: '2025-01-01T09:00:00Z',
      end_time: '2025-01-01T17:00:00Z',
    });

    expect(parsed.filter_afk).toBe(true);
    expect(parsed.merge_events).toBe(true);
    expect(parsed.min_duration_seconds).toBe(0);
    expect(parsed.limit).toBe(1000);
    expect(parsed.response_format).toBe('detailed');
  });

  it('validates response_format enum', () => {
    expect(() => ResponseFormatSchema.parse('concise')).not.toThrow();
    expect(() => ResponseFormatSchema.parse('full')).toThrow();
  });
});
