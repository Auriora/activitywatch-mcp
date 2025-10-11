/**
 * Service for building custom ActivityWatch queries
 * 
 * This service provides a flexible query builder that allows the agent to
 * construct custom queries with various filtering and aggregation options.
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { AWEvent } from '../types.js';
import { formatDateForAPI } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { QueryEventsParams } from '../tools/schemas.js';

export interface QueryBuilderResult {
  readonly events: readonly AWEvent[];
  readonly total_duration_seconds: number;
  readonly query_used: readonly string[];
  readonly buckets_queried: readonly string[];
}

/**
 * Service for building and executing custom queries
 */
export class QueryBuilderService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService
  ) {}

  /**
   * Build and execute a custom query based on parameters
   */
  async queryEvents(params: QueryEventsParams): Promise<QueryBuilderResult> {
    logger.debug('Building custom query', { params });

    // Parse timestamps
    const startTime = new Date(params.start_time);
    const endTime = new Date(params.end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('Invalid start_time or end_time format. Use ISO 8601 format.');
    }

    if (startTime >= endTime) {
      throw new Error('start_time must be before end_time');
    }

    // Build query based on type
    let query: string[];
    let bucketIds: string[];

    if (params.query_type === 'custom' && params.custom_query) {
      // Use custom query directly
      query = params.custom_query;
      bucketIds = params.bucket_ids || [];
      logger.info('Using custom query', { query, bucketIds });
    } else {
      // Build query based on type
      const queryResult = await this.buildQuery(params);
      query = queryResult.query;
      bucketIds = queryResult.bucketIds;
    }

    // Execute query
    const result = await this.executeQuery(startTime, endTime, query);

    // Apply post-processing filters
    let filteredEvents = result.events;

    // Filter by minimum duration
    if (params.min_duration_seconds > 0) {
      filteredEvents = filteredEvents.filter(
        event => event.duration >= params.min_duration_seconds
      );
    }

    // Apply limit
    if (params.limit && filteredEvents.length > params.limit) {
      filteredEvents = filteredEvents.slice(0, params.limit);
    }

    // Calculate total duration
    const totalDuration = filteredEvents.reduce((sum, event) => sum + event.duration, 0);

    logger.info('Query completed', {
      eventCount: filteredEvents.length,
      totalDuration,
      bucketsQueried: bucketIds.length,
    });

    return {
      events: filteredEvents,
      total_duration_seconds: totalDuration,
      query_used: query,
      buckets_queried: bucketIds,
    };
  }

  /**
   * Build query based on query type and parameters
   */
  private async buildQuery(params: QueryEventsParams): Promise<{
    query: string[];
    bucketIds: string[];
  }> {
    const query: string[] = [];
    let bucketIds: string[] = [];

    // Find relevant buckets
    const afkBuckets = await this.capabilities.findAfkBuckets();
    const hasAfk = params.filter_afk && afkBuckets.length > 0;
    const afkBucketId = afkBuckets[0]?.id;

    switch (params.query_type) {
      case 'window': {
        const windowBuckets = await this.capabilities.findWindowBuckets();
        const editorBuckets = await this.capabilities.findEditorBuckets();
        bucketIds = [...windowBuckets, ...editorBuckets].map(b => b.id);

        if (bucketIds.length === 0) {
          throw new Error('No window or editor tracking buckets available');
        }

        // Query first bucket (we'll combine multiple buckets in a loop)
        const bucketId = bucketIds[0];
        query.push(`events = query_bucket("${bucketId}");`);

        // Apply AFK filtering
        if (hasAfk && afkBucketId) {
          query.push(`afk_events = query_bucket("${afkBucketId}");`);
          query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
          query.push(`events = filter_period_intersect(events, not_afk);`);
        }

        // Apply app filters
        if (params.filter_apps && params.filter_apps.length > 0) {
          const appsJson = JSON.stringify(params.filter_apps);
          query.push(`events = filter_keyvals(events, "app", ${appsJson});`);
        }

        if (params.exclude_apps && params.exclude_apps.length > 0) {
          const excludeAppsJson = JSON.stringify(params.exclude_apps);
          query.push(`events = exclude_keyvals(events, "app", ${excludeAppsJson});`);
        }

        // Apply title filters
        if (params.filter_titles && params.filter_titles.length > 0) {
          for (const titlePattern of params.filter_titles) {
            query.push(`events = filter_keyvals(events, "title", ["${titlePattern}"]);`);
          }
        }

        // Merge events if requested
        if (params.merge_events) {
          query.push(`events = merge_events_by_keys(events, ["app", "title"]);`);
        }

        query.push(`RETURN = events;`);
        break;
      }

      case 'browser': {
        const browserBuckets = await this.capabilities.findBrowserBuckets();
        bucketIds = browserBuckets.map(b => b.id);

        if (bucketIds.length === 0) {
          throw new Error('No browser tracking buckets available');
        }

        const bucketId = bucketIds[0];
        query.push(`events = query_bucket("${bucketId}");`);

        // Apply AFK filtering
        if (hasAfk && afkBucketId) {
          query.push(`afk_events = query_bucket("${afkBucketId}");`);
          query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
          query.push(`events = filter_period_intersect(events, not_afk);`);
        }

        // Apply domain filters
        if (params.filter_domains && params.filter_domains.length > 0) {
          // Filter by URL containing domain
          for (const domain of params.filter_domains) {
            query.push(`events = filter_keyvals(events, "url", [".*${domain}.*"]);`);
          }
        }

        // Merge events if requested
        if (params.merge_events) {
          query.push(`events = merge_events_by_keys(events, ["url"]);`);
        }

        query.push(`RETURN = events;`);
        break;
      }

      case 'editor': {
        const editorBuckets = await this.capabilities.findEditorBuckets();
        bucketIds = editorBuckets.map(b => b.id);

        if (bucketIds.length === 0) {
          throw new Error('No editor tracking buckets available');
        }

        const bucketId = bucketIds[0];
        query.push(`events = query_bucket("${bucketId}");`);

        // Apply AFK filtering
        if (hasAfk && afkBucketId) {
          query.push(`afk_events = query_bucket("${afkBucketId}");`);
          query.push(`not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`);
          query.push(`events = filter_period_intersect(events, not_afk);`);
        }

        // Merge events if requested
        if (params.merge_events) {
          query.push(`events = merge_events_by_keys(events, ["file", "project"]);`);
        }

        query.push(`RETURN = events;`);
        break;
      }

      case 'afk': {
        bucketIds = afkBuckets.map(b => b.id);

        if (bucketIds.length === 0) {
          throw new Error('No AFK tracking buckets available');
        }

        const bucketId = bucketIds[0];
        query.push(`events = query_bucket("${bucketId}");`);

        // Optionally filter to only "afk" or "not-afk" status
        // (by default, return all AFK events)
        
        query.push(`RETURN = events;`);
        break;
      }

      default:
        throw new Error(`Unknown query_type: ${params.query_type}`);
    }

    return { query, bucketIds };
  }

  /**
   * Execute a query and return processed results
   */
  private async executeQuery(
    startTime: Date,
    endTime: Date,
    query: string[]
  ): Promise<{ events: AWEvent[]; total_duration_seconds: number }> {
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
}

