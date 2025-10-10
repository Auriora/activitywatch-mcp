/**
 * Service for AFK (Away From Keyboard) activity analysis
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { AWEvent } from '../types.js';
import { formatDateForAPI } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { getStringProperty } from '../utils/type-guards.js';

export interface AfkPeriod {
  readonly start: string;
  readonly end: string;
  readonly duration_seconds: number;
  readonly status: 'afk' | 'not-afk';
}

export interface AfkSummary {
  readonly total_afk_seconds: number;
  readonly total_active_seconds: number;
  readonly afk_percentage: number;
  readonly active_percentage: number;
  readonly afk_periods: readonly AfkPeriod[];
  readonly time_range: {
    readonly start: string;
    readonly end: string;
  };
}

export class AfkActivityService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService
  ) {}

  /**
   * Get AFK activity for a time period
   */
  async getAfkActivity(
    startTime: Date,
    endTime: Date
  ): Promise<AfkSummary> {
    logger.debug('Getting AFK activity', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });

    // Find AFK tracking buckets
    const afkBuckets = await this.capabilities.findAfkBuckets();
    logger.info(`Found ${afkBuckets.length} AFK tracking buckets`);

    if (afkBuckets.length === 0) {
      logger.warn('No AFK tracking buckets available');
      // Return empty summary instead of throwing error
      const totalSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
      return {
        total_afk_seconds: 0,
        total_active_seconds: totalSeconds,
        afk_percentage: 0,
        active_percentage: 100,
        afk_periods: [],
        time_range: {
          start: formatDateForAPI(startTime),
          end: formatDateForAPI(endTime),
        },
      };
    }

    // Collect events from all AFK buckets
    let allEvents: AWEvent[] = [];

    for (const bucket of afkBuckets) {
      try {
        logger.debug(`Fetching AFK events from bucket: ${bucket.id}`);
        const events = await this.client.getEvents(bucket.id, {
          start: formatDateForAPI(startTime),
          end: formatDateForAPI(endTime),
        });
        logger.debug(`Retrieved ${events.length} AFK events from ${bucket.id}`);
        allEvents = allEvents.concat(events);
      } catch (error) {
        logger.error(`Failed to get AFK events from bucket ${bucket.id}`, error);
      }
    }

    logger.info(`Total AFK events collected: ${allEvents.length}`);

    if (allEvents.length === 0) {
      const totalSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
      return {
        total_afk_seconds: 0,
        total_active_seconds: totalSeconds,
        afk_percentage: 0,
        active_percentage: 100,
        afk_periods: [],
        time_range: {
          start: formatDateForAPI(startTime),
          end: formatDateForAPI(endTime),
        },
      };
    }

    // Process AFK events
    const afkPeriods = this.processAfkEvents(allEvents);
    
    // Calculate totals
    const totalAfkSeconds = afkPeriods
      .filter(p => p.status === 'afk')
      .reduce((sum, p) => sum + p.duration_seconds, 0);
    
    const totalActiveSeconds = afkPeriods
      .filter(p => p.status === 'not-afk')
      .reduce((sum, p) => sum + p.duration_seconds, 0);

    const totalSeconds = totalAfkSeconds + totalActiveSeconds;
    const afkPercentage = totalSeconds > 0 
      ? Math.round((totalAfkSeconds / totalSeconds) * 10000) / 100 
      : 0;
    const activePercentage = totalSeconds > 0 
      ? Math.round((totalActiveSeconds / totalSeconds) * 10000) / 100 
      : 0;

    return {
      total_afk_seconds: totalAfkSeconds,
      total_active_seconds: totalActiveSeconds,
      afk_percentage: afkPercentage,
      active_percentage: activePercentage,
      afk_periods: afkPeriods,
      time_range: {
        start: formatDateForAPI(startTime),
        end: formatDateForAPI(endTime),
      },
    };
  }

  /**
   * Process AFK events into periods
   */
  private processAfkEvents(events: AWEvent[]): AfkPeriod[] {
    const periods: AfkPeriod[] = [];

    for (const event of events) {
      const status = getStringProperty(event.data, 'status');
      
      // ActivityWatch AFK events have status: "afk" or "not-afk"
      if (status !== 'afk' && status !== 'not-afk') {
        continue;
      }

      const startTime = new Date(event.timestamp);
      const endTime = new Date(startTime.getTime() + event.duration * 1000);

      periods.push({
        start: event.timestamp,
        end: endTime.toISOString(),
        duration_seconds: event.duration,
        status: status as 'afk' | 'not-afk',
      });
    }

    // Sort by start time
    return periods.sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  /**
   * Get simple AFK statistics (for daily summary)
   */
  async getAfkStats(
    startTime: Date,
    endTime: Date
  ): Promise<{
    afk_seconds: number;
    active_seconds: number;
  }> {
    const summary = await this.getAfkActivity(startTime, endTime);
    return {
      afk_seconds: summary.total_afk_seconds,
      active_seconds: summary.total_active_seconds,
    };
  }
}

