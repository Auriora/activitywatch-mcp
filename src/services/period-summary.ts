/**
 * Service for period activity summaries (daily, weekly, monthly, rolling periods)
 */

import { UnifiedActivityService } from './unified-activity.js';
import { QueryService } from './query.js';
import { AfkActivityService } from './afk-activity.js';
import { CategoryService } from './category.js';
import {
  PeriodSummary, 
  PeriodSummaryParams, 
  HourlyActivity,
  DailyActivity,
  WeeklyActivity,
  AppUsage,
  WebUsage,
  CategoryUsage,
  CalendarEventSummary,
} from '../types.js';
import {
  formatDate,
  secondsToHours,
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  getStartOfWeekInTimezone,
  getEndOfWeekInTimezone,
  getStartOfMonthInTimezone,
  getEndOfMonthInTimezone,
  convertToTimezone,
  getDaysBetween,
  getWeeksBetween,
} from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { getTimezoneOffset } from '../config/user-preferences.js';
import { CalendarService } from './calendar.js';

export class PeriodSummaryService {
  constructor(
    private unifiedService: UnifiedActivityService,
    private queryService: QueryService,
    private afkService: AfkActivityService,
    private categoryService?: CategoryService,
    private calendarService?: CalendarService
  ) {}

  /**
   * Get comprehensive period summary
   */
  async getPeriodSummary(params: PeriodSummaryParams): Promise<PeriodSummary> {
    // Get timezone info
    const { timezone, offsetMinutes } = getTimezoneOffset(params.timezone);

    // Parse date (default to today in the specified timezone)
    let dateStr: string;
    if (params.date) {
      dateStr = params.date;
    } else {
      const nowInTimezone = convertToTimezone(new Date(), offsetMinutes);
      dateStr = formatDate(nowInTimezone);
    }

    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
    }

    // Calculate period boundaries based on period type
    const { start, end } = this.getPeriodBoundaries(
      params.period_type,
      date,
      offsetMinutes
    );

    logger.debug('Getting period summary', {
      periodType: params.period_type,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone,
    });

    // Get unified activity for the entire period
    const unifiedActivity = await this.unifiedService.getActivity({
      time_period: 'custom',
      custom_start: start.toISOString(),
      custom_end: end.toISOString(),
      top_n: 20,
      response_format: 'detailed',
    });

    // Extract top applications and websites
    const applications = unifiedActivity.activities
      .map(a => ({
        name: a.app,
        duration_seconds: a.duration_seconds,
        duration_hours: a.duration_hours,
        percentage: a.percentage,
      }))
      .slice(0, 5);

    const websites = unifiedActivity.activities
      .filter(a => a.browser?.domain)
      .map(a => ({
        domain: a.browser!.domain,
        duration_seconds: a.duration_seconds,
        duration_hours: a.duration_hours,
        percentage: a.percentage,
      }))
      .slice(0, 5);

    const calendarSummary = unifiedActivity.calendar_summary;
    let focusSeconds = calendarSummary?.focus_seconds ?? unifiedActivity.total_time_seconds;
    const meetingSeconds = calendarSummary?.meeting_seconds ?? 0;
    const overlapSeconds = calendarSummary?.overlap_seconds ?? 0;
    const meetingOnlySeconds = calendarSummary?.meeting_only_seconds ?? Math.max(0, meetingSeconds - overlapSeconds);
    let totalActiveTime = calendarSummary?.union_seconds ?? unifiedActivity.total_time_seconds;

    // Get AFK stats
    let afkTime: number;

    try {
      const afkStats = await this.afkService.getAfkStats(start, end);
      afkTime = afkStats.afk_seconds;
      if (afkStats.active_seconds > 0) {
        focusSeconds = afkStats.active_seconds;
        totalActiveTime = focusSeconds + meetingOnlySeconds;
      }
    } catch (error) {
      logger.debug('AFK tracking not available');
      const totalPeriodSeconds = (end.getTime() - start.getTime()) / 1000;
      afkTime = Math.max(0, totalPeriodSeconds - totalActiveTime);
    }

    // Get category breakdown if available
    let topCategories: CategoryUsage[] | undefined;
    if (this.categoryService && this.categoryService.hasCategories()) {
      try {
        const allEvents = await this.queryService.getAllEventsFiltered(start, end);
        topCategories = this.categoryService.categorizeEvents(allEvents).slice(0, 5);
      } catch (error) {
        logger.warn('Failed to categorize events', error);
      }
    }

