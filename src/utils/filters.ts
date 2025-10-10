/**
 * Filtering and normalization utilities
 */

import { AWEvent } from '../types.js';

/**
 * System apps to exclude by default
 */
const SYSTEM_APPS = new Set([
  'loginwindow',
  'Dock',
  'Finder',
  'SystemUIServer',
  'Window Server',
  'WindowServer',
  'Control Center',
  'Notification Center',
  'Spotlight',
  'screensaver',
  'ScreenSaverEngine',
  'lockscreen',
  'LockScreen',
  'gnome-shell',
  'plasmashell',
  'explorer.exe',
  'dwm.exe',
  'ApplicationFrameHost.exe',
]);

/**
 * Normalize application names (handle variations)
 */
export function normalizeAppName(appName: string): string {
  const normalized = appName.trim();
  
  // Common variations
  const variations: Record<string, string> = {
    'Code': 'VS Code',
    'Visual Studio Code': 'VS Code',
    'code': 'VS Code',
    'Google Chrome': 'Chrome',
    'google-chrome': 'Chrome',
    'Mozilla Firefox': 'Firefox',
    'firefox': 'Firefox',
    'IntelliJ IDEA': 'IntelliJ',
    'PyCharm': 'PyCharm',
    'WebStorm': 'WebStorm',
  };

  return variations[normalized] || normalized;
}

/**
 * Check if an app is a system app
 */
export function isSystemApp(appName: string): boolean {
  return SYSTEM_APPS.has(appName);
}

/**
 * Filter events by minimum duration
 */
export function filterByDuration(
  events: AWEvent[],
  minDurationSeconds: number
): AWEvent[] {
  return events.filter(event => event.duration >= minDurationSeconds);
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * Normalize domain (remove www, etc.)
 */
export function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase();
}

/**
 * Check if domain should be excluded
 */
export function shouldExcludeDomain(
  domain: string,
  excludeList: string[]
): boolean {
  const normalized = normalizeDomain(domain);
  return excludeList.some(excluded => 
    normalized === normalizeDomain(excluded) || 
    normalized.endsWith(`.${normalizeDomain(excluded)}`)
  );
}

/**
 * Merge similar window titles (e.g., "Chrome - Tab 1", "Chrome - Tab 2")
 */
export function mergeWindowTitles(titles: string[]): string[] {
  // For now, just return unique titles
  // Could be enhanced to group similar patterns
  return Array.from(new Set(titles));
}

/**
 * Extract app name from window title (if format is "AppName - Title")
 */
export function extractAppFromTitle(title: string): string | null {
  const match = title.match(/^([^-]+)\s*-/);
  return match ? match[1].trim() : null;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 10000) / 100; // Round to 2 decimals
}

/**
 * Sort by duration descending
 */
export function sortByDuration<T extends { duration_seconds: number }>(
  items: T[]
): T[] {
  return items.sort((a, b) => b.duration_seconds - a.duration_seconds);
}

/**
 * Take top N items
 */
export function takeTop<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

/**
 * Group events by a key extractor function
 */
export function groupEvents<K extends string | number>(
  events: AWEvent[],
  keyExtractor: (event: AWEvent) => K
): Map<K, AWEvent[]> {
  const groups = new Map<K, AWEvent[]>();
  
  for (const event of events) {
    const key = keyExtractor(event);
    const group = groups.get(key) || [];
    group.push(event);
    groups.set(key, group);
  }
  
  return groups;
}

/**
 * Sum durations of events
 */
export function sumDurations(events: AWEvent[]): number {
  return events.reduce((sum, event) => sum + event.duration, 0);
}

/**
 * Default domains to exclude
 */
export const DEFAULT_EXCLUDED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'about:blank',
  'chrome://newtab',
  'about:newtab',
];

