/**
 * Service for window/application activity analysis
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { CategoryService } from './category.js';
import { AppUsage, WindowActivityParams, AWError, AWEvent } from '../types.js';
import { getTimeRange, formatDateForAPI, secondsToHours } from '../utils/time.js';
import {
  normalizeAppName,
  isSystemApp,
  filterByDuration,
  calculatePercentage,
  sortByDuration,
  takeTop,
  sumDurations,
} from '../utils/filters.js';
import { formatWindowActivityConcise } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';
import { getStringProperty } from '../utils/type-guards.js';

export class WindowActivityService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService,
    private categoryService?: CategoryService
  ) {}

  /**
   * Get all window and editor events for a time period (for categorization)
   */
  async getAllEvents(startTime: Date, endTime: Date): Promise<AWEvent[]> {
    const windowBuckets = await this.capabilities.findWindowBuckets();
    const editorBuckets = await this.capabilities.findEditorBuckets();
    const allBuckets = [...windowBuckets, ...editorBuckets];

    if (allBuckets.length === 0) {
      return [];
    }

    let allEvents: AWEvent[] = [];

    for (const bucket of allBuckets) {
      try {
        const events = await this.client.getEvents(bucket.id, {
          start: formatDateForAPI(startTime),
          end: formatDateForAPI(endTime),
        });
        allEvents = allEvents.concat(events);
      } catch (error) {
        logger.error(`Failed to get events from bucket ${bucket.id}`, error);
      }
    }

    return allEvents;
  }


  /**
   * Get window/application activity for a time period
   */
  async getWindowActivity(params: WindowActivityParams): Promise<{
    total_time_seconds: number;
    applications: AppUsage[];
    time_range: { start: string; end: string };
  }> {
    logger.debug('Getting window activity', { params });

    // Get time range
    const timeRange = getTimeRange(
      params.time_period,
      params.custom_start,
      params.custom_end
    );

    logger.debug('Time range calculated', {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    });

    // Find window tracking buckets (including editor buckets for IDE activity)
    const windowBuckets = await this.capabilities.findWindowBuckets();
    const editorBuckets = await this.capabilities.findEditorBuckets();
    const allBuckets = [...windowBuckets, ...editorBuckets];

    logger.info(`Found ${windowBuckets.length} window tracking buckets and ${editorBuckets.length} editor tracking buckets`);

    if (allBuckets.length === 0) {
      logger.warn('No window or editor tracking buckets available');
      throw new AWError(
        'No window activity buckets found. This usually means:\n' +
        '1. ActivityWatch is not running\n' +
        '2. The window watcher (aw-watcher-window) is not installed\n' +
        '3. No data has been collected yet\n\n' +
        'Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.',
        'NO_BUCKETS_FOUND'
      );
    }

    // Collect events from all window and editor buckets
    let allEvents: AWEvent[] = [];

    for (const bucket of allBuckets) {
      try {
        logger.debug(`Fetching events from bucket: ${bucket.id}`);
        const events = await this.client.getEvents(bucket.id, {
          start: formatDateForAPI(timeRange.start),
          end: formatDateForAPI(timeRange.end),
        });
        logger.debug(`Retrieved ${events.length} events from ${bucket.id}`);
        allEvents = allEvents.concat(events);
      } catch (error) {
        // Continue with other buckets if one fails
        logger.error(`Failed to get events from bucket ${bucket.id}`, error);
      }
    }

    logger.info(`Total events collected: ${allEvents.length}`);

    if (allEvents.length === 0) {
      return {
        total_time_seconds: 0,
        applications: [],
        time_range: {
          start: formatDateForAPI(timeRange.start),
          end: formatDateForAPI(timeRange.end),
        },
      };
    }

    // Filter by minimum duration
    const minDuration = params.min_duration_seconds ?? 5;
    const filteredEvents = filterByDuration(allEvents, minDuration);

    // Group by application
    const appGroups = this.groupByApplication(
      filteredEvents,
      params.exclude_system_apps ?? true
    );

    // Calculate totals
    const totalTime = sumDurations(filteredEvents);

    // Convert to AppUsage format
    const applications: AppUsage[] = [];

    for (const [appName, events] of appGroups.entries()) {
      const duration = sumDurations(events);
      // Get titles from window events or file/project from editor events
      const windowTitles = events
        .map(e => {
          const title = getStringProperty(e.data, 'title');
          if (title) return title;
          // For editor events, use file or project as title
          const file = getStringProperty(e.data, 'file');
          if (file) return file;
          return getStringProperty(e.data, 'project');
        })
        .filter(title => title && title.length > 0) as string[];

      // Determine category if requested
      let category: string | undefined;
      if (params.include_categories && this.categoryService) {
        // Use the first event as representative for categorization
        const representativeEvent = events[0];
        category = this.categoryService.categorizeEvent(representativeEvent) || undefined;
      }

      // Extract timestamps
      const timestamps = events.map(e => new Date(e.timestamp).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      applications.push({
        name: appName,
        duration_seconds: duration,
        duration_hours: secondsToHours(duration),
        percentage: calculatePercentage(duration, totalTime),
        window_titles: params.response_format === 'detailed'
          ? Array.from(new Set(windowTitles))
          : undefined,
        category,
        event_count: events.length,
        first_seen: params.response_format === 'detailed' ? firstSeen : undefined,
        last_seen: params.response_format === 'detailed' ? lastSeen : undefined,
      });
    }

    // Sort and limit
    const sorted = sortByDuration(applications);
    const topN = params.top_n ?? 10;
    const limited = takeTop(sorted, topN);

    return {
      total_time_seconds: totalTime,
      applications: limited,
      time_range: {
        start: formatDateForAPI(timeRange.start),
        end: formatDateForAPI(timeRange.end),
      },
    };
  }

  /**
   * Group events by application name
   * Handles both window events (app field) and editor events (editor field)
   */
  private groupByApplication(
    events: AWEvent[],
    excludeSystemApps: boolean
  ): Map<string, AWEvent[]> {
    const groups = new Map<string, AWEvent[]>();

    for (const event of events) {
      // Try 'app' field first (window events), then 'editor' field (editor events)
      let appName = getStringProperty(event.data, 'app');
      if (!appName) {
        appName = getStringProperty(event.data, 'editor');
      }

      if (!appName) continue;

      // Normalize app name
      const normalizedName = normalizeAppName(appName);

      // Filter system apps
      if (excludeSystemApps && isSystemApp(normalizedName)) {
        continue;
      }

      const group = groups.get(normalizedName) || [];
      group.push(event);
      groups.set(normalizedName, group);
    }

    return groups;
  }

  /**
   * Format window activity for concise output
   */
  formatConcise(data: {
    total_time_seconds: number;
    applications: AppUsage[];
    time_range: { start: string; end: string };
  }): string {
    return formatWindowActivityConcise(data);
  }
}