    // Fetch notable calendar events (calendar ORs with activity so always included)
    let notableCalendarEvents: CalendarEventSummary[] | undefined;
    if (this.calendarService) {
      try {
        const calendarResult = await this.calendarService.getEvents({
          time_period: 'custom',
          custom_start: start.toISOString(),
          custom_end: end.toISOString(),
          include_cancelled: false,
          limit: 5,
        });
        notableCalendarEvents = this.calendarService.summarizeEvents(calendarResult.events, 5);
      } catch (error) {
        logger.debug('No calendar events available for summary', error);
      }
    }

    // Generate breakdowns based on detail level
    const detailLevel = params.detail_level || this.getDefaultDetailLevel(params.period_type);
    let hourlyBreakdown: HourlyActivity[] | undefined;
    let dailyBreakdown: DailyActivity[] | undefined;
    let weeklyBreakdown: WeeklyActivity[] | undefined;

    if (detailLevel === 'hourly') {
      hourlyBreakdown = await this.getHourlyBreakdown(start, end);
    } else if (detailLevel === 'daily') {
      dailyBreakdown = await this.getDailyBreakdown(start, end, offsetMinutes);
    } else if (detailLevel === 'weekly') {
      weeklyBreakdown = await this.getWeeklyBreakdown(start, end);
    }

    // Generate insights
    const insights = this.generateInsights(
      params.period_type,
      applications,
      websites,
      totalActiveTime,
      start,
      end
    );

    const focusTimeHours = secondsToHours(focusSeconds);
    const meetingTimeHours = secondsToHours(meetingSeconds);

