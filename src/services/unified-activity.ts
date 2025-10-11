/**
 * Unified Activity Service - Canonical Events Implementation
 * 
 * This service implements ActivityWatch's canonical events approach where:
 * 1. Window events are the base (defines when apps were active)
 * 2. Browser events enrich window data (only when browser window was active)
 * 3. Editor events enrich window data (only when editor window was active)
 * 
 * This ensures accurate activity tracking without double-counting.
 */

import { QueryService } from './query.js';
import { CategoryService } from './category.js';
import { CalendarService } from './calendar.js';
import {
  CanonicalEvent,
  BrowserEnrichment,
  EditorEnrichment,
  AWEvent,
  UnifiedActivityParams,
  CalendarEvent,
  CalendarEnrichment,
  CalendarSummary,
  UnifiedActivityResult
} from '../types.js';
import { getTimeRange } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import {
  parseTitle,
  setTitleParsingConfig,
  hasParsingRules
} from '../utils/configurable-title-parser.js';
import { getTitleParsingConfig } from '../config/app-names.js';
import { mergeIntervals, calculateOverlap, intersectIntervals, Interval } from '../utils/intervals.js';

interface EnrichedEvent {
  app: string;
  title: string;
  duration: number;
  timestamp: string;
  browser?: BrowserEnrichment;
  editor?: EditorEnrichment;
  terminal?: Record<string, any>;
  ide?: Record<string, any>;
  custom?: Record<string, any>;
  category?: string; // Deprecated: kept for backward compatibility
  categories?: string[]; // Array of all matching categories
  calendar?: CalendarEnrichment[];
  meetingOverlapSeconds?: number;
  calendarOnly?: boolean;
}

interface CalendarOverlayStats {
  meetingSeconds: number;
  overlapSeconds: number;
  meetingOnlySeconds: number;
  meetingCount: number;
}

export class UnifiedActivityService {
  constructor(
    private queryService: QueryService,
    private categoryService: CategoryService,
    private calendarService?: CalendarService
  ) {
    // Initialize title parser with config
    const titleParsingConfig = getTitleParsingConfig();
    setTitleParsingConfig(titleParsingConfig);
  }

  /**
   * Get unified activity data with browser/editor enrichment
   */
  async getActivity(params: UnifiedActivityParams): Promise<UnifiedActivityResult> {
    // Parse time range
    const timeRange = getTimeRange(
      params.time_period,
      params.custom_start,
      params.custom_end
    );

    logger.info('Getting unified activity', {
      time_period: params.time_period,
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
    });

    // Get canonical events (window + browser + editor)
    const canonical = await this.queryService.getCanonicalEvents(
      timeRange.start,
      timeRange.end
    );

    logger.debug('Canonical events retrieved', {
      window_events: canonical.window_events.length,
      browser_events: canonical.browser_events.length,
      editor_events: canonical.editor_events.length,
    });

    // Fetch calendar events if service is available
    let calendarEvents: CalendarEvent[] = [];
    if (this.calendarService) {
      try {
        const calendarResult = await this.calendarService.getEvents({
          time_period: 'custom',
          custom_start: timeRange.start.toISOString(),
          custom_end: timeRange.end.toISOString(),
          include_cancelled: false,
          limit: 500,
        });
        calendarEvents = [...calendarResult.events];
        logger.debug('Calendar events retrieved for overlay', {
          calendar_events: calendarEvents.length,
        });
      } catch (error) {
        logger.debug('Calendar overlay unavailable', error);
      }
    }

    // Merge browser and editor data into window events
    const enrichedEvents = this.enrichWindowEvents(
      canonical.window_events,
      canonical.browser_events,
      canonical.editor_events
    );

    const overlay = this.applyCalendarOverlay(enrichedEvents, calendarEvents);

    // Filter by minimum duration (calendar-only events are always retained)
    const minDuration = params.min_duration_seconds ?? 5;
    const filteredWindowEvents = enrichedEvents.filter(e => e.duration >= minDuration);
    const combinedEvents = [...filteredWindowEvents, ...overlay.calendarOnlyEvents];

    logger.debug('Calendar overlay statistics', {
      min_duration: minDuration,
      retained_window_events: filteredWindowEvents.length,
      calendar_only_events: overlay.calendarOnlyEvents.length,
      meeting_seconds: overlay.stats.meetingSeconds,
      meeting_overlap_seconds: overlay.stats.overlapSeconds,
    });

    // Exclude system apps if requested (before grouping)
    let eventsToGroup = combinedEvents;
    if (params.exclude_system_apps) {
      const systemApps = ['Finder', 'Dock', 'Window Server', 'explorer.exe', 'dwm.exe'];
      eventsToGroup = combinedEvents.filter(e => !systemApps.includes(e.app));
    }

    // Always apply categorization
    const categorizedEvents = this.applyCategoriestoEvents(eventsToGroup);

    // Group and aggregate (handle both single and multi-level grouping)
    const groupBy = params.group_by ?? 'application';
    const activities = Array.isArray(groupBy)
      ? this.groupEventsMultiLevel(categorizedEvents, groupBy)
      : this.groupEvents(categorizedEvents, groupBy);

    // Sort by duration and limit
    const topN = params.top_n ?? 10;
    const sorted = activities
      .sort((a, b) => b.duration_seconds - a.duration_seconds)
      .slice(0, topN);

    const calendarSummary = this.buildCalendarSummary(
      canonical.total_duration_seconds,
      overlay.stats
    );

    // Calculate percentages using union time (focus + meeting-only)
    const totalTime = calendarSummary.union_seconds;
    const withPercentages = sorted.map(activity => ({
      ...activity,
      percentage: totalTime > 0 ? (activity.duration_seconds / totalTime) * 100 : 0,
    }));

    logger.info('Unified activity prepared', {
      focus_seconds: calendarSummary.focus_seconds,
      meeting_seconds: calendarSummary.meeting_seconds,
      meeting_only_seconds: calendarSummary.meeting_only_seconds,
      overlap_seconds: calendarSummary.overlap_seconds,
      union_seconds: calendarSummary.union_seconds,
      meeting_count: calendarSummary.meeting_count,
    });

    return {
      total_time_seconds: totalTime,
      activities: withPercentages,
      time_range: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      calendar_summary: calendarSummary,
    };
  }

