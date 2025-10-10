/**
 * Service for editor/IDE activity analysis
 */

import { IActivityWatchClient } from '../client/activitywatch.js';
import { CapabilitiesService } from './capabilities.js';
import { CategoryService } from './category.js';
import { EditorActivityParams, EditorUsage, AWEvent, AWError } from '../types.js';
import { getTimeRange, formatDateForAPI, secondsToHours } from '../utils/time.js';
import {
  filterByDuration,
  calculatePercentage,
  sortByDuration,
  takeTop,
  sumDurations,
} from '../utils/filters.js';
import { logger } from '../utils/logger.js';
import { getStringProperty } from '../utils/type-guards.js';

export class EditorActivityService {
  constructor(
    private client: IActivityWatchClient,
    private capabilities: CapabilitiesService,
    private categoryService?: CategoryService
  ) {}

  /**
   * Get editor/IDE activity for a time period
   */
  async getEditorActivity(params: EditorActivityParams): Promise<{
    total_time_seconds: number;
    editors: EditorUsage[];
    time_range: { start: string; end: string };
  }> {
    logger.debug('Getting editor activity', { params });

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

    // Find editor tracking buckets
    const editorBuckets = await this.capabilities.findEditorBuckets();
    logger.info(`Found ${editorBuckets.length} editor tracking buckets`);

    if (editorBuckets.length === 0) {
      logger.warn('No editor tracking buckets available');
      throw new AWError(
        'No editor activity buckets found. This usually means:\n' +
        '1. IDE/editor watchers are not installed (e.g., aw-watcher-vscode, JetBrains plugins)\n' +
        '2. No editor data has been collected yet\n\n' +
        'Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.',
        'NO_BUCKETS_FOUND'
      );
    }

    // Collect events from all editor buckets
    let allEvents: AWEvent[] = [];

    for (const bucket of editorBuckets) {
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
        editors: [],
        time_range: {
          start: formatDateForAPI(timeRange.start),
          end: formatDateForAPI(timeRange.end),
        },
      };
    }

    // Filter by minimum duration
    const minDuration = params.min_duration_seconds ?? 5;
    const filteredEvents = filterByDuration(allEvents, minDuration);
    logger.debug(`Filtered to ${filteredEvents.length} events (min duration: ${minDuration}s)`);

    // Group by the specified field
    const groupBy = params.group_by ?? 'project';
    const editorGroups = this.groupEditorActivity(filteredEvents, groupBy);

    // Calculate totals
    const totalTime = sumDurations(filteredEvents);

    // Convert to EditorUsage format
    const editors: EditorUsage[] = [];
    const includeGitInfo = params.include_git_info && params.response_format === 'detailed';

    for (const [key, events] of editorGroups.entries()) {
      const duration = sumDurations(events);

      let usage: EditorUsage = {
        name: key,
        duration_seconds: duration,
        duration_hours: secondsToHours(duration),
        percentage: calculatePercentage(duration, totalTime),
        event_count: events.length,
      };

      // Determine category if requested
      if (params.include_categories && this.categoryService) {
        const category = this.categoryService.categorizeEvent(events[0]);
        if (category) {
          usage = {
            ...usage,
            category,
          };
        }
      }

      // Add additional context based on grouping
      if (params.response_format === 'detailed') {
        // Extract timestamps
        const timestamps = events.map(e => new Date(e.timestamp).getTime());
        const firstSeen = new Date(Math.min(...timestamps)).toISOString();
        const lastSeen = new Date(Math.max(...timestamps)).toISOString();

        // Extract editor version (use first non-empty value)
        const editorVersion = events
          .map(e => getStringProperty(e.data, 'editorVersion'))
          .find(v => v && v.length > 0);

        // Extract state breakdown
        const stateBreakdown = this.extractStateBreakdown(events);

        usage = {
          ...usage,
          first_seen: firstSeen,
          last_seen: lastSeen,
          editor_version: editorVersion,
          state_breakdown: stateBreakdown,
        };

        if (groupBy === 'project') {
          usage = {
            ...usage,
            files: this.extractUniqueValues(events, 'file'),
            languages: this.extractUniqueValues(events, 'language'),
          };
        } else if (groupBy === 'language' || groupBy === 'editor') {
          usage = {
            ...usage,
            projects: this.extractUniqueValues(events, 'project'),
          };
        }

        // Add git info if requested
        if (includeGitInfo) {
          const gitInfo = this.extractGitInfo(events);
          if (gitInfo) {
            usage = {
              ...usage,
              git_info: gitInfo,
            };
          }
        }
      }

      editors.push(usage);
    }

