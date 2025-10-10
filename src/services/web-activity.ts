/**
 * Service for web/browser activity analysis
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { WebUsage, WebActivityParams, AWError, AWEvent } from '../types.js';
import { getTimeRange, formatDateForAPI, secondsToHours } from '../utils/time.js';
import {
  extractDomain,
  normalizeDomain,
  shouldExcludeDomain,
  filterByDuration,
  calculatePercentage,
  sortByDuration,
  takeTop,
  sumDurations,
  DEFAULT_EXCLUDED_DOMAINS,
} from '../utils/filters.js';
import { formatWebActivityConcise } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';
import { getStringProperty } from '../utils/type-guards.js';

export class WebActivityService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService
  ) {}

  /**
   * Get web/browser activity for a time period
   */
  async getWebActivity(params: WebActivityParams): Promise<{
    total_time_seconds: number;
    websites: WebUsage[];
    time_range: { start: string; end: string };
  }> {
    logger.debug('Getting web activity', { params });

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

    // Find browser tracking buckets
    const browserBuckets = await this.capabilities.findBrowserBuckets();
    logger.info(`Found ${browserBuckets.length} browser tracking buckets`);

    if (browserBuckets.length === 0) {
      logger.warn('No browser tracking buckets available');
      throw new AWError(
        'No browser activity buckets found. This usually means:\n' +
        '1. Browser watchers are not installed (aw-watcher-web)\n' +
        '2. No browser data has been collected yet\n\n' +
        'Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.',
        'NO_BUCKETS_FOUND'
      );
    }

    // Collect events from all browser buckets
    let allEvents: AWEvent[] = [];

    for (const bucket of browserBuckets) {
      try {
        logger.debug(`Fetching events from bucket: ${bucket.id}`);
        const events = await this.client.getEvents(bucket.id, {
          start: formatDateForAPI(timeRange.start),
          end: formatDateForAPI(timeRange.end),
        });
        logger.debug(`Retrieved ${events.length} events from ${bucket.id}`);
        allEvents = allEvents.concat(events);
      } catch (error) {
        logger.error(`Failed to get events from bucket ${bucket.id}`, error);
      }
    }

    logger.info(`Total events collected: ${allEvents.length}`);

    if (allEvents.length === 0) {
      return {
        total_time_seconds: 0,
        websites: [],
        time_range: {
          start: formatDateForAPI(timeRange.start),
          end: formatDateForAPI(timeRange.end),
        },
      };
    }

    // Filter by minimum duration
    const minDuration = params.min_duration_seconds ?? 5;
    const filteredEvents = filterByDuration(allEvents, minDuration);

    // Exclude domains
    const excludeDomains = params.exclude_domains ?? DEFAULT_EXCLUDED_DOMAINS;
    const domainFilteredEvents = filteredEvents.filter(event => {
      const url = getStringProperty(event.data, 'url');
      if (!url) return false;

      const domain = extractDomain(url);
      return !shouldExcludeDomain(domain, excludeDomains);
    });

    // Group by domain/url/title based on params
    const groupBy = params.group_by ?? 'domain';
    const webGroups = this.groupWebActivity(domainFilteredEvents, groupBy);

    // Calculate totals
    const totalTime = sumDurations(domainFilteredEvents);

    // Convert to WebUsage format
    const websites: WebUsage[] = [];

    for (const [key, events] of webGroups.entries()) {
      const duration = sumDurations(events);
      const firstEvent = events[0];
      const url = getStringProperty(firstEvent.data, 'url');
      const title = getStringProperty(firstEvent.data, 'title');

      websites.push({
        domain: groupBy === 'domain' ? key : extractDomain(url),
        url: groupBy === 'url' ? key : undefined,
        title: groupBy === 'title' ? key : (title || undefined),
        duration_seconds: duration,
        duration_hours: secondsToHours(duration),
        percentage: calculatePercentage(duration, totalTime),
      });
    }

    // Sort and limit
    const sorted = sortByDuration(websites);
    const topN = params.top_n ?? 10;
    const limited = takeTop(sorted, topN);

    return {
      total_time_seconds: totalTime,
      websites: limited,
      time_range: {
        start: formatDateForAPI(timeRange.start),
        end: formatDateForAPI(timeRange.end),
      },
    };
  }

  /**
   * Group web events by domain, URL, or title
   */
  private groupWebActivity(
    events: AWEvent[],
    groupBy: 'domain' | 'url' | 'title'
  ): Map<string, AWEvent[]> {
    const groups = new Map<string, AWEvent[]>();

    for (const event of events) {
      const url = getStringProperty(event.data, 'url');
      const title = getStringProperty(event.data, 'title');

      if (!url) continue;

      let key: string;

      switch (groupBy) {
        case 'domain':
          key = normalizeDomain(extractDomain(url));
          break;
        case 'url':
          key = url;
          break;
        case 'title':
          key = title || url;
          break;
      }

      const group = groups.get(key) || [];
      group.push(event);
      groups.set(key, group);
    }

    return groups;
  }

  /**
   * Format web activity for concise output
   */
  formatConcise(data: {
    total_time_seconds: number;
    websites: WebUsage[];
    time_range: { start: string; end: string };
  }): string {
    return formatWebActivityConcise(data);
  }
}

