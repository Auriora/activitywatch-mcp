/**
 * Service for web/browser activity analysis
 */

import { CategoryService } from './category.js';
import { QueryService } from './query.js';
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
    private queryService: QueryService,
    private categoryService?: CategoryService
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

    // Use query service to get AFK-filtered browser events
    let queryResult;
    try {
      queryResult = await this.queryService.getBrowserEventsFiltered(
        timeRange.start,
        timeRange.end
      );
    } catch (error) {
      logger.error('Failed to get AFK-filtered browser events', error);
      throw new AWError(
        'No browser activity buckets found. This usually means:\n' +
        '1. Browser watchers are not installed (aw-watcher-web)\n' +
        '2. No browser data has been collected yet\n\n' +
        'Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.',
        'NO_BUCKETS_FOUND'
      );
    }

    const allEvents = queryResult.events as AWEvent[];
    logger.info(`Total AFK-filtered browser events collected: ${allEvents.length}`);

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

      // Determine category if requested
      let category: string | undefined;
      if (params.include_categories && this.categoryService) {
        category = this.categoryService.categorizeEvent(firstEvent) || undefined;
      }

      // Extract timestamps
      const timestamps = events.map(e => new Date(e.timestamp).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      // Extract web-specific metadata
      let audible = false;
      let incognito = false;
      let tabCountSum = 0;
      let tabCountCount = 0;

      for (const event of events) {
        if (event.data.audible === true) audible = true;
        if (event.data.incognito === true) incognito = true;
        if (typeof event.data.tabCount === 'number') {
          tabCountSum += event.data.tabCount;
          tabCountCount++;
        }
      }

      const tabCountAvg = tabCountCount > 0 ? tabCountSum / tabCountCount : undefined;

      websites.push({
        domain: groupBy === 'domain' ? key : extractDomain(url),
        url: groupBy === 'url' ? key : undefined,
        title: groupBy === 'title' ? key : (title || undefined),
        duration_seconds: duration,
        duration_hours: secondsToHours(duration),
        percentage: calculatePercentage(duration, totalTime),
        category,
        event_count: events.length,
        first_seen: params.response_format === 'detailed' ? firstSeen : undefined,
        last_seen: params.response_format === 'detailed' ? lastSeen : undefined,
        audible: params.response_format === 'detailed' ? audible : undefined,
        incognito: params.response_format === 'detailed' ? incognito : undefined,
        tab_count_avg: params.response_format === 'detailed' ? tabCountAvg : undefined,
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

