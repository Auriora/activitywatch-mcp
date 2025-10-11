/**
 * Service for daily activity summaries
 */

import { UnifiedActivityService } from './unified-activity.js';
import { QueryService } from './query.js';
import { AfkActivityService } from './afk-activity.js';
import { CategoryService } from './category.js';
import { DailySummary, DailySummaryParams, HourlyActivity } from '../types.js';
import {
  formatDate,
  secondsToHours,
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  convertToTimezone,
} from '../utils/time.js';
import { formatDailySummaryConcise } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';
import { getTimezoneOffset } from '../config/user-preferences.js';

export class DailySummaryService {
  constructor(
    private unifiedService: UnifiedActivityService,
    private queryService: QueryService,
    private afkService: AfkActivityService,
    private categoryService?: CategoryService
  ) {}

  /**
   * Get comprehensive daily summary
   */
  async getDailySummary(params: DailySummaryParams): Promise<DailySummary> {
    // Get timezone info (from parameter, config, or system)
    const { timezone, offsetMinutes } = getTimezoneOffset(params.timezone);

    // Parse date (default to today in the specified timezone)
    let dateStr: string;
    if (params.date) {
      dateStr = params.date;
    } else {
      // Get today's date in the user's timezone
      const nowInTimezone = convertToTimezone(new Date(), offsetMinutes);
      dateStr = formatDate(nowInTimezone);
    }

    logger.debug('Getting daily summary', { date: dateStr, timezone, offsetMinutes });

    const date = new Date(dateStr + 'T00:00:00Z'); // Parse as UTC midnight

    if (isNaN(date.getTime())) {
      logger.error('Invalid date format', { dateStr });
      throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
    }

    // Get start and end of day in the specified timezone
    const startOfDay = getStartOfDayInTimezone(date, offsetMinutes);
    const endOfDay = getEndOfDayInTimezone(date, offsetMinutes);

    logger.debug('Date range', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      timezone,
    });

    // Get unified activity (includes apps and browser data)
    let unifiedActivity;
    try {
      unifiedActivity = await this.unifiedService.getActivity({
        time_period: 'custom',
        custom_start: startOfDay.toISOString(),
        custom_end: endOfDay.toISOString(),
        top_n: 20, // Get more to extract top apps and websites separately
        response_format: 'detailed',
      });
    } catch (error) {
      unifiedActivity = {
        total_time_seconds: 0,
        activities: [],
        time_range: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
      };
    }

    // Extract top 5 applications (all activities)
    const applications = unifiedActivity.activities
      .map(a => ({
        name: a.app,
        duration_seconds: a.duration_seconds,
        duration_hours: a.duration_hours,
        percentage: a.percentage,
      }))
      .slice(0, 5);

    // Extract top 5 websites (only activities with browser data)
    const websites = unifiedActivity.activities
      .filter(a => a.browser?.domain)
      .map(a => ({
        domain: a.browser!.domain,
        duration_seconds: a.duration_seconds,
        duration_hours: a.duration_hours,
        percentage: a.percentage,
      }))
      .slice(0, 5);

    // Get actual AFK time from AFK tracking buckets
    let afkTime = 0;
    let totalActiveTime = unifiedActivity.total_time_seconds;

    try {
      const afkStats = await this.afkService.getAfkStats(startOfDay, endOfDay);
      afkTime = afkStats.afk_seconds;
      // Use actual active time from AFK tracking if available
      if (afkStats.active_seconds > 0) {
        totalActiveTime = afkStats.active_seconds;
      }
    } catch (error) {
      // Fallback to calculated AFK time if AFK tracking not available
      logger.debug('AFK tracking not available, using calculated AFK time');
      const totalDaySeconds = (endOfDay.getTime() - startOfDay.getTime()) / 1000;
      afkTime = Math.max(0, totalDaySeconds - totalActiveTime);
    }

    // Generate insights
    const insights = this.generateInsights(
      applications,
      websites,
      totalActiveTime
    );

    // Get category breakdown if categories are configured
    let topCategories;
    if (this.categoryService && this.categoryService.hasCategories()) {
      try {
        // Get all window and editor events for categorization
        const allEvents = await this.queryService.getAllEventsFiltered(startOfDay, endOfDay);
        topCategories = this.categoryService.categorizeEvents(allEvents).slice(0, 5);
        logger.debug(`Categorized ${allEvents.length} events into ${topCategories.length} categories`);
      } catch (error) {
        logger.warn('Failed to categorize events', error);
      }
    }

    // Build hourly breakdown if requested
    let hourlyBreakdown: HourlyActivity[] | undefined;
    if (params.include_hourly_breakdown) {
      hourlyBreakdown = await this.getHourlyBreakdown(startOfDay, endOfDay);
    }

    return {
      date: dateStr,
      timezone,
      total_active_time_hours: secondsToHours(totalActiveTime),
      total_afk_time_hours: secondsToHours(afkTime),
      top_applications: applications,
      top_websites: websites,
      top_categories: topCategories,
      hourly_breakdown: hourlyBreakdown,
      insights,
    };
  }

  /**
   * Get hourly breakdown of activity
   */
  private async getHourlyBreakdown(
    startOfDay: Date,
    endOfDay: Date
  ): Promise<HourlyActivity[]> {
    const hourly: HourlyActivity[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(startOfDay);
      hourStart.setHours(hour, 0, 0, 0);

      const hourEnd = new Date(startOfDay);
      hourEnd.setHours(hour, 59, 59, 999);

      // Skip future hours
      if (hourStart > endOfDay) break;

      try {
        const activityData = await this.unifiedService.getActivity({
          time_period: 'custom',
          custom_start: hourStart.toISOString(),
          custom_end: hourEnd.toISOString(),
          top_n: 1,
          response_format: 'concise',
        });

        hourly.push({
          hour,
          active_seconds: activityData.total_time_seconds,
          top_app: activityData.activities[0]?.app,
        });
      } catch (error) {
        hourly.push({
          hour,
          active_seconds: 0,
        });
      }
    }

    return hourly;
  }

  /**
   * Generate insights from daily data
   */
  private generateInsights(
    apps: Array<{ name: string; duration_hours: number; percentage: number }>,
    websites: Array<{ domain: string; duration_hours: number; percentage: number }>,
    totalActiveSeconds: number
  ): string[] {
    const insights: string[] = [];

    // Total active time insight
    const activeHours = secondsToHours(totalActiveSeconds);
    if (activeHours > 8) {
      insights.push(`High activity day with ${activeHours} hours of active time`);
    } else if (activeHours < 2) {
      insights.push(`Low activity day with only ${activeHours} hours of active time`);
    } else {
      insights.push(`${activeHours} hours of active time recorded`);
    }

    // Top app insight
    if (apps.length > 0) {
      const topApp = apps[0];
      insights.push(
        `Most used application: ${topApp.name} (${topApp.duration_hours}h, ${topApp.percentage}%)`
      );
    }

    // Top website insight
    if (websites.length > 0) {
      const topSite = websites[0];
      insights.push(
        `Most visited website: ${topSite.domain} (${topSite.duration_hours}h, ${topSite.percentage}%)`
      );
    }

    // Diversity insight
    if (apps.length >= 5) {
      insights.push(`Used ${apps.length}+ different applications`);
    }

    return insights;
  }

  /**
   * Format daily summary for concise output
   */
  formatConcise(summary: DailySummary): string {
    return formatDailySummaryConcise(summary);
  }
}

