/**
 * Interval utility helpers for timeline calculations
 */

export interface Interval {
  readonly start: number; // milliseconds since epoch
  readonly end: number;   // milliseconds since epoch (exclusive)
}

/**
 * Merge overlapping intervals into a canonical set
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals]
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return [];
  }

  const merged: Interval[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Sum the total duration of intervals (in milliseconds)
 */
export function sumIntervals(intervals: Interval[]): number {
  return intervals.reduce((sum, interval) => {
    const length = interval.end - interval.start;
    return length > 0 ? sum + length : sum;
  }, 0);
}

/**
 * Compute the intersection between two intervals
 */
export function intersectIntervals(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end <= start) {
    return null;
  }
  return { start, end };
}

/**
 * Calculate total overlap between a primary interval and a list of intervals
 */
export function calculateOverlap(interval: Interval, others: Interval[]): number {
  if (others.length === 0) {
    return 0;
  }

  let overlap = 0;
  for (const other of others) {
    const intersection = intersectIntervals(interval, other);
    if (intersection) {
      overlap += intersection.end - intersection.start;
    }
  }
  return overlap;
}