  /**
   * Enrich window events with browser and editor data
   */
  private enrichWindowEvents(
    windowEvents: readonly AWEvent[],
    browserEvents: readonly AWEvent[],
    editorEvents: readonly AWEvent[]
  ): EnrichedEvent[] {
    const enriched: EnrichedEvent[] = [];

    // Enrich each window event
    for (const windowEvent of windowEvents) {
      const app = windowEvent.data.app as string || 'Unknown';
      const title = windowEvent.data.title as string || '';

      const windowStart = new Date(windowEvent.timestamp).getTime();
      const windowEnd = windowStart + (windowEvent.duration * 1000);

      // Find overlapping browser events (always collect, display controlled by response_format)
      let browserEnrichment: BrowserEnrichment | undefined;
      for (const browserEvent of browserEvents) {
        const browserStart = new Date(browserEvent.timestamp).getTime();
        const browserEnd = browserStart + (browserEvent.duration * 1000);

        // Check if events overlap
        if (this.eventsOverlap(windowStart, windowEnd, browserStart, browserEnd)) {
          browserEnrichment = this.extractBrowserData(browserEvent);
          break; // Use first matching browser event
        }
      }

      // Find overlapping editor events (always collect, display controlled by response_format)
      let editorEnrichment: EditorEnrichment | undefined;
      for (const editorEvent of editorEvents) {
        const editorStart = new Date(editorEvent.timestamp).getTime();
        const editorEnd = editorStart + (editorEvent.duration * 1000);

        // Check if events overlap
        if (this.eventsOverlap(windowStart, windowEnd, editorStart, editorEnd)) {
          editorEnrichment = this.extractEditorData(editorEvent);
          break; // Use first matching editor event
        }
      }

      // Parse title using configurable rules
      // Only parse if there are rules defined for this app
      let terminalInfo: Record<string, any> | undefined;
      let ideInfo: Record<string, any> | undefined;
      let customInfo: Record<string, any> | undefined;

      if (hasParsingRules(app)) {
        const parsed = parseTitle(app, title);

        if (parsed) {
          // Only parse IDE titles if editor enrichment is not available
          // (editor bucket provides better data)
          if (parsed.enrichmentType === 'terminal') {
            terminalInfo = parsed.data;
          } else if (parsed.enrichmentType === 'ide' && !editorEnrichment) {
            ideInfo = parsed.data;
          } else if (parsed.enrichmentType === 'custom') {
            customInfo = parsed.data;
          }
        }
      }

      enriched.push({
        app,
        title,
        duration: windowEvent.duration,
        timestamp: windowEvent.timestamp,
        browser: browserEnrichment,
        editor: editorEnrichment,
        terminal: terminalInfo,
        ide: ideInfo,
        custom: customInfo,
      });
    }

    return enriched;
  }

