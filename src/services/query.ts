/**
 * Service for executing ActivityWatch queries with AFK filtering
 * 
 * This service uses ActivityWatch's query API to fetch events that are
 * automatically filtered by AFK (away from keyboard) status. This ensures
 * that only active time is counted in all activity reports.
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { AWEvent, CanonicalQueryResult } from '../types.js';
import { formatDateForAPI } from '../utils/time.js';
import { logger } from '../utils/logger.js';

export interface QueryResult {
  readonly events: readonly AWEvent[];
  readonly total_duration_seconds: number;
}

/**
 * Browser app names for matching window events
 * Based on ActivityWatch's canonical implementation
 */
const BROWSER_APP_NAMES: Record<string, string[]> = {
  chrome: [
    'Google Chrome',
    'Google-chrome',
    'chrome.exe',
    'google-chrome-stable',
    'Chromium',
    'Chromium-browser',
    'Chromium-browser-chromium',
    'chromium.exe',
    'Google-chrome-beta',
    'Google-chrome-unstable',
    'Brave-browser',
  ],
  firefox: [
    'Firefox',
    'Firefox.exe',
    'firefox',
    'firefox.exe',
    'Firefox Developer Edition',
    'firefoxdeveloperedition',
    'Firefox-esr',
    'Firefox Beta',
    'Nightly',
    'org.mozilla.firefox',
  ],
  opera: ['opera.exe', 'Opera'],
  brave: ['brave.exe'],
  edge: ['msedge.exe', 'Microsoft Edge'],
  vivaldi: ['Vivaldi-stable', 'Vivaldi-snapshot', 'vivaldi.exe'],
  safari: ['Safari'],
};

/**
 * Editor app names for matching window events
 */
const EDITOR_APP_NAMES: Record<string, string[]> = {
  vscode: ['Code', 'code.exe', 'Visual Studio Code', 'VSCode'],
  vim: ['vim', 'nvim', 'gvim'],
  emacs: ['emacs', 'Emacs'],
  sublime: ['sublime_text', 'Sublime Text'],
  atom: ['atom', 'Atom'],
  intellij: ['idea', 'IntelliJ IDEA'],
  pycharm: ['pycharm', 'PyCharm'],
  webstorm: ['webstorm', 'WebStorm'],
};

/**
 * Service for executing AFK-filtered queries
 */
