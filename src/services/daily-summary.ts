/**
 * Service for daily activity summaries
 */

import { ActivityWatchClient } from '../client/activitywatch.js';
import { WindowActivityService } from './window-activity.js';
import { WebActivityService } from './web-activity.js';
import { DailySummary, DailySummaryParams, HourlyActivity } from '../types.js';
import { formatDate, getStartOfDay, getEndOfDay, secondsToHours } from '../utils/time.js';
import { formatDailySummaryConcise } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

export class DailySummaryService {
  constructor(
    private client: ActivityWatchClient,
    private windowService: WindowActivityService,
    private webService: WebActivityService
  ) {}

  /**
   * Get comprehensive daily summary
   */
  async getDailySummary(params: DailySummaryParams): Promise<DailySummary> {
    // Parse date (default to today)
    const dateStr = params.date || formatDate(new Date());
    logger.debug('Getting daily summary', { date: dateStr });

    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      logger.error('Invalid date format', { dateStr });
      throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
    }

    const startOfDay = getStartOfDay(date);
    const endOfDay = getEndOfDay(date);

    // Get window activity
    let windowActivity;
    try {
      windowActivity = await this.windowService.getWindowActivity({
        time_period: 'custom',
        custom_start: startOfDay.toISOString(),
        custom_end: endOfDay.toISOString(),
        top_n: 5,
        response_format: 'concise',
      });
    } catch (error) {
      windowActivity = {
        total_time_seconds: 0,
        applications: [],
        time_range: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
      };
    }

    // Get web activity
    let webActivity;
    try {
      webActivity = await this.webService.getWebActivity({
        time_period: 'custom',
        custom_start: startOfDay.toISOString(),
        custom_end: endOfDay.toISOString(),
        top_n: 5,
        response_format: 'concise',
      });
    } catch (error) {
      webActivity = {
        total_time_seconds: 0,
        websites: [],
        time_range: { start: startOfDay.toISOString(), end: endOfDay.toISOString() },
      };
    }

    // Calculate AFK time (simplified - would need AFK bucket data)
    const totalActiveTime = windowActivity.total_time_seconds;
    const totalDaySeconds = (endOfDay.getTime() - startOfDay.getTime()) / 1000;
    const afkTime = Math.max(0, totalDaySeconds - totalActiveTime);

    // Generate insights
    const insights = this.generateInsights(
      windowActivity.applications,
      webActivity.websites,
      totalActiveTime
    );

    // Build hourly breakdown if requested
    let hourlyBreakdown: HourlyActivity[] | undefined;
    if (params.include_hourly_breakdown) {
      hourlyBreakdown = await this.getHourlyBreakdown(startOfDay, endOfDay);
    }

    return {
      date: dateStr,
      total_active_time_hours: secondsToHours(totalActiveTime),
      total_afk_time_hours: secondsToHours(afkTime),
      top_applications: windowActivity.applications,
      top_websites: webActivity.websites,
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
        const windowData = await this.windowService.getWindowActivity({
          time_period: 'custom',
          custom_start: hourStart.toISOString(),
          custom_end: hourEnd.toISOString(),
          top_n: 1,
          response_format: 'concise',
        });

        hourly.push({
          hour,
          active_seconds: windowData.total_time_seconds,
          top_app: windowData.applications[0]?.name,
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

