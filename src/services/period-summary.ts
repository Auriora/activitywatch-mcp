/**
 * Service for period activity summaries (daily, weekly, monthly, rolling periods)
 */

import { UnifiedActivityService } from './unified-activity.js';
import { QueryService } from './query.js';
import { AfkActivityService, AfkPeriod } from './afk-activity.js';
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
  AWEvent,
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
import { getStringProperty } from '../utils/type-guards.js';

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

    // Prefetch AFK summary once for the entire period
    const afkSummary = await this.resolveAfkSummary(start, end);

    const detailLevel = params.detail_level || this.getDefaultDetailLevel(params.period_type);
    let windowEvents: readonly AWEvent[] = [];
    let browserEventsCache: readonly AWEvent[] | null = null;

    if (detailLevel !== 'none') {
      const windowEventsResult = await this.queryService.getWindowEventsFiltered(start, end);
      windowEvents = windowEventsResult.events;
    }

    const loadBrowserEvents = async (): Promise<readonly AWEvent[]> => {
      if (browserEventsCache !== null) {
        return browserEventsCache;
      }
      try {
        const browserEventsResult = await this.queryService.getBrowserEventsFiltered(start, end);
        browserEventsCache = browserEventsResult.events;
      } catch (error) {
        logger.debug('Browser events unavailable for period breakdown', error);
        browserEventsCache = [];
      }
      return browserEventsCache;
    };

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

    const afkTime = afkSummary.totalAfkSeconds;
    if (afkSummary.totalActiveSeconds > 0) {
      focusSeconds = afkSummary.totalActiveSeconds;
      totalActiveTime = focusSeconds + meetingOnlySeconds;
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
    let hourlyBreakdown: HourlyActivity[] | undefined;
    let dailyBreakdown: DailyActivity[] | undefined;
    let weeklyBreakdown: WeeklyActivity[] | undefined;

    if (detailLevel === 'hourly') {
      hourlyBreakdown = await this.getHourlyBreakdown(start, end, windowEvents);
    } else if (detailLevel === 'daily') {
      const browserEvents = await loadBrowserEvents();
      dailyBreakdown = await this.getDailyBreakdown(start, end, offsetMinutes, windowEvents, browserEvents, afkSummary.periods);
    } else if (detailLevel === 'weekly') {
      const browserEvents = await loadBrowserEvents();
      weeklyBreakdown = await this.getWeeklyBreakdown(start, end, windowEvents, browserEvents, afkSummary.periods);
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
  private async getHourlyBreakdown(
    start: Date,
    end: Date,
    windowEvents: readonly AWEvent[]
  ): Promise<HourlyActivity[]> {
    const slices = this.buildHourlySlices(start, end);
    if (slices.length === 0) return [];

    const aggregations = this.accumulateEventDurations(
      windowEvents,
      slices,
      event => getStringProperty(event.data, 'app')
    );

    return slices.map((slice, index) => ({
      hour: slice.hour,
      active_seconds: Math.round(aggregations[index].total),
      top_app: this.getTopKey(aggregations[index].byKey),
    }));
  }

  /**
   * Get daily breakdown of activity
   */
  private async getDailyBreakdown(
    start: Date,
    end: Date,
    offsetMinutes: number,
    windowEvents: readonly AWEvent[],
    browserEvents: readonly AWEvent[],
    afkPeriods: readonly AfkPeriod[]
  ): Promise<DailyActivity[]> {
    const slices = this.buildDailySlices(start, end, offsetMinutes);
    if (slices.length === 0) return [];

    const windowAggregations = this.accumulateEventDurations(
      windowEvents,
      slices,
      event => getStringProperty(event.data, 'app')
    );

    const browserAggregations = this.accumulateEventDurations(
      browserEvents,
      slices,
      event => this.extractBrowserDomain(event)
    );

    const afkDurations = this.computeAfkDurations(afkPeriods, slices);

    return slices.map((slice, index) => ({
      date: formatDate(slice.date),
      active_seconds: Math.round(windowAggregations[index].total),
      afk_seconds: Math.round(afkDurations[index]),
      top_app: this.getTopKey(windowAggregations[index].byKey),
      top_website: this.getTopKey(browserAggregations[index].byKey),
    }));
  }

  /**
   * Get weekly breakdown of activity
   */
  private async getWeeklyBreakdown(
    start: Date,
    end: Date,
    windowEvents: readonly AWEvent[],
    browserEvents: readonly AWEvent[],
    afkPeriods: readonly AfkPeriod[]
  ): Promise<WeeklyActivity[]> {
    const slices = this.buildWeeklySlices(start, end);
    if (slices.length === 0) return [];

    const windowAggregations = this.accumulateEventDurations(
      windowEvents,
      slices,
      event => getStringProperty(event.data, 'app')
    );

    const browserAggregations = this.accumulateEventDurations(
      browserEvents,
      slices,
      event => this.extractBrowserDomain(event)
    );

    const afkDurations = this.computeAfkDurations(afkPeriods, slices);

    return slices.map((slice, index) => ({
      week_start: formatDate(slice.weekStart),
      week_end: formatDate(slice.weekEnd),
      active_seconds: Math.round(windowAggregations[index].total),
      afk_seconds: Math.round(afkDurations[index]),
      top_app: this.getTopKey(windowAggregations[index].byKey),
      top_website: this.getTopKey(browserAggregations[index].byKey),
    }));
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

  private async resolveAfkSummary(
    start: Date,
    end: Date
  ): Promise<ResolvedAfkSummary> {
    const candidate = (this.afkService as unknown as {
      getAfkActivity?: (start: Date, end: Date) => Promise<{
        total_afk_seconds: number;
        total_active_seconds: number;
        afk_periods: AfkPeriod[];
      }>;
    }).getAfkActivity;

    if (typeof candidate === 'function') {
      try {
        const summary = await candidate.call(this.afkService, start, end);
        return {
          totalAfkSeconds: summary.total_afk_seconds,
          totalActiveSeconds: summary.total_active_seconds,
          periods: summary.afk_periods,
        };
      } catch (error) {
        logger.debug('AFK activity summary unavailable, falling back to stats', error);
      }
    }

    try {
      const stats = await this.afkService.getAfkStats(start, end);
      return {
        totalAfkSeconds: stats.afk_seconds,
        totalActiveSeconds: stats.active_seconds,
        periods: [],
      };
    } catch (error) {
      logger.debug('AFK stats unavailable, defaulting to zero AFK time', error);
      return {
        totalAfkSeconds: 0,
        totalActiveSeconds: 0,
        periods: [],
      };
    }
  }

  private buildHourlySlices(
    start: Date,
    end: Date
  ): Array<{ startMs: number; endMs: number; hour: number }> {
    const slices: Array<{ startMs: number; endMs: number; hour: number }> = [];
    const hourMs = 60 * 60 * 1000;
    const totalMs = end.getTime() - start.getTime();
    if (totalMs <= 0) {
      return slices;
    }

    const totalHours = Math.min(24, Math.ceil(totalMs / hourMs));
    for (let i = 0; i < totalHours; i++) {
      const sliceStartMs = start.getTime() + i * hourMs;
      const sliceEndMs = Math.min(sliceStartMs + hourMs, end.getTime());
      slices.push({
        startMs: sliceStartMs,
        endMs: sliceEndMs,
        hour: (start.getHours() + i) % 24,
      });
    }

    return slices;
  }

  private buildDailySlices(
    start: Date,
    end: Date,
    offsetMinutes: number
  ): Array<{ startMs: number; endMs: number; date: Date }> {
    const days = getDaysBetween(start, end);
    const slices: Array<{ startMs: number; endMs: number; date: Date }> = [];

    for (const day of days) {
      const dayStart = getStartOfDayInTimezone(day, offsetMinutes);
      const dayEnd = getEndOfDayInTimezone(day, offsetMinutes);
      const sliceStartMs = Math.max(dayStart.getTime(), start.getTime());
      const sliceEndMs = Math.min(dayEnd.getTime(), end.getTime());

      if (sliceEndMs <= sliceStartMs) {
        continue;
      }

      slices.push({
        startMs: sliceStartMs,
        endMs: sliceEndMs,
        date: day,
      });
    }

    return slices;
  }

  private buildWeeklySlices(
    start: Date,
    end: Date
  ): Array<{ startMs: number; endMs: number; weekStart: Date; weekEnd: Date }> {
    const weeks = getWeeksBetween(start, end);
    const slices: Array<{ startMs: number; endMs: number; weekStart: Date; weekEnd: Date }> = [];

    for (const week of weeks) {
      const sliceStartMs = Math.max(week.start.getTime(), start.getTime());
      const sliceEndMs = Math.min(week.end.getTime(), end.getTime());

      if (sliceEndMs <= sliceStartMs) {
        continue;
      }

      slices.push({
        startMs: sliceStartMs,
        endMs: sliceEndMs,
        weekStart: week.start,
        weekEnd: week.end,
      });
    }

    return slices;
  }

  private accumulateEventDurations<TSlice extends { startMs: number; endMs: number }>(
    events: readonly AWEvent[],
    slices: readonly TSlice[],
    keySelector?: (event: AWEvent) => string | null
  ): Array<{ total: number; byKey?: Map<string, number> }> {
    const results = slices.map(() => ({
      total: 0,
      byKey: keySelector ? new Map<string, number>() : undefined,
    }));

    if (events.length === 0 || slices.length === 0) {
      return results;
    }

    for (const event of events) {
      const eventStartMs = new Date(event.timestamp).getTime();
      if (!Number.isFinite(eventStartMs)) {
        continue;
      }
      const durationSeconds = event.duration ?? 0;
      const eventEndMs = eventStartMs + durationSeconds * 1000;
      if (!Number.isFinite(eventEndMs) || eventEndMs <= eventStartMs) {
        continue;
      }

      for (let i = 0; i < slices.length; i++) {
        const overlapSeconds = this.computeOverlapSeconds(
          eventStartMs,
          eventEndMs,
          slices[i].startMs,
          slices[i].endMs
        );
        if (overlapSeconds <= 0) {
          continue;
        }

        results[i].total += overlapSeconds;
        if (results[i].byKey && keySelector) {
          const key = keySelector(event);
          if (key) {
            const current = results[i].byKey!.get(key) ?? 0;
            results[i].byKey!.set(key, current + overlapSeconds);
          }
        }
      }
    }

    return results;
  }

  private computeAfkDurations<TSlice extends { startMs: number; endMs: number }>(
    afkPeriods: readonly AfkPeriod[],
    slices: readonly TSlice[]
  ): number[] {
    const totals = slices.map(() => 0);
    if (afkPeriods.length === 0 || slices.length === 0) {
      return totals;
    }

    for (const period of afkPeriods) {
      if (period.status !== 'afk') {
        continue;
      }
      const periodStartMs = new Date(period.start).getTime();
      const periodEndMs = new Date(period.end).getTime();
      if (!Number.isFinite(periodStartMs) || !Number.isFinite(periodEndMs) || periodEndMs <= periodStartMs) {
        continue;
      }

      for (let i = 0; i < slices.length; i++) {
        const overlapSeconds = this.computeOverlapSeconds(
          periodStartMs,
          periodEndMs,
          slices[i].startMs,
          slices[i].endMs
        );
        if (overlapSeconds > 0) {
          totals[i] += overlapSeconds;
        }
      }
    }

    return totals;
  }

  private computeOverlapSeconds(
    startMs: number,
    endMs: number,
    sliceStartMs: number,
    sliceEndMs: number
  ): number {
    const overlapStart = Math.max(startMs, sliceStartMs);
    const overlapEnd = Math.min(endMs, sliceEndMs);
    if (overlapEnd <= overlapStart) {
      return 0;
    }
    return (overlapEnd - overlapStart) / 1000;
  }

  private getTopKey(map?: Map<string, number>): string | undefined {
    if (!map || map.size === 0) {
      return undefined;
    }

    let topKey: string | undefined;
    let topValue = 0;

    for (const [key, value] of map.entries()) {
      if (value > topValue) {
        topValue = value;
        topKey = key;
      }
    }

    return topKey;
  }

  private extractBrowserDomain(event: AWEvent): string | null {
    const explicitDomain = getStringProperty(event.data, 'domain');
    if (explicitDomain) {
      return explicitDomain.toLowerCase();
    }

    const url = getStringProperty(event.data, 'url');
    if (!url) {
      return null;
    }

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
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

interface ResolvedAfkSummary {
  totalAfkSeconds: number;
  totalActiveSeconds: number;
  periods: AfkPeriod[];
}
