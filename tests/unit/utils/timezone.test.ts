import { describe, it, expect } from 'vitest';
import {
  parseTimezoneOffset,
  formatTimezoneOffset,
  convertToTimezone,
  convertFromTimezone,
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
} from '../../../src/utils/time.js';

describe('Timezone Utilities', () => {
  describe('parseTimezoneOffset', () => {
    it('should parse UTC as 0', () => {
      expect(parseTimezoneOffset('UTC')).toBe(0);
      expect(parseTimezoneOffset('GMT')).toBe(0);
    });

    it('should parse timezone abbreviations', () => {
      expect(parseTimezoneOffset('IST')).toBe(60); // UTC+1
      expect(parseTimezoneOffset('EST')).toBe(-300); // UTC-5
      expect(parseTimezoneOffset('PST')).toBe(-480); // UTC-8
    });

    it('should parse UTC offset format', () => {
      expect(parseTimezoneOffset('UTC+1')).toBe(60);
      expect(parseTimezoneOffset('UTC-5')).toBe(-300);
      expect(parseTimezoneOffset('UTC+10')).toBe(600);
    });

    it('should parse short offset format', () => {
      expect(parseTimezoneOffset('+1')).toBe(60);
      expect(parseTimezoneOffset('-5')).toBe(-300);
    });

    it('should be case insensitive', () => {
      expect(parseTimezoneOffset('utc')).toBe(0);
      expect(parseTimezoneOffset('ist')).toBe(60);
      expect(parseTimezoneOffset('utc+1')).toBe(60);
    });
  });

  describe('formatTimezoneOffset', () => {
    it('should format UTC as "UTC"', () => {
      expect(formatTimezoneOffset(0)).toBe('UTC');
    });

    it('should format positive offsets', () => {
      expect(formatTimezoneOffset(60)).toBe('UTC+1');
      expect(formatTimezoneOffset(120)).toBe('UTC+2');
      expect(formatTimezoneOffset(330)).toBe('UTC+5:30'); // India
    });

    it('should format negative offsets', () => {
      expect(formatTimezoneOffset(-300)).toBe('UTC-5');
      expect(formatTimezoneOffset(-480)).toBe('UTC-8');
    });
  });

  describe('convertToTimezone', () => {
    it('should convert UTC to local timezone', () => {
      const utcDate = new Date('2025-10-11T12:00:00Z');
      const istDate = convertToTimezone(utcDate, 60); // UTC+1
      
      expect(istDate.getUTCHours()).toBe(13); // 12:00 UTC = 13:00 UTC+1
    });

    it('should handle negative offsets', () => {
      const utcDate = new Date('2025-10-11T12:00:00Z');
      const estDate = convertToTimezone(utcDate, -300); // UTC-5
      
      expect(estDate.getUTCHours()).toBe(7); // 12:00 UTC = 07:00 UTC-5
    });
  });

  describe('convertFromTimezone', () => {
    it('should convert local timezone to UTC', () => {
      const localDate = new Date('2025-10-11T13:00:00Z');
      const utcDate = convertFromTimezone(localDate, 60); // UTC+1
      
      expect(utcDate.getUTCHours()).toBe(12); // 13:00 UTC+1 = 12:00 UTC
    });

    it('should handle negative offsets', () => {
      const localDate = new Date('2025-10-11T07:00:00Z');
      const utcDate = convertFromTimezone(localDate, -300); // UTC-5
      
      expect(utcDate.getUTCHours()).toBe(12); // 07:00 UTC-5 = 12:00 UTC
    });
  });

  describe('getStartOfDayInTimezone', () => {
    it('should get start of day in UTC', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const startOfDay = getStartOfDayInTimezone(date, 0);
      
      expect(startOfDay.toISOString()).toBe('2025-10-11T00:00:00.000Z');
    });

    it('should get start of day in IST (UTC+1)', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const startOfDay = getStartOfDayInTimezone(date, 60);
      
      // Start of Oct 11 in IST (00:00 IST) = Oct 10 23:00 UTC
      expect(startOfDay.toISOString()).toBe('2025-10-10T23:00:00.000Z');
    });

    it('should get start of day in EST (UTC-5)', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const startOfDay = getStartOfDayInTimezone(date, -300);
      
      // Start of Oct 11 in EST (00:00 EST) = Oct 11 05:00 UTC
      expect(startOfDay.toISOString()).toBe('2025-10-11T05:00:00.000Z');
    });
  });

  describe('getEndOfDayInTimezone', () => {
    it('should get end of day in UTC', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const endOfDay = getEndOfDayInTimezone(date, 0);
      
      expect(endOfDay.toISOString()).toBe('2025-10-11T23:59:59.999Z');
    });

    it('should get end of day in IST (UTC+1)', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const endOfDay = getEndOfDayInTimezone(date, 60);
      
      // End of Oct 11 in IST (23:59:59.999 IST) = Oct 11 22:59:59.999 UTC
      expect(endOfDay.toISOString()).toBe('2025-10-11T22:59:59.999Z');
    });

    it('should get end of day in EST (UTC-5)', () => {
      const date = new Date('2025-10-11T12:00:00Z');
      const endOfDay = getEndOfDayInTimezone(date, -300);
      
      // End of Oct 11 in EST (23:59:59.999 EST) = Oct 12 04:59:59.999 UTC
      expect(endOfDay.toISOString()).toBe('2025-10-12T04:59:59.999Z');
    });
  });

  describe('timezone boundary scenarios', () => {
    it('should handle date crossing midnight in different timezones', () => {
      // 23:30 UTC on Oct 10
      const date = new Date('2025-10-10T23:30:00Z');
      
      // In UTC, this is Oct 10
      const utcStart = getStartOfDayInTimezone(date, 0);
      expect(utcStart.toISOString()).toBe('2025-10-10T00:00:00.000Z');
      
      // In IST (UTC+1), this is 00:30 on Oct 11, so start of day is Oct 10 23:00 UTC
      const istStart = getStartOfDayInTimezone(date, 60);
      expect(istStart.toISOString()).toBe('2025-10-10T23:00:00.000Z');
    });
  });
});