    return {
      period_type: params.period_type,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      timezone,
      total_active_time_hours: secondsToHours(totalActiveTime),
      total_afk_time_hours: secondsToHours(afkTime),
      focus_time_hours: focusTimeHours,
      meeting_time_hours: meetingTimeHours,
      top_applications: applications,
      top_websites: websites,
      top_categories: topCategories,
      notable_calendar_events: notableCalendarEvents,
      hourly_breakdown: hourlyBreakdown,
      daily_breakdown: dailyBreakdown,
      weekly_breakdown: weeklyBreakdown,
      insights,
    };
  }

  /**
   * Get period boundaries based on period type
   */
  private getPeriodBoundaries(
    periodType: string,
    date: Date,
    offsetMinutes: number
  ): { start: Date; end: Date } {
    const now = new Date();

    switch (periodType) {
      case 'daily':
        return {
          start: getStartOfDayInTimezone(date, offsetMinutes),
          end: getEndOfDayInTimezone(date, offsetMinutes),
        };

      case 'weekly':
        return {
          start: getStartOfWeekInTimezone(date, offsetMinutes),
          end: getEndOfWeekInTimezone(date, offsetMinutes),
        };

      case 'monthly':
        return {
          start: getStartOfMonthInTimezone(date, offsetMinutes),
          end: getEndOfMonthInTimezone(date, offsetMinutes),
        };

      case 'last_24_hours': {
        const end = now;
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return { start, end };
      }

      case 'last_7_days': {
        const end = now;
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start, end };
      }

      case 'last_30_days': {
        const end = now;
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start, end };
      }

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }
  }

  /**
   * Get default detail level for a period type
   */
  private getDefaultDetailLevel(periodType: string): 'hourly' | 'daily' | 'weekly' | 'none' {
    switch (periodType) {
      case 'daily':
      case 'last_24_hours':
        return 'hourly';
      case 'weekly':
      case 'last_7_days':
        return 'daily';
      case 'monthly':
      case 'last_30_days':
        return 'daily';
      default:
        return 'none';
    }
  }

  /**
   * Get hourly breakdown of activity
   */
  private async getHourlyBreakdown(start: Date, end: Date): Promise<HourlyActivity[]> {
    const hourly: HourlyActivity[] = [];
    const startHour = start.getHours();
    const totalHours = Math.min(24, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60)));

    for (let i = 0; i < totalHours; i++) {
      const hourStart = new Date(start.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000 - 1);

      if (hourStart > end) break;

      try {
        const activityData = await this.unifiedService.getActivity({
          time_period: 'custom',
          custom_start: hourStart.toISOString(),
          custom_end: (hourEnd > end ? end : hourEnd).toISOString(),
          top_n: 1,
          response_format: 'concise',
        });

        hourly.push({
          hour: (startHour + i) % 24,
          active_seconds: activityData.total_time_seconds,
          top_app: activityData.activities[0]?.app,
        });
      } catch (error) {
        hourly.push({
          hour: (startHour + i) % 24,
          active_seconds: 0,
        });
      }
    }

    return hourly;
  }

  /**
   * Get daily breakdown of activity
   */
  private async getDailyBreakdown(
    start: Date,
    end: Date,
    offsetMinutes: number
  ): Promise<DailyActivity[]> {
    const days = getDaysBetween(start, end);
    const daily: DailyActivity[] = [];

    for (const day of days) {
      const dayStart = getStartOfDayInTimezone(day, offsetMinutes);
      const dayEnd = getEndOfDayInTimezone(day, offsetMinutes);

      // Don't go beyond the period end
      const actualEnd = dayEnd > end ? end : dayEnd;

      try {
        const activityData = await this.unifiedService.getActivity({
          time_period: 'custom',
          custom_start: dayStart.toISOString(),
          custom_end: actualEnd.toISOString(),
          top_n: 5,
          response_format: 'detailed',
        });

        const afkStats = await this.afkService.getAfkStats(dayStart, actualEnd);

        daily.push({
          date: formatDate(day),
          active_seconds: activityData.total_time_seconds,
          afk_seconds: afkStats.afk_seconds,
          top_app: activityData.activities[0]?.app,
          top_website: activityData.activities.find(a => a.browser?.domain)?.browser?.domain,
        });
      } catch (error) {
        daily.push({
          date: formatDate(day),
          active_seconds: 0,
          afk_seconds: 0,
        });
      }
    }

    return daily;
  }

  /**
   * Get weekly breakdown of activity
   */
  private async getWeeklyBreakdown(start: Date, end: Date): Promise<WeeklyActivity[]> {
    const weeks = getWeeksBetween(start, end);
    const weekly: WeeklyActivity[] = [];

    for (const week of weeks) {
      try {
        const activityData = await this.unifiedService.getActivity({
          time_period: 'custom',
          custom_start: week.start.toISOString(),
          custom_end: week.end.toISOString(),
          top_n: 5,
          response_format: 'detailed',
        });

        const afkStats = await this.afkService.getAfkStats(week.start, week.end);

        weekly.push({
          week_start: formatDate(week.start),
          week_end: formatDate(week.end),
          active_seconds: activityData.total_time_seconds,
          afk_seconds: afkStats.afk_seconds,
          top_app: activityData.activities[0]?.app,
          top_website: activityData.activities.find(a => a.browser?.domain)?.browser?.domain,
        });
      } catch (error) {
        weekly.push({
          week_start: formatDate(week.start),
          week_end: formatDate(week.end),
          active_seconds: 0,
          afk_seconds: 0,
        });
      }
    }

    return weekly;
  }

  /**
   * Generate insights from period data
   */
  private generateInsights(
    periodType: string,
    apps: AppUsage[],
    websites: WebUsage[],
    totalActiveSeconds: number,
    start: Date,
    end: Date
  ): string[] {
    const insights: string[] = [];
    const activeHours = secondsToHours(totalActiveSeconds);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Period summary
    const periodLabel = this.getPeriodLabel(periodType);
    insights.push(`${periodLabel}: ${activeHours} hours of active time`);

    // Average per day
    if (periodDays > 1) {
      const avgPerDay = activeHours / periodDays;
      insights.push(`Average: ${avgPerDay.toFixed(2)} hours per day`);
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

    // Activity level insight
    if (periodDays > 1) {
      const avgPerDay = activeHours / periodDays;
      if (avgPerDay > 8) {
        insights.push('High activity period with sustained engagement');
      } else if (avgPerDay < 2) {
        insights.push('Low activity period');
      }
    }

    return insights;
  }

  /**
   * Get human-readable period label
   */
  private getPeriodLabel(periodType: string): string {
    switch (periodType) {
      case 'daily':
        return 'Daily summary';
      case 'weekly':
        return 'Weekly summary';
      case 'monthly':
        return 'Monthly summary';
      case 'last_24_hours':
        return 'Last 24 hours';
      case 'last_7_days':
        return 'Last 7 days';
      case 'last_30_days':
        return 'Last 30 days';
      default:
        return 'Period summary';
    }
  }
}
