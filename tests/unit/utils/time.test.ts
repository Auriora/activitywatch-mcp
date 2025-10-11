import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getTimeRange,
  formatDateForAPI,
  formatDate,
  formatDuration,
  secondsToHours,
  getStartOfDay,
  getEndOfDay,
  createTimePeriods,
} from '../../../src/utils/time.js';
import { AWError } from '../../../src/types.js';

describe('Time Utilities', () => {
  beforeEach(() => {
    // Set a fixed date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T14:30:00Z')); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTimeRange', () => {
    describe('today', () => {
      it('should return range from start of today to now', () => {
        const range = getTimeRange('today');
        
        expect(range.start.toISOString()).toBe('2025-01-15T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-15T14:30:00.000Z');
      });
    });

    describe('yesterday', () => {
      it('should return full day range for yesterday', () => {
        const range = getTimeRange('yesterday');
        
        expect(range.start.toISOString()).toBe('2025-01-14T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-14T23:59:59.999Z');
      });
    });

    describe('this_week', () => {
      it('should return range from Monday to now', () => {
        const range = getTimeRange('this_week');
        
        // Monday of current week
        expect(range.start.toISOString()).toBe('2025-01-13T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-15T14:30:00.000Z');
      });

      it('should handle Sunday correctly', () => {
        vi.setSystemTime(new Date('2025-01-19T14:30:00Z')); // Sunday
        const range = getTimeRange('this_week');
        
        // Should still be Monday of that week
        expect(range.start.toISOString()).toBe('2025-01-13T00:00:00.000Z');
      });
    });

    describe('last_week', () => {
      it('should return full week range for last week', () => {
        const range = getTimeRange('last_week');
        
        // Previous Monday to Sunday
        expect(range.start.toISOString()).toBe('2025-01-06T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-12T23:59:59.999Z');
      });
    });

    describe('last_7_days', () => {
      it('should return rolling 7 days', () => {
        const range = getTimeRange('last_7_days');
        
        expect(range.start.toISOString()).toBe('2025-01-08T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-15T14:30:00.000Z');
      });
    });

    describe('last_30_days', () => {
      it('should return rolling 30 days', () => {
        const range = getTimeRange('last_30_days');
        
        expect(range.start.toISOString()).toBe('2024-12-16T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-15T14:30:00.000Z');
      });
    });

    describe('custom', () => {
      it('should parse ISO 8601 dates', () => {
        const range = getTimeRange(
          'custom',
          '2025-01-01T00:00:00Z',
          '2025-01-31T23:59:59Z'
        );
        
        expect(range.start.toISOString()).toBe('2025-01-01T00:00:00.000Z');
        expect(range.end.toISOString()).toBe('2025-01-31T23:59:59.000Z');
      });

      it('should parse YYYY-MM-DD dates', () => {
        const range = getTimeRange('custom', '2025-01-01', '2025-01-31');
        
        expect(range.start.getFullYear()).toBe(2025);
        expect(range.start.getMonth()).toBe(0); // January
        expect(range.start.getDate()).toBe(1);
        
        expect(range.end.getFullYear()).toBe(2025);
        expect(range.end.getMonth()).toBe(0);
        expect(range.end.getDate()).toBe(31);
      });

      it('should throw error if custom_start is missing', () => {
        expect(() => getTimeRange('custom', undefined, '2025-01-31'))
          .toThrow(AWError);
      });

      it('should throw error if custom_end is missing', () => {
        expect(() => getTimeRange('custom', '2025-01-01', undefined))
          .toThrow(AWError);
      });

      it('should throw error if start is after end', () => {
        expect(() => getTimeRange('custom', '2025-01-31', '2025-01-01'))
          .toThrow(AWError);
      });

      it('should throw error for invalid date format', () => {
        expect(() => getTimeRange('custom', 'invalid', '2025-01-31'))
          .toThrow(AWError);
      });
    });

    describe('invalid period', () => {
      it('should throw error for unknown time period', () => {
        expect(() => getTimeRange('invalid' as any))
          .toThrow(AWError);
      });
    });
  });

  describe('formatDateForAPI', () => {
    it('should format date as ISO 8601', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      expect(formatDateForAPI(date)).toBe('2025-01-15T14:30:00.000Z');
    });

    it('should handle different timezones', () => {
      const date = new Date('2025-01-15T14:30:00-05:00');
      const formatted = formatDateForAPI(date);
      expect(formatted).toContain('2025-01-15');
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      expect(formatDate(date)).toBe('2025-01-15');
    });

    it('should pad single-digit months and days', () => {
      const date = new Date('2025-03-05T00:00:00Z');
      expect(formatDate(date)).toBe('2025-03-05');
    });

    it('should handle different months', () => {
      expect(formatDate(new Date('2025-12-31T00:00:00Z'))).toBe('2025-12-31');
      expect(formatDate(new Date('2025-01-01T00:00:00Z'))).toBe('2025-01-01');
    });
  });

  describe('formatDuration', () => {
    it('should format hours and minutes', () => {
      expect(formatDuration(3661)).toBe('1h 1m');
      expect(formatDuration(7200)).toBe('2h 0m');
      expect(formatDuration(5430)).toBe('1h 30m');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(60)).toBe('1m 0s');
      expect(formatDuration(90)).toBe('1m 30s');
    });

    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(1)).toBe('1s');
    });

    it('should handle large durations', () => {
      expect(formatDuration(86400)).toBe('24h 0m'); // 1 day
      expect(formatDuration(90000)).toBe('25h 0m'); // 25 hours
    });

    it('should floor fractional seconds', () => {
      expect(formatDuration(125.7)).toBe('2m 5s');
      expect(formatDuration(45.9)).toBe('45s');
    });
  });

  describe('secondsToHours', () => {
    it('should convert seconds to hours', () => {
      expect(secondsToHours(3600)).toBe(1);
      expect(secondsToHours(7200)).toBe(2);
      expect(secondsToHours(1800)).toBe(0.5);
    });

    it('should round to 2 decimal places', () => {
      expect(secondsToHours(3661)).toBe(1.02);
      expect(secondsToHours(5430)).toBe(1.51);
      expect(secondsToHours(100)).toBe(0.03);
    });

    it('should handle zero', () => {
      expect(secondsToHours(0)).toBe(0);
    });

    it('should handle large values', () => {
      expect(secondsToHours(86400)).toBe(24); // 1 day
      expect(secondsToHours(604800)).toBe(168); // 1 week
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2025-01-15T14:30:45.123Z');
      const start = getStartOfDay(date);
      
      expect(start.getFullYear()).toBe(2025);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(15);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should not modify original date', () => {
      const original = new Date('2025-01-15T14:30:00Z');
      const originalTime = original.getTime();
      
      getStartOfDay(original);
      
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2025-01-15T14:30:45.123Z');
      const end = getEndOfDay(date);
      
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(0);
      expect(end.getDate()).toBe(15);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });

    it('should not modify original date', () => {
      const original = new Date('2025-01-15T14:30:00Z');
      const originalTime = original.getTime();
      
      getEndOfDay(original);
      
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('createTimePeriods', () => {
    it('should create time period string', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T23:59:59Z');
      
      const periods = createTimePeriods(start, end);
      
      expect(periods).toHaveLength(1);
      expect(periods[0]).toBe('2025-01-01T00:00:00.000Z/2025-01-31T23:59:59.000Z');
    });

    it('should handle same day', () => {
      const start = new Date('2025-01-15T00:00:00Z');
      const end = new Date('2025-01-15T23:59:59Z');
      
      const periods = createTimePeriods(start, end);
      
      expect(periods).toHaveLength(1);
      expect(periods[0]).toContain('2025-01-15');
    });
  });
});

