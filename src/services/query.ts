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
import {
  getBrowserAppNames,
  getEditorAppNames,
  detectBrowserType,
  detectEditorType,
} from '../config/app-names.js';

export interface QueryResult {
  readonly events: readonly AWEvent[];
  readonly total_duration_seconds: number;
}



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

    const afkBucketId = afkBuckets[0]?.id;
    const bucketIds = allBuckets.map(bucket => bucket.id);
    const result = await this.executeMergedEventsQuery(bucketIds, startTime, endTime, { afkBucketId });

    logger.info(`Combined ${result.events.length} events from ${bucketIds.length} buckets`);
    return result;
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

    const afkBucketId = afkBuckets[0]?.id;
    const bucketIds = browserBuckets.map(bucket => bucket.id);
    const result = await this.executeMergedEventsQuery(bucketIds, startTime, endTime, { afkBucketId });

    logger.info(`Combined ${result.events.length} events from ${bucketIds.length} buckets`);
    return result;
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

    const afkBucketId = afkBuckets[0]?.id;
    const bucketIds = editorBuckets.map(bucket => bucket.id);
    const result = await this.executeMergedEventsQuery(bucketIds, startTime, endTime, { afkBucketId });

    logger.info(`Combined ${result.events.length} events from ${bucketIds.length} buckets`);
    return result;
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

  private async executeMergedEventsQuery(
    bucketIds: readonly string[],
    startTime: Date,
    endTime: Date,
    options?: { afkBucketId?: string }
  ): Promise<QueryResult> {
    if (bucketIds.length === 0) {
      return { events: [], total_duration_seconds: 0 };
    }

    const mergedQuery = this.buildMergedEventsQuery(bucketIds, options?.afkBucketId);
    logger.debug('Executing merged bucket query', {
      bucketCount: bucketIds.length,
      buckets: bucketIds,
      afkBucketId: options?.afkBucketId,
    });
    return this.executeQuery(startTime, endTime, mergedQuery);
  }

  private buildMergedEventsQuery(
    bucketIds: readonly string[],
    afkBucketId?: string
  ): string[] {
    if (bucketIds.length === 0) {
      return ['RETURN = []'];
    }

    const bucketExpressions = bucketIds
      .map(id => `query_bucket("${id}")`)
      .join(', ');

    const query: string[] = [];
    query.push(`events = merge_events([${bucketExpressions}]);`);

    if (afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
      query.push(`events = filter_period_intersect(events, not_afk);`);
    }

    query.push('RETURN = events;');
    return query;
  }

  private async executeCanonicalMergedQuery(
    windowBucketIds: readonly string[],
    browserConfigs: ReadonlyArray<{ bucketId: string; appNames: string[] }>,
    editorConfigs: ReadonlyArray<{ bucketId: string; appNames: string[] }>,
    startTime: Date,
    endTime: Date,
    afkBucketId?: string
  ): Promise<CanonicalQueryResult> {
    const query = this.buildCanonicalMergedQuery(
      windowBucketIds,
      browserConfigs,
      editorConfigs,
      afkBucketId
    );

    const timeperiods = [
      `${formatDateForAPI(startTime)}/${formatDateForAPI(endTime)}`
    ];

    logger.debug('Executing canonical merged query', {
      windowBucketCount: windowBucketIds.length,
      browserBucketCount: browserConfigs.length,
      editorBucketCount: editorConfigs.length,
      afkBucketId,
    });

    try {
      const results = await this.client.query(timeperiods, query);
      if (!Array.isArray(results) || results.length === 0) {
        logger.warn('Canonical query returned no results');
        return {
          window_events: [],
          browser_events: [],
          editor_events: [],
          total_duration_seconds: 0,
        };
      }

      const payload = results[0] as {
        window_events?: AWEvent[];
        browser_events?: AWEvent[];
        editor_events?: AWEvent[];
      };

      const windowEvents = Array.isArray(payload?.window_events) ? payload.window_events : [];
      const browserEvents = Array.isArray(payload?.browser_events) ? payload.browser_events : [];
      const editorEvents = Array.isArray(payload?.editor_events) ? payload.editor_events : [];
      const totalDuration = windowEvents.reduce((sum, event) => sum + event.duration, 0);

      return {
        window_events: windowEvents,
        browser_events: browserEvents,
        editor_events: editorEvents,
        total_duration_seconds: totalDuration,
      };
    } catch (error) {
      logger.error('Canonical merged query execution failed', error);
      throw error;
    }
  }

  private buildCanonicalMergedQuery(
    windowBucketIds: readonly string[],
    browserConfigs: ReadonlyArray<{ bucketId: string; appNames: string[] }>,
    editorConfigs: ReadonlyArray<{ bucketId: string; appNames: string[] }>,
    afkBucketId?: string
  ): string[] {
    const query: string[] = [];

    if (afkBucketId) {
      query.push(`afk_events = query_bucket("${afkBucketId}");`);
      query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
    }

    if (windowBucketIds.length > 0) {
      const windowBucketsExpr = windowBucketIds
        .map(id => `query_bucket("${id}")`)
        .join(', ');
      query.push(`window_events = merge_events([${windowBucketsExpr}]);`);
      if (afkBucketId) {
        query.push('window_events = filter_period_intersect(window_events, not_afk);');
      }
    } else {
      query.push('window_events = [];');
    }

    if (browserConfigs.length > 0) {
    const browserComponents = browserConfigs.map(({ bucketId, appNames }) => {
        if (windowBucketIds.length > 0 && appNames.length > 0) {
          const appNamesJson = JSON.stringify(appNames);
          return [
            `filter_period_intersect(` +
            `query_bucket("${bucketId}"), ` +
            `filter_keyvals(window_events, "app", ${appNamesJson})` +
            `)`
          ].join('');
        }
        return `query_bucket("${bucketId}")`;
      });

      query.push(`browser_components = [${browserComponents.join(', ')}];`);
      query.push('browser_events = merge_events(browser_components);');
      if (windowBucketIds.length === 0 && afkBucketId) {
        query.push('browser_events = filter_period_intersect(browser_events, not_afk);');
      }
    } else {
      query.push('browser_events = [];');
    }

    if (editorConfigs.length > 0) {
    const editorComponents = editorConfigs.map(({ bucketId, appNames }) => {
        if (windowBucketIds.length > 0 && appNames.length > 0) {
          const appNamesJson = JSON.stringify(appNames);
          return [
            `filter_period_intersect(` +
            `query_bucket("${bucketId}"), ` +
            `filter_keyvals(window_events, "app", ${appNamesJson})` +
            `)`
          ].join('');
        }
        return `query_bucket("${bucketId}")`;
      });

      query.push(`editor_components = [${editorComponents.join(', ')}];`);
      query.push('editor_events = merge_events(editor_components);');
      if (windowBucketIds.length === 0 && afkBucketId) {
        query.push('editor_events = filter_period_intersect(editor_events, not_afk);');
      }
    } else {
      query.push('editor_events = [];');
    }

    query.push('RETURN = {');
    query.push('  "window_events": window_events,');
    query.push('  "browser_events": browser_events,');
    query.push('  "editor_events": editor_events');
    query.push('};');

    return query;
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

    const afkBucketId = afkBuckets[0]?.id;
    const windowBucketIds = windowBuckets.map(bucket => bucket.id);

    const browserConfigs = browserBuckets.reduce<Array<{ bucketId: string; appNames: string[] }>>((acc, bucket) => {
      const browserType = detectBrowserType(bucket.id);
      const appNames = browserType ? getBrowserAppNames(browserType) : [];
      if (appNames.length === 0) {
        logger.warn(`Could not detect browser type for bucket ${bucket.id}`);
        return acc;
      }
      acc.push({ bucketId: bucket.id, appNames });
      return acc;
    }, []);

    const editorConfigs = editorBuckets.reduce<Array<{ bucketId: string; appNames: string[] }>>((acc, bucket) => {
      const editorType = detectEditorType(bucket.id);
      const appNames = editorType ? getEditorAppNames(editorType) : [];
      if (appNames.length === 0) {
        logger.warn(`Could not detect editor type for bucket ${bucket.id}`);
        return acc;
      }
      acc.push({ bucketId: bucket.id, appNames });
      return acc;
    }, []);

    const result = await this.executeCanonicalMergedQuery(
      windowBucketIds,
      browserConfigs,
      editorConfigs,
      startTime,
      endTime,
      afkBucketId
    );

    logger.info('Canonical query aggregated events', {
      windowEventCount: result.window_events.length,
      browserEventCount: result.browser_events.length,
      editorEventCount: result.editor_events.length,
      windowBucketCount: windowBucketIds.length,
      browserBucketCount: browserConfigs.length,
      editorBucketCount: editorConfigs.length,
    });

    return result;
  }

}
