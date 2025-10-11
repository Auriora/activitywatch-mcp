import { describe, it, expect } from 'vitest';

import type { AWEvent } from '../../../src/types.js';
import {
  DEFAULT_EXCLUDED_DOMAINS,
  calculatePercentage,
  extractAppFromTitle,
  extractDomain,
  filterByDuration,
  groupEvents,
  isSystemApp,
  mergeWindowTitles,
  normalizeAppName,
  normalizeDomain,
  shouldExcludeDomain,
  sortByDuration,
  sumDurations,
  takeTop,
} from '../../../src/utils/filters.js';

const makeEvent = (overrides: Partial<AWEvent> = {}): AWEvent => ({
  timestamp: overrides.timestamp ?? '2025-01-01T10:00:00Z',
  duration: overrides.duration ?? 120,
  data: overrides.data ?? {},
  ...overrides,
});

describe('utils/filters', () => {
  it('normalizes application names', () => {
    expect(normalizeAppName('Code')).toBe('VS Code');
    expect(normalizeAppName('  Google Chrome  ')).toBe('Chrome');
    expect(normalizeAppName('CustomApp')).toBe('CustomApp');
  });

  it('detects system applications', () => {
    expect(isSystemApp('Finder')).toBe(true);
    expect(isSystemApp('Chrome')).toBe(false);
  });

  it('filters events by minimum duration', () => {
    const events = [
      makeEvent({ duration: 30 }),
      makeEvent({ duration: 120 }),
    ];

    const filtered = filterByDuration(events, 60);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.duration).toBe(120);
  });

  it('extracts and normalizes domains', () => {
    expect(extractDomain('https://www.github.com/openai')).toBe('www.github.com');
    expect(normalizeDomain('WWW.EXAMPLE.com')).toBe('example.com');
  });

  it('identifies excluded domains', () => {
    const exclude = ['github.com'];
    expect(shouldExcludeDomain('github.com', exclude)).toBe(true);
    expect(shouldExcludeDomain('docs.github.com', exclude)).toBe(true);
    expect(shouldExcludeDomain('gitlab.com', exclude)).toBe(false);
  });

  it('merges duplicate window titles', () => {
    const titles = mergeWindowTitles(['Tab A', 'Tab A', 'Tab B']);
    expect(titles).toEqual(['Tab A', 'Tab B']);
  });

  it('extracts application names from titles', () => {
    expect(extractAppFromTitle('Chrome - Gmail')).toBe('Chrome');
    expect(extractAppFromTitle('NoSeparatorTitle')).toBeNull();
  });

  it('calculates percentages safely', () => {
    expect(calculatePercentage(30, 120)).toBe(25);
    expect(calculatePercentage(10, 0)).toBe(0);
  });

  it('sorts and takes subsets by duration', () => {
    const sorted = sortByDuration([
      { id: 1, duration_seconds: 10 },
      { id: 2, duration_seconds: 40 },
      { id: 3, duration_seconds: 20 },
    ]);
    expect(sorted.map(item => item.id)).toEqual([2, 3, 1]);

    expect(takeTop(sorted, 2).map(item => item.id)).toEqual([2, 3]);
  });

  it('groups events by key extractor', () => {
    const events = [
      makeEvent({ data: { app: 'Chrome' } }),
      makeEvent({ data: { app: 'Chrome' } }),
      makeEvent({ data: { app: 'Terminal' } }),
    ];

    const groups = groupEvents(events, event => event.data.app as string);
    expect(groups.get('Chrome')).toHaveLength(2);
    expect(groups.get('Terminal')).toHaveLength(1);
  });

  it('sums event durations', () => {
    const events = [
      makeEvent({ duration: 15 }),
      makeEvent({ duration: 45 }),
      makeEvent({ duration: 0 }),
    ];

    expect(sumDurations(events)).toBe(60);
  });

  it('exposes default excluded domains', () => {
    expect(DEFAULT_EXCLUDED_DOMAINS).toContain('localhost');
  });
});
