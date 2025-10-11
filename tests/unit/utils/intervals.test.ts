import { describe, it, expect } from 'vitest';

import { mergeIntervals, sumIntervals } from '../../../src/utils/intervals.js';

describe('utils/intervals', () => {
  it('merges and sums intervals', () => {
    const merged = mergeIntervals([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 20, end: 25 },
    ]);

    expect(merged).toEqual([
      { start: 0, end: 15 },
      { start: 20, end: 25 },
    ]);

    expect(sumIntervals(merged)).toBe(20);
  });
});
