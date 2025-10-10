/**
 * Service for executing ActivityWatch queries with AFK filtering
 * 
 * This service uses ActivityWatch's query API to fetch events that are
 * automatically filtered by AFK (away from keyboard) status. This ensures
 * that only active time is counted in all activity reports.
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { AWEvent } from '../types.js';
import { formatDateForAPI } from '../utils/time.js';
import { logger } from '../utils/logger.js';

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
}