export class QueryService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService
  ) {}

  /**
   * Get window events filtered by AFK status
   * Only returns events during "not-afk" periods
   * Combines data from all window and editor buckets
   */
  async getWindowEventsFiltered(
    startTime: Date,
    endTime: Date
  ): Promise<QueryResult> {
    logger.debug('Getting AFK-filtered window events', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    // Find window, editor, and AFK buckets
    const windowBuckets = await this.capabilities.findWindowBuckets();
    const editorBuckets = await this.capabilities.findEditorBuckets();
    const afkBuckets = await this.capabilities.findAfkBuckets();
    const allBuckets = [...windowBuckets, ...editorBuckets];

    if (allBuckets.length === 0) {
      logger.warn('No window or editor tracking buckets available');
      return { events: [], total_duration_seconds: 0 };
    }

    // Build query based on whether AFK tracking is available
    const hasAfk = afkBuckets.length > 0;
    const afkBucketId = afkBuckets[0]?.id;

    // Combine events from all buckets
    const allEvents: AWEvent[] = [];
    let totalDuration = 0;

    for (const bucket of allBuckets) {
      const query = this.buildWindowQuery(bucket.id, afkBucketId, hasAfk);
      const result = await this.executeQuery(startTime, endTime, query);
      allEvents.push(...result.events);
      totalDuration += result.total_duration_seconds;
    }

    logger.info(`Combined ${allEvents.length} events from ${allBuckets.length} buckets`);

    return {
      events: allEvents,
      total_duration_seconds: totalDuration,
    };
  }

  /**
   * Get browser events filtered by AFK status
   * Only returns events during "not-afk" periods
   * Combines data from all browser buckets
   */
  async getBrowserEventsFiltered(
    startTime: Date,
    endTime: Date
  ): Promise<QueryResult> {
    logger.debug('Getting AFK-filtered browser events', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    // Find browser and AFK buckets
    const browserBuckets = await this.capabilities.findBrowserBuckets();
    const afkBuckets = await this.capabilities.findAfkBuckets();

    if (browserBuckets.length === 0) {
      logger.warn('No browser tracking buckets available');
      return { events: [], total_duration_seconds: 0 };
    }

    // Build query based on whether AFK tracking is available
    const hasAfk = afkBuckets.length > 0;
    const afkBucketId = afkBuckets[0]?.id;

    // Combine events from all buckets
    const allEvents: AWEvent[] = [];
    let totalDuration = 0;

    for (const bucket of browserBuckets) {
      const query = this.buildBrowserQuery(bucket.id, afkBucketId, hasAfk);
      const result = await this.executeQuery(startTime, endTime, query);
      allEvents.push(...result.events);
      totalDuration += result.total_duration_seconds;
    }

    logger.info(`Combined ${allEvents.length} events from ${browserBuckets.length} buckets`);

    return {
      events: allEvents,
      total_duration_seconds: totalDuration,
    };
  }

  /**
   * Get editor events filtered by AFK status
   * Only returns events during "not-afk" periods
   * Combines data from all editor buckets
   */
  async getEditorEventsFiltered(
    startTime: Date,
    endTime: Date
  ): Promise<QueryResult> {
    logger.debug('Getting AFK-filtered editor events', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    // Find editor and AFK buckets
    const editorBuckets = await this.capabilities.findEditorBuckets();
    const afkBuckets = await this.capabilities.findAfkBuckets();

    if (editorBuckets.length === 0) {
      logger.warn('No editor tracking buckets available');
      return { events: [], total_duration_seconds: 0 };
    }

    // Build query based on whether AFK tracking is available
    const hasAfk = afkBuckets.length > 0;
    const afkBucketId = afkBuckets[0]?.id;

    // Combine events from all buckets
    const allEvents: AWEvent[] = [];
    let totalDuration = 0;

    for (const bucket of editorBuckets) {
      const query = this.buildEditorQuery(bucket.id, afkBucketId, hasAfk);
      const result = await this.executeQuery(startTime, endTime, query);
      allEvents.push(...result.events);
      totalDuration += result.total_duration_seconds;
    }

    logger.info(`Combined ${allEvents.length} events from ${editorBuckets.length} buckets`);

    return {
      events: allEvents,
      total_duration_seconds: totalDuration,
    };
  }

  /**
   * Build query for window events with optional AFK filtering
   */
  private buildWindowQuery(windowBucketId: string, afkBucketId?: string, hasAfk: boolean = false): string[] {
    const query: string[] = [];

    // Get window events
    query.push(`events = query_bucket("${windowBucketId}");`);

    // Apply AFK filtering if available
    if (hasAfk && afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`events = filter_period_intersect(events, not_afk);`);
    }

    query.push(`RETURN = events;`);
    return query;
  }

  /**
   * Build query for browser events with optional AFK filtering
   */
  private buildBrowserQuery(browserBucketId: string, afkBucketId?: string, hasAfk: boolean = false): string[] {
    const query: string[] = [];

    // Get browser events
    query.push(`events = query_bucket("${browserBucketId}");`);

    // Apply AFK filtering if available
    if (hasAfk && afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`events = filter_period_intersect(events, not_afk);`);
    }

    query.push(`RETURN = events;`);
    return query;
  }

  /**
   * Build query for editor events with optional AFK filtering
   */
  private buildEditorQuery(editorBucketId: string, afkBucketId?: string, hasAfk: boolean = false): string[] {
    const query: string[] = [];

    // Get editor events
    query.push(`events = query_bucket("${editorBucketId}");`);

    // Apply AFK filtering if available
    if (hasAfk && afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`events = filter_period_intersect(events, not_afk);`);
    }

    query.push(`RETURN = events;`);
    return query;
  }

  /**
   * Execute a query and return processed results
   */
  private async executeQuery(
    startTime: Date,
    endTime: Date,
    query: string[]
  ): Promise<QueryResult> {
    // Format time periods for query API
    const timeperiods = [
      `${formatDateForAPI(startTime)}/${formatDateForAPI(endTime)}`
    ];

    logger.debug('Executing query', { query, timeperiods });

    try {
      // Execute query
      const results = await this.client.query(timeperiods, query);
      
      // Query API returns array of results (one per time period)
      // Each result is an array of events
      if (!Array.isArray(results) || results.length === 0) {
        logger.warn('Query returned no results');
        return { events: [], total_duration_seconds: 0 };
      }

      const events = results[0] as AWEvent[];
      
      if (!Array.isArray(events)) {
        logger.warn('Query result is not an array of events', { result: results[0] });
        return { events: [], total_duration_seconds: 0 };
      }

      // Calculate total duration
      const totalDuration = events.reduce((sum, event) => sum + event.duration, 0);

      logger.info(`Query returned ${events.length} events with total duration ${totalDuration}s`);

      return {
        events,
        total_duration_seconds: totalDuration,
      };
    } catch (error) {
      logger.error('Query execution failed', error);
      throw error;
    }
  }

  /**
   * Get all window and editor events (for categorization) filtered by AFK
   */
  async getAllEventsFiltered(
    startTime: Date,
    endTime: Date
  ): Promise<AWEvent[]> {
    logger.debug('Getting all AFK-filtered events for categorization');

    // Get both window and editor events
    const [windowResult, editorResult] = await Promise.all([
      this.getWindowEventsFiltered(startTime, endTime).catch(() => ({ events: [], total_duration_seconds: 0 })),
      this.getEditorEventsFiltered(startTime, endTime).catch(() => ({ events: [], total_duration_seconds: 0 })),
    ]);

    // Combine events
    const allEvents = [...windowResult.events, ...editorResult.events];

    logger.info(`Combined ${allEvents.length} events from window and editor buckets`);

    return allEvents;
  }

  /**
   * Get canonical events - window events enriched with browser/editor data
   *
   * This implements ActivityWatch's canonical events approach:
   * 1. Window events are the base (AFK-filtered)
   * 2. Browser events are filtered to only when browser window was active
   * 3. Editor events are filtered to only when editor window was active
   *
   * This ensures browser/editor activity is only counted when those windows
   * were actually active, preventing double-counting.
   */
  async getCanonicalEvents(
    startTime: Date,
    endTime: Date
  ): Promise<CanonicalQueryResult> {
    logger.debug('Getting canonical events (window + browser + editor)', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    // Find all bucket types
    const [windowBuckets, browserBuckets, editorBuckets, afkBuckets] = await Promise.all([
      this.capabilities.findWindowBuckets(),
      this.capabilities.findBrowserBuckets(),
      this.capabilities.findEditorBuckets(),
      this.capabilities.findAfkBuckets(),
    ]);

    const hasAfk = afkBuckets.length > 0;
    const afkBucketId = afkBuckets[0]?.id;

    // Get window events (base layer, AFK-filtered)
    const windowEvents: AWEvent[] = [];
    let totalDuration = 0;

    for (const bucket of windowBuckets) {
      const query = this.buildWindowQuery(bucket.id, afkBucketId, hasAfk);
      const result = await this.executeQuery(startTime, endTime, query);
      windowEvents.push(...result.events);
      totalDuration += result.total_duration_seconds;
    }

    logger.info(`Got ${windowEvents.length} window events`);

    // Get browser events filtered by active browser windows
    const browserEvents: AWEvent[] = [];

    for (const browserBucket of browserBuckets) {
      // Determine which browser this is (chrome, firefox, etc.)
      const browserType = this.detectBrowserType(browserBucket.id);
      const appNames = browserType ? BROWSER_APP_NAMES[browserType] : [];

      if (appNames.length === 0) {
        logger.warn(`Could not detect browser type for bucket ${browserBucket.id}`);
        continue;
      }

      // Build query that filters browser events by active window
      const query = this.buildCanonicalBrowserQuery(
        browserBucket.id,
        windowBuckets[0]?.id, // Use first window bucket
        appNames,
        afkBucketId,
        hasAfk
      );

      const result = await this.executeQuery(startTime, endTime, query);
      browserEvents.push(...result.events);
    }

    logger.info(`Got ${browserEvents.length} browser events (filtered by active window)`);

    // Get editor events filtered by active editor windows
    const editorEvents: AWEvent[] = [];

    for (const editorBucket of editorBuckets) {
      // Determine which editor this is (vscode, vim, etc.)
      const editorType = this.detectEditorType(editorBucket.id);
      const appNames = editorType ? EDITOR_APP_NAMES[editorType] : [];

      if (appNames.length === 0) {
        logger.warn(`Could not detect editor type for bucket ${editorBucket.id}`);
        continue;
      }

      // Build query that filters editor events by active window
      const query = this.buildCanonicalEditorQuery(
        editorBucket.id,
        windowBuckets[0]?.id, // Use first window bucket
        appNames,
        afkBucketId,
        hasAfk
      );

      const result = await this.executeQuery(startTime, endTime, query);
      editorEvents.push(...result.events);
    }

    logger.info(`Got ${editorEvents.length} editor events (filtered by active window)`);

    return {
      window_events: windowEvents,
      browser_events: browserEvents,
      editor_events: editorEvents,
      total_duration_seconds: totalDuration,
    };
  }

  /**
   * Build canonical browser query - filters browser events by active browser window
   */
  private buildCanonicalBrowserQuery(
    browserBucketId: string,
    windowBucketId: string | undefined,
    browserAppNames: string[],
    afkBucketId?: string,
    hasAfk: boolean = false
  ): string[] {
    const query: string[] = [];

    if (!windowBucketId) {
      // No window tracking, just return browser events with AFK filter
      query.push(`events = query_bucket("${browserBucketId}");`);
      if (hasAfk && afkBucketId) {
        query.push(`afk_events = query_bucket("${afkBucketId}");`);
        query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
        query.push(`events = filter_period_intersect(events, not_afk);`);
      }
      query.push(`RETURN = events;`);
      return query;
    }

    // Get window events
    query.push(`window_events = query_bucket("${windowBucketId}");`);

    // Apply AFK filtering to window events
    if (hasAfk && afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`window_events = filter_period_intersect(window_events, not_afk);`);
    }

    // Filter window events to only browser windows
    const appNamesJson = JSON.stringify(browserAppNames);
    query.push(`browser_windows = filter_keyvals(window_events, "app", ${appNamesJson});`);

    // Get browser events
    query.push(`browser_events = query_bucket("${browserBucketId}");`);

    // Filter browser events to only when browser window was active
    query.push(`events = filter_period_intersect(browser_events, browser_windows);`);

    query.push(`RETURN = events;`);
    return query;
  }

  /**
   * Build canonical editor query - filters editor events by active editor window
   */
  private buildCanonicalEditorQuery(
    editorBucketId: string,
    windowBucketId: string | undefined,
    editorAppNames: string[],
    afkBucketId?: string,
    hasAfk: boolean = false
  ): string[] {
    const query: string[] = [];

    if (!windowBucketId) {
      // No window tracking, just return editor events with AFK filter
      query.push(`events = query_bucket("${editorBucketId}");`);
      if (hasAfk && afkBucketId) {
        query.push(`afk_events = query_bucket("${afkBucketId}");`);
        query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
        query.push(`events = filter_period_intersect(events, not_afk);`);
      }
      query.push(`RETURN = events;`);
      return query;
    }

    // Get window events
    query.push(`window_events = query_bucket("${windowBucketId}");`);

    // Apply AFK filtering to window events
    if (hasAfk && afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`window_events = filter_period_intersect(window_events, not_afk);`);
    }

    // Filter window events to only editor windows
    const appNamesJson = JSON.stringify(editorAppNames);
    query.push(`editor_windows = filter_keyvals(window_events, "app", ${appNamesJson});`);

    // Get editor events
    query.push(`editor_events = query_bucket("${editorBucketId}");`);

    // Filter editor events to only when editor window was active
    query.push(`events = filter_period_intersect(editor_events, editor_windows);`);

    query.push(`RETURN = events;`);
    return query;
  }

  /**
   * Detect browser type from bucket ID
   */
  private detectBrowserType(bucketId: string): string | null {
    const lowerBucketId = bucketId.toLowerCase();

    if (lowerBucketId.includes('chrome') && !lowerBucketId.includes('chromium')) {
      return 'chrome';
    }
    if (lowerBucketId.includes('chromium')) {
      return 'chrome'; // Chromium uses same app names
    }
    if (lowerBucketId.includes('firefox')) {
      return 'firefox';
    }
    if (lowerBucketId.includes('opera')) {
      return 'opera';
    }
    if (lowerBucketId.includes('brave')) {
      return 'brave';
    }
    if (lowerBucketId.includes('edge')) {
      return 'edge';
    }
    if (lowerBucketId.includes('vivaldi')) {
      return 'vivaldi';
    }
    if (lowerBucketId.includes('safari')) {
      return 'safari';
    }

    return null;
  }

  /**
   * Detect editor type from bucket ID
   */
  private detectEditorType(bucketId: string): string | null {
    const lowerBucketId = bucketId.toLowerCase();

    if (lowerBucketId.includes('vscode') || lowerBucketId.includes('code')) {
      return 'vscode';
    }
    if (lowerBucketId.includes('vim')) {
      return 'vim';
    }
    if (lowerBucketId.includes('emacs')) {
      return 'emacs';
    }
    if (lowerBucketId.includes('sublime')) {
      return 'sublime';
    }
    if (lowerBucketId.includes('atom')) {
      return 'atom';
    }
    if (lowerBucketId.includes('intellij') || lowerBucketId.includes('idea')) {
      return 'intellij';
    }
    if (lowerBucketId.includes('pycharm')) {
      return 'pycharm';
    }
    if (lowerBucketId.includes('webstorm')) {
      return 'webstorm';
    }

    return null;
  }
}

