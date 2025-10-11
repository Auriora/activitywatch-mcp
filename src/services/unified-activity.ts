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
import {
  CanonicalEvent,
  BrowserEnrichment,
  EditorEnrichment,
  AWEvent,
  UnifiedActivityParams
} from '../types.js';
import { getTimeRange } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import {
  parseTerminalTitle,
  parseIDETitle,
  isTerminalApp,
  isIDEApp,
  setTitleParserConfig,
  TerminalInfo,
  IDEInfo
} from '../utils/title-parser.js';
import { getParsingConfig } from '../config/app-names.js';

interface EnrichedEvent {
  app: string;
  title: string;
  duration: number;
  timestamp: string;
  browser?: BrowserEnrichment;
  editor?: EditorEnrichment;
  terminal?: TerminalInfo;
  ide?: IDEInfo;
  category?: string;
}

export class UnifiedActivityService {
  constructor(
    private queryService: QueryService,
    private categoryService: CategoryService
  ) {
    // Initialize title parser with config
    const parsingConfig = getParsingConfig();
    setTitleParserConfig(parsingConfig);
  }

  /**
   * Get unified activity data with browser/editor enrichment
   */
  async getActivity(params: UnifiedActivityParams): Promise<{
    total_time_seconds: number;
    activities: CanonicalEvent[];
    time_range: { start: string; end: string };
  }> {
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

    // Merge browser and editor data into window events
    const enrichedEvents = this.enrichWindowEvents(
      canonical.window_events,
      canonical.browser_events,
      canonical.editor_events,
      params
    );

    // Filter by minimum duration
    const minDuration = params.min_duration_seconds ?? 5;
    const filteredEvents = enrichedEvents.filter(e => e.duration >= minDuration);

    logger.debug(`Filtered to ${filteredEvents.length} events (min duration: ${minDuration}s)`);

    // Group and aggregate
    const grouped = this.groupEvents(filteredEvents, params.group_by ?? 'application');

    // Exclude system apps if requested
    let activities = grouped;
    if (params.exclude_system_apps) {
      const systemApps = ['Finder', 'Dock', 'Window Server', 'explorer.exe', 'dwm.exe'];
      activities = grouped.filter(a => !systemApps.includes(a.app));
    }

    // Apply categorization if requested
    if (params.include_categories) {
      activities = await this.applyCategories(activities);
    }

    // Sort by duration and limit
    const topN = params.top_n ?? 10;
    const sorted = activities
      .sort((a, b) => b.duration_seconds - a.duration_seconds)
      .slice(0, topN);

    // Calculate percentages
    const totalTime = canonical.total_duration_seconds;
    const withPercentages = sorted.map(activity => ({
      ...activity,
      percentage: totalTime > 0 ? (activity.duration_seconds / totalTime) * 100 : 0,
    }));

    return {
      total_time_seconds: totalTime,
      activities: withPercentages,
      time_range: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    };
  }

  /**
   * Enrich window events with browser and editor data
   */
  private enrichWindowEvents(
    windowEvents: readonly AWEvent[],
    browserEvents: readonly AWEvent[],
    editorEvents: readonly AWEvent[],
    params: UnifiedActivityParams
  ): EnrichedEvent[] {
    const enriched: EnrichedEvent[] = [];

    // Enrich each window event
    for (const windowEvent of windowEvents) {
      const app = windowEvent.data.app as string || 'Unknown';
      const title = windowEvent.data.title as string || '';

      const windowStart = new Date(windowEvent.timestamp).getTime();
      const windowEnd = windowStart + (windowEvent.duration * 1000);

      // Find overlapping browser events
      let browserEnrichment: BrowserEnrichment | undefined;
      if (params.include_browser_details !== false) {
        for (const browserEvent of browserEvents) {
          const browserStart = new Date(browserEvent.timestamp).getTime();
          const browserEnd = browserStart + (browserEvent.duration * 1000);

          // Check if events overlap
          if (this.eventsOverlap(windowStart, windowEnd, browserStart, browserEnd)) {
            browserEnrichment = this.extractBrowserData(browserEvent);
            break; // Use first matching browser event
          }
        }
      }

      // Find overlapping editor events
      let editorEnrichment: EditorEnrichment | undefined;
      if (params.include_editor_details !== false) {
        for (const editorEvent of editorEvents) {
          const editorStart = new Date(editorEvent.timestamp).getTime();
          const editorEnd = editorStart + (editorEvent.duration * 1000);

          // Check if events overlap
          if (this.eventsOverlap(windowStart, windowEnd, editorStart, editorEnd)) {
            editorEnrichment = this.extractEditorData(editorEvent);
            break; // Use first matching editor event
          }
        }
      }

      // Parse terminal title if it's a terminal app
      // This provides unique information (hostname, directory, SSH status)
      // that is NOT available from any other bucket
      let terminalInfo: TerminalInfo | undefined;
      if (isTerminalApp(app)) {
        terminalInfo = parseTerminalTitle(title) || undefined;
      }

      // Parse IDE title ONLY if editor enrichment is not available
      // This helps detect dialogs/modals which should be filtered out
      // If editor bucket has data, we already have file/project info
      let ideInfo: IDEInfo | undefined;
      if (isIDEApp(app) && !editorEnrichment) {
        ideInfo = parseIDETitle(title);
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
    let domain = '';
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
   * Group events by application or title
   */
  private groupEvents(
    events: EnrichedEvent[],
    groupBy: 'application' | 'title'
  ): CanonicalEvent[] {
    const groups = new Map<string, EnrichedEvent[]>();

    // Group events
    for (const event of events) {
      const key = groupBy === 'application' ? event.app : `${event.app}|${event.title}`;
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    }

    // Aggregate each group
    const result: CanonicalEvent[] = [];
    for (const [, groupEvents] of groups) {
      const first = groupEvents[0];
      const totalDuration = groupEvents.reduce((sum, e) => sum + e.duration, 0);

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

      result.push({
        app: first.app,
        title: groupBy === 'title' ? first.title : 'Various',
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
        category: first.category,
        event_count: groupEvents.length,
        first_seen: firstSeen,
        last_seen: lastSeen,
      });
    }

    return result;
  }

  /**
   * Apply category classification to activities
   */
  private async applyCategories(activities: CanonicalEvent[]): Promise<CanonicalEvent[]> {
    const categories = await this.categoryService.getCategories();

    return activities.map(activity => {
      // Find matching category
      let matchedCategory: string | undefined;

      for (const cat of categories) {
        if (cat.rule.type === 'regex' && cat.rule.regex) {
          try {
            const regex = new RegExp(cat.rule.regex, cat.rule.ignore_case ? 'i' : '');
            const text = `${activity.app} ${activity.title}`;
            if (regex.test(text)) {
              matchedCategory = cat.name.join(' > ');
              break;
            }
          } catch (error) {
            logger.warn(`Invalid regex in category ${cat.name.join(' > ')}`, error);
          }
        }
      }

      return {
        ...activity,
        category: matchedCategory || activity.category,
      };
    });
  }
}

