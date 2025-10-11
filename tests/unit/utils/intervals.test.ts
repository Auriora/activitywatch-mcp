import { describe, it, expect } from 'vitest';
import {
  mergeIntervals,
  calculateOverlap,
  intersectIntervals,
  Interval,
} from '../../../src/utils/intervals.js';

describe('interval utilities', () => {
  it('merges overlapping intervals', () => {
    const intervals: Interval[] = [
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 20, end: 30 },
      { start: 25, end: 35 },
    ];

    const merged = mergeIntervals(intervals);
    expect(merged).toEqual([
      { start: 0, end: 15 },
      { start: 20, end: 35 },
    ]);
  });

  it('computes overlap against multiple intervals', () => {
    const target: Interval = { start: 10, end: 30 };
    const others: Interval[] = [
      { start: 0, end: 15 },
      { start: 20, end: 25 },
      { start: 40, end: 50 },
    ];

    const overlapMs = calculateOverlap(target, others);
    expect(overlapMs).toBe(10); // 5 units (10-15) + 5 units (20-25)
  });

  it('returns null for non-overlapping intersection', () => {
    const a: Interval = { start: 0, end: 10 };
    const b: Interval = { start: 20, end: 30 };
    const result = intersectIntervals(a, b);
    expect(result).toBeNull();
  });
});