  /**
   * Check if two time periods overlap
   */
  private eventsOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): boolean {
    // Events overlap if one starts before the other ends
    return start1 < end2 && start2 < end1;
  }

  /**
   * Extract browser data from event
   */
  private extractBrowserData(event: AWEvent): BrowserEnrichment | undefined {
    const url = event.data.url as string;
    if (!url) return undefined;

    // Extract domain from URL
    let domain: string;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch {
      domain = url;
    }

    return {
      url,
      domain,
      title: event.data.title as string,
      audible: event.data.audible as boolean,
      incognito: event.data.incognito as boolean,
      tab_count: event.data.tabCount as number,
    };
  }

  /**
   * Extract editor data from event
   */
  private extractEditorData(event: AWEvent): EditorEnrichment | undefined {
    const file = event.data.file as string;
    if (!file) return undefined;

    return {
      file,
      project: event.data.project as string,
      language: event.data.language as string,
      git: event.data.branch ? {
        branch: event.data.branch as string,
        commit: event.data.commit as string,
        repository: event.data.repository as string,
      } : undefined,
    };
  }

  /**
   * Overlay calendar data onto enriched events and create calendar-only segments
   */
  private applyCalendarOverlay(
    events: EnrichedEvent[],
    calendarEvents: readonly CalendarEvent[]
  ): {
    events: EnrichedEvent[];
    calendarOnlyEvents: EnrichedEvent[];
    stats: CalendarOverlayStats;
  } {
    if (!calendarEvents || calendarEvents.length === 0) {
      return {
        events,
        calendarOnlyEvents: [],
        stats: {
          meetingSeconds: 0,
          overlapSeconds: 0,
          meetingOnlySeconds: 0,
          meetingCount: 0,
        },
      };
    }

    const calendarOnlyEvents: EnrichedEvent[] = [];
    let totalMeetingSeconds = 0;
    let totalOverlapSeconds = 0;
    let totalMeetingOnlySeconds = 0;
    let meetingCount = 0;

    const eventIntervals = events.map(event => {
      const start = new Date(event.timestamp).getTime();
      const end = start + (event.duration * 1000);
      return {
        event,
        start,
        end,
      };
    }).filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start);

    const mergedWindowIntervals: Interval[] = mergeIntervals(
      eventIntervals.map(interval => ({
        start: interval.start,
        end: interval.end,
      }))
    );

    for (const meeting of calendarEvents) {
      const meetingStart = new Date(meeting.start).getTime();
      const meetingEnd = new Date(meeting.end).getTime();

      if (!Number.isFinite(meetingStart) || !Number.isFinite(meetingEnd) || meetingEnd <= meetingStart) {
        continue;
      }

      const meetingDurationSeconds = Math.max(0, (meetingEnd - meetingStart) / 1000);
      if (meetingDurationSeconds === 0) {
        continue;
      }

      meetingCount += 1;
      totalMeetingSeconds += meetingDurationSeconds;

      const overlapMs = calculateOverlap({ start: meetingStart, end: meetingEnd }, mergedWindowIntervals);
      const overlapSeconds = Math.min(meetingDurationSeconds, overlapMs / 1000);
      totalOverlapSeconds += overlapSeconds;

      // Attach calendar metadata to overlapping window events
      for (const interval of eventIntervals) {
        const intersection = intersectIntervals(
          { start: interval.start, end: interval.end },
          { start: meetingStart, end: meetingEnd }
        );

        if (!intersection) {
          continue;
        }

        const overlapSecondsForEvent = (intersection.end - intersection.start) / 1000;
        if (overlapSecondsForEvent <= 0) {
          continue;
        }

        const enrichment: CalendarEnrichment = {
          meeting_id: meeting.id,
          summary: meeting.summary,
          start: meeting.start,
          end: meeting.end,
          status: meeting.status,
          all_day: meeting.all_day,
          location: meeting.location,
          calendar: meeting.calendar,
          overlap_seconds: overlapSecondsForEvent,
        };

        if (interval.event.calendar) {
          interval.event.calendar = [...interval.event.calendar, enrichment];
        } else {
          interval.event.calendar = [enrichment];
        }

        interval.event.meetingOverlapSeconds = (interval.event.meetingOverlapSeconds ?? 0) + overlapSecondsForEvent;
      }

      const meetingOnlySeconds = Math.max(0, meetingDurationSeconds - overlapSeconds);
      if (meetingOnlySeconds > 0) {
        totalMeetingOnlySeconds += meetingOnlySeconds;

        const meetingEnrichment: CalendarEnrichment = {
          meeting_id: meeting.id,
          summary: meeting.summary,
          start: meeting.start,
          end: meeting.end,
          status: meeting.status,
          all_day: meeting.all_day,
          location: meeting.location,
          calendar: meeting.calendar,
          overlap_seconds: 0,
          meeting_only_seconds: meetingOnlySeconds,
        };

        calendarOnlyEvents.push({
          app: meeting.calendar || 'Calendar',
          title: meeting.summary,
          duration: meetingOnlySeconds,
          timestamp: meeting.start,
          calendar: [meetingEnrichment],
          calendarOnly: true,
        });
      }
    }

    return {
      events,
      calendarOnlyEvents,
      stats: {
        meetingSeconds: totalMeetingSeconds,
        overlapSeconds: totalOverlapSeconds,
        meetingOnlySeconds: totalMeetingOnlySeconds,
        meetingCount,
      },
    };
  }

  private buildCalendarSummary(focusSeconds: number, stats: CalendarOverlayStats): CalendarSummary {
    const meetingSeconds = stats.meetingSeconds;
    const overlapSeconds = Math.min(meetingSeconds, stats.overlapSeconds);
    const meetingOnlySeconds = Math.max(
      0,
      stats.meetingOnlySeconds > 0 ? stats.meetingOnlySeconds : meetingSeconds - overlapSeconds
    );
    const unionSeconds = focusSeconds + meetingOnlySeconds;

    return {
      focus_seconds: focusSeconds,
      meeting_seconds: meetingSeconds,
      meeting_only_seconds: meetingOnlySeconds,
      overlap_seconds: overlapSeconds,
      union_seconds: unionSeconds,
      meeting_count: stats.meetingCount,
    };
  }

  private aggregateCalendarData(events: EnrichedEvent[]): {
    calendar?: CalendarEnrichment[];
    meetingOverlapSeconds?: number;
    calendarOnly: boolean;
  } {
    let meetingOverlapSeconds = 0;
    const calendarMap = new Map<string, CalendarEnrichment>();

    for (const event of events) {
      if (event.meetingOverlapSeconds) {
        meetingOverlapSeconds += event.meetingOverlapSeconds;
      }

      if (!event.calendar) {
        continue;
      }

      for (const entry of event.calendar) {
        const existing = calendarMap.get(entry.meeting_id);
        if (existing) {
          const overlapSeconds = existing.overlap_seconds + entry.overlap_seconds;
          const meetingOnlySeconds =
            (existing.meeting_only_seconds ?? 0) + (entry.meeting_only_seconds ?? 0);

          calendarMap.set(entry.meeting_id, {
            ...existing,
            overlap_seconds: overlapSeconds,
            meeting_only_seconds: meetingOnlySeconds > 0 ? meetingOnlySeconds : undefined,
          });
        } else {
          calendarMap.set(entry.meeting_id, { ...entry });
        }
      }
    }

    const calendar = calendarMap.size > 0 ? Array.from(calendarMap.values()) : undefined;
    const calendarOnly = events.every(e => e.calendarOnly === true);

    return {
      calendar,
      meetingOverlapSeconds: meetingOverlapSeconds > 0 ? meetingOverlapSeconds : undefined,
      calendarOnly,
    };
  }

  /**
   * Group events by application, title, category, domain, project, hour, language, or category_top_level
   */
  private groupEvents(
    events: EnrichedEvent[],
    groupBy: 'application' | 'title' | 'category' | 'domain' | 'project' | 'hour' | 'category_top_level' | 'language'
  ): CanonicalEvent[] {
    const groups = new Map<string, EnrichedEvent[]>();

    // Group events
    for (const event of events) {
      if (groupBy === 'category') {
        // For category grouping, an event can appear in multiple groups
        const categories = event.categories || [];
        if (categories.length === 0) {
          // Uncategorized events go into a special group
          const key = 'Uncategorized';
          const existing = groups.get(key) || [];
          existing.push(event);
          groups.set(key, existing);
        } else {
          // Add event to each category it matches
          for (const category of categories) {
            const existing = groups.get(category) || [];
            existing.push(event);
            groups.set(category, existing);
          }
        }
      } else if (groupBy === 'category_top_level') {
        // Group by top-level category (first part of hierarchy)
        const categories = event.categories || [];
        if (categories.length === 0) {
          const key = 'Uncategorized';
          const existing = groups.get(key) || [];
          existing.push(event);
          groups.set(key, existing);
        } else {
          // Extract top-level from each category and add to those groups
          const topLevelCategories = new Set<string>();
          for (const category of categories) {
            const topLevel = category.split(' > ')[0];
            topLevelCategories.add(topLevel);
          }
          for (const topLevel of topLevelCategories) {
            const existing = groups.get(topLevel) || [];
            existing.push(event);
            groups.set(topLevel, existing);
          }
        }
      } else if (groupBy === 'domain') {
        // Group by browser domain
        const domain = event.browser?.domain || 'Non-browser';
        const existing = groups.get(domain) || [];
        existing.push(event);
        groups.set(domain, existing);
      } else if (groupBy === 'project') {
        // Group by editor project
        const project = event.editor?.project || 'No project';
        const existing = groups.get(project) || [];
        existing.push(event);
        groups.set(project, existing);
      } else if (groupBy === 'hour') {
        // Group by hour of day
        const timestamp = new Date(event.timestamp);
        const hour = timestamp.getUTCHours();
        const key = `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
        const existing = groups.get(key) || [];
        existing.push(event);
        groups.set(key, existing);
      } else if (groupBy === 'language') {
        // Group by programming language
        const language = event.editor?.language || 'Non-editor';
        const existing = groups.get(language) || [];
        existing.push(event);
        groups.set(language, existing);
      } else {
        // For application/title grouping, event appears in one group
        const key = groupBy === 'application' ? event.app : `${event.app}|${event.title}`;
        const existing = groups.get(key) || [];
        existing.push(event);
        groups.set(key, existing);
      }
    }

    // Aggregate each group
    const result: CanonicalEvent[] = [];
    for (const [groupKey, groupEvents] of groups) {
      const first = groupEvents[0];
      const totalDuration = groupEvents.reduce((sum, e) => sum + e.duration, 0);

      // Collect unique apps (for category grouping)
      const apps = new Set<string>();
      for (const e of groupEvents) {
        apps.add(e.app);
      }

      // Collect unique browser URLs
      const browserUrls = new Set<string>();
      const browserDomains = new Set<string>();
      let hasBrowser = false;
      for (const e of groupEvents) {
        if (e.browser) {
          hasBrowser = true;
          browserUrls.add(e.browser.url);
          browserDomains.add(e.browser.domain);
        }
      }

      // Collect unique editor files
      const editorFiles = new Set<string>();
      const editorProjects = new Set<string>();
      const editorLanguages = new Set<string>();
      let hasEditor = false;
      for (const e of groupEvents) {
        if (e.editor) {
          hasEditor = true;
          editorFiles.add(e.editor.file);
          if (e.editor.project) editorProjects.add(e.editor.project);
          if (e.editor.language) editorLanguages.add(e.editor.language);
        }
      }

      // Get timestamps
      const timestamps = groupEvents.map(e => new Date(e.timestamp).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      // Determine app field based on grouping type
      let appField: string;
      if (groupBy === 'category' || groupBy === 'category_top_level' || groupBy === 'domain' || groupBy === 'project' || groupBy === 'hour' || groupBy === 'language') {
        // For these groupings, show app count if multiple apps
        appField = apps.size === 1 ? Array.from(apps)[0] : `${apps.size} apps`;
      } else {
        // For application/title grouping, use the actual app
        appField = first.app;
      }

      // Determine title field based on grouping type
      let titleField: string;
      if (groupBy === 'title') {
        titleField = first.title;
      } else if (groupBy === 'domain') {
        titleField = groupKey; // Show the domain as title
      } else if (groupBy === 'project') {
        titleField = groupKey; // Show the project as title
      } else if (groupBy === 'hour') {
        titleField = groupKey; // Show the hour range as title
      } else if (groupBy === 'category_top_level') {
        titleField = groupKey; // Show the top-level category as title
      } else if (groupBy === 'language') {
        titleField = groupKey; // Show the language as title
      } else {
        titleField = 'Various';
      }

      const calendarAggregate = this.aggregateCalendarData(groupEvents);

      result.push({
        app: appField,
        title: titleField,
        duration_seconds: totalDuration,
        duration_hours: totalDuration / 3600,
        percentage: 0, // Will be calculated later
        browser: hasBrowser ? {
          url: browserUrls.size === 1 ? Array.from(browserUrls)[0] : `${browserUrls.size} URLs`,
          domain: browserDomains.size === 1 ? Array.from(browserDomains)[0] : `${browserDomains.size} domains`,
          title: first.browser?.title,
        } : undefined,
        editor: hasEditor ? {
          file: editorFiles.size === 1 ? Array.from(editorFiles)[0] : `${editorFiles.size} files`,
          project: editorProjects.size === 1 ? Array.from(editorProjects)[0] : undefined,
          language: editorLanguages.size === 1 ? Array.from(editorLanguages)[0] : undefined,
        } : undefined,
        category: groupBy === 'category' || groupBy === 'category_top_level' ? groupKey : (first.categories?.[0] || first.category),
        event_count: groupEvents.length,
        first_seen: firstSeen,
        last_seen: lastSeen,
        calendar: calendarAggregate.calendar,
        meeting_overlap_seconds: calendarAggregate.meetingOverlapSeconds,
        calendar_only: calendarAggregate.calendarOnly ? true : undefined,
      });
    }

    return result;
  }

  /**
   * Group events by multiple levels (hierarchical grouping)
   * Example: ['category_top_level', 'project'] groups by category, then by project within each category
   */
  private groupEventsMultiLevel(
    events: EnrichedEvent[],
    groupByLevels: ('application' | 'title' | 'category' | 'domain' | 'project' | 'hour' | 'category_top_level' | 'language')[]
  ): CanonicalEvent[] {
    if (groupByLevels.length === 0) {
      return this.groupEvents(events, 'application');
    }

    // Build hierarchical groups
    interface HierarchicalGroup {
      events: EnrichedEvent[];
      children?: Map<string, HierarchicalGroup>;
      key: string;
      level: number;
    }

    const rootGroups = new Map<string, HierarchicalGroup>();

    // Group events hierarchically
    for (const event of events) {
      const keys: string[] = [];

      // Extract key for each level
      for (const groupBy of groupByLevels) {
        let key: string;
        if (groupBy === 'category') {
          key = event.categories?.[0] || 'Uncategorized';
        } else if (groupBy === 'category_top_level') {
          const category = event.categories?.[0] || 'Uncategorized';
          key = category.split(' > ')[0];
        } else if (groupBy === 'domain') {
          key = event.browser?.domain || 'Non-browser';
        } else if (groupBy === 'project') {
          key = event.editor?.project || 'No project';
        } else if (groupBy === 'hour') {
          const timestamp = new Date(event.timestamp);
          const hour = timestamp.getUTCHours();
          key = `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
        } else if (groupBy === 'language') {
          key = event.editor?.language || 'Non-editor';
        } else if (groupBy === 'application') {
          key = event.app;
        } else {
          key = event.title;
        }
        keys.push(key);
      }

      // Navigate/create hierarchy
      let currentLevel = rootGroups;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!currentLevel.has(key)) {
          currentLevel.set(key, {
            events: [],
            children: i < keys.length - 1 ? new Map() : undefined,
            key,
            level: i,
          });
        }
        const group = currentLevel.get(key)!;
        group.events.push(event);
        if (group.children) {
          currentLevel = group.children;
        }
      }
    }

    // Flatten hierarchy into CanonicalEvents with group_hierarchy
    const result: CanonicalEvent[] = [];

    const flattenGroup = (group: HierarchicalGroup, hierarchy: string[]) => {
      const groupEvents = group.events;
      const first = groupEvents[0];
      const totalDuration = groupEvents.reduce((sum, e) => sum + e.duration, 0);

      // Collect unique apps
      const apps = new Set<string>();
      for (const e of groupEvents) {
        apps.add(e.app);
      }

      // Collect browser data
      const browserUrls = new Set<string>();
      const browserDomains = new Set<string>();
      let hasBrowser = false;
      for (const e of groupEvents) {
        if (e.browser) {
          hasBrowser = true;
          browserUrls.add(e.browser.url);
          browserDomains.add(e.browser.domain);
        }
      }

      // Collect editor data
      const editorFiles = new Set<string>();
      const editorProjects = new Set<string>();
      const editorLanguages = new Set<string>();
      let hasEditor = false;
      for (const e of groupEvents) {
        if (e.editor) {
          hasEditor = true;
          editorFiles.add(e.editor.file);
          if (e.editor.project) editorProjects.add(e.editor.project);
          if (e.editor.language) editorLanguages.add(e.editor.language);
        }
      }

      // Get timestamps
      const timestamps = groupEvents.map(e => new Date(e.timestamp).getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      const calendarAggregate = this.aggregateCalendarData(groupEvents);

      result.push({
        app: apps.size === 1 ? Array.from(apps)[0] : `${apps.size} apps`,
        title: hierarchy.join(' > '),
        duration_seconds: totalDuration,
        duration_hours: totalDuration / 3600,
        percentage: 0, // Will be calculated later
        browser: hasBrowser ? {
          url: browserUrls.size === 1 ? Array.from(browserUrls)[0] : `${browserUrls.size} URLs`,
          domain: browserDomains.size === 1 ? Array.from(browserDomains)[0] : `${browserDomains.size} domains`,
          title: first.browser?.title,
        } : undefined,
        editor: hasEditor ? {
          file: editorFiles.size === 1 ? Array.from(editorFiles)[0] : `${editorFiles.size} files`,
          project: editorProjects.size === 1 ? Array.from(editorProjects)[0] : undefined,
          language: editorLanguages.size === 1 ? Array.from(editorLanguages)[0] : undefined,
        } : undefined,
        category: first.categories?.[0] || first.category,
        group_key: group.key,
        group_hierarchy: hierarchy,
        event_count: groupEvents.length,
        first_seen: firstSeen,
        last_seen: lastSeen,
        calendar: calendarAggregate.calendar,
        meeting_overlap_seconds: calendarAggregate.meetingOverlapSeconds,
        calendar_only: calendarAggregate.calendarOnly ? true : undefined,
      });

      // Recursively flatten children
      if (group.children) {
        for (const [childKey, childGroup] of group.children) {
          flattenGroup(childGroup, [...hierarchy, childKey]);
        }
      }
    };

    // Flatten all root groups
    for (const [key, group] of rootGroups) {
      flattenGroup(group, [key]);
    }

    return result;
  }

  /**
   * Apply category classification to enriched events
   */
  private applyCategoriestoEvents(events: EnrichedEvent[]): EnrichedEvent[] {
    const categories = this.categoryService.getCategories();

    logger.debug(`Applying categories to ${events.length} events using ${categories.length} category rules`);

    return events.map(event => {
      // Find all matching categories
      const matchedCategories: string[] = [];

      for (const cat of categories) {
        if (cat.rule.type === 'regex' && cat.rule.regex) {
          try {
            const regex = new RegExp(cat.rule.regex, cat.rule.ignore_case ? 'i' : '');
            const text = `${event.app} ${event.title}`;
            if (regex.test(text)) {
              matchedCategories.push(cat.name.join(' > '));
            }
          } catch (error) {
            logger.warn(`Invalid regex in category ${cat.name.join(' > ')}`, error);
          }
        }
      }

      if (matchedCategories.length > 0) {
        logger.debug(`Event "${event.app}" matched categories: ${matchedCategories.join(', ')}`);
      }

      return {
        ...event,
        category: matchedCategories[0], // Deprecated: first match for backward compatibility
        categories: matchedCategories.length > 0 ? matchedCategories : undefined,
      };
    });
  }

}
