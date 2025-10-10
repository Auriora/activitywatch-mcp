/**
 * Service for window/application activity analysis
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
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
    private capabilities: CapabilitiesService
  ) {}

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

    // Find window tracking buckets
    const windowBuckets = await this.capabilities.findWindowBuckets();
    logger.info(`Found ${windowBuckets.length} window tracking buckets`);

    if (windowBuckets.length === 0) {
      logger.warn('No window tracking buckets available');
      throw new AWError(
        'No window activity buckets found. This usually means:\n' +
        '1. ActivityWatch is not running\n' +
        '2. The window watcher (aw-watcher-window) is not installed\n' +
        '3. No data has been collected yet\n\n' +
        'Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.',
        'NO_BUCKETS_FOUND'
      );
    }

    // Collect events from all window buckets
    let allEvents: AWEvent[] = [];

    for (const bucket of windowBuckets) {
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
      const windowTitles = events
        .map(e => getStringProperty(e.data, 'title'))
        .filter(title => title.length > 0);

      applications.push({
        name: appName,
        duration_seconds: duration,
        duration_hours: secondsToHours(duration),
        percentage: calculatePercentage(duration, totalTime),
        window_titles: params.response_format === 'detailed'
          ? Array.from(new Set(windowTitles))
          : undefined,
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
   */
  private groupByApplication(
    events: AWEvent[],
    excludeSystemApps: boolean
  ): Map<string, AWEvent[]> {
    const groups = new Map<string, AWEvent[]>();

    for (const event of events) {
      const appName = getStringProperty(event.data, 'app');

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