    // Sort and limit
    const sorted = sortByDuration(editors);
    const topN = params.top_n ?? 10;
    const limited = takeTop(sorted, topN);

    return {
      total_time_seconds: totalTime,
      editors: limited,
      time_range: {
        start: formatDateForAPI(timeRange.start),
        end: formatDateForAPI(timeRange.end),
      },
    };
  }

  /**
   * Group editor events by specified field
   */
  private groupEditorActivity(
    events: AWEvent[],
    groupBy: 'project' | 'file' | 'language' | 'editor'
  ): Map<string, AWEvent[]> {
    const groups = new Map<string, AWEvent[]>();

    for (const event of events) {
      let key: string;

      switch (groupBy) {
        case 'project':
          key = getStringProperty(event.data, 'project') || 'Unknown Project';
          break;
        case 'file':
          key = getStringProperty(event.data, 'file') || 'Unknown File';
          break;
        case 'language':
          key = getStringProperty(event.data, 'language') || 'Unknown Language';
          break;
        case 'editor':
          key = getStringProperty(event.data, 'editor') || 'Unknown Editor';
          break;
      }

      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    }

    return groups;
  }

  /**
   * Extract unique values for a field from events
   */
  private extractUniqueValues(events: AWEvent[], field: string): string[] {
    const values = new Set<string>();
    for (const event of events) {
      const value = getStringProperty(event.data, field);
      if (value) {
        values.add(value);
      }
    }
    return Array.from(values).slice(0, 10); // Limit to 10 items
  }

  /**
   * Extract git information from events
   */
  private extractGitInfo(events: AWEvent[]): EditorUsage['git_info'] | undefined {
    // Find the most recent event with git info
    for (const event of events) {
      const branch = getStringProperty(event.data, 'branch');
      const commit = getStringProperty(event.data, 'commit');
      const repository = getStringProperty(event.data, 'sourceUrl');

      if (branch || commit || repository) {
        return {
          branch: branch || undefined,
          commit: commit || undefined,
          repository: repository || undefined,
        };
      }
    }
    return undefined;
  }

  /**
   * Extract state breakdown from events
   * Aggregates time spent in different states (CODING, DEBUGGING, BROWSING, etc.)
   */
  private extractStateBreakdown(events: AWEvent[]): { [state: string]: number } | undefined {
    const stateMap = new Map<string, number>();

    for (const event of events) {
      const state = getStringProperty(event.data, 'state');
      if (state) {
        const duration = event.duration || 0;
        stateMap.set(state, (stateMap.get(state) || 0) + duration);
      }
    }

    if (stateMap.size === 0) {
      return undefined;
    }

    const breakdown: { [state: string]: number } = {};
    for (const [state, duration] of stateMap.entries()) {
      breakdown[state] = Math.round(duration);
    }

    return breakdown;
  }

  /**
   * Format editor activity for concise output
   */
  formatConcise(data: {
    total_time_seconds: number;
    editors: EditorUsage[];
    time_range: { start: string; end: string };
  }): string {
    const { total_time_seconds, editors, time_range } = data;
    
    let output = `Editor Activity (${time_range.start} to ${time_range.end})\n`;
    output += `Total Editing Time: ${secondsToHours(total_time_seconds)} hours\n\n`;

    if (editors.length === 0) {
      output += 'No editor activity found for this period.\n';
      return output;
    }

    output += `Top Items:\n`;
    for (const item of editors) {
      output += `  ${item.name}: ${item.duration_hours}h (${item.percentage}%)\n`;
    }

    return output;
  }
}

