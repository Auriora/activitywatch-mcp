/**
 * MCP Server Factory
 *
 * Creates and configures MCP server instances with all tools and handlers.
 * Shared between stdio and HTTP transports.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ActivityWatchClient, type IActivityWatchClient } from './client/activitywatch.js';
import { CapabilitiesService } from './services/capabilities.js';
import { QueryService } from './services/query.js';
import { QueryBuilderService } from './services/query-builder.js';
import { AfkActivityService } from './services/afk-activity.js';
import { CategoryService } from './services/category.js';
import { PeriodSummaryService } from './services/period-summary.js';
import { UnifiedActivityService } from './services/unified-activity.js';
import { CalendarService } from './services/calendar.js';

import {
  GetCapabilitiesSchema,
  GetCalendarEventsSchema,
  GetPeriodSummarySchema,
  GetRawEventsSchema,
  QueryEventsSchema,
  GetMeetingContextSchema,
} from './tools/schemas.js';
import type {
  GetCapabilitiesParams,
  GetCalendarEventsParams,
  GetPeriodSummaryParams,
  GetRawEventsParams,
  QueryEventsParams,
  GetMeetingContextParams,
} from './tools/schemas.js';

import { AWError } from './types.js';
import {
  formatRawEventsConcise,
  formatQueryResultsConcise,
  formatQueryResultsDetailed,
  formatPeriodSummaryConcise,
  formatCalendarEventsConcise,
  formatCalendarEventsDetailed,
} from './utils/formatters.js';
import { logger } from './utils/logger.js';
import { performHealthCheck, formatHealthCheckResult } from './utils/health.js';
import { tools } from './tools/definitions.js';
import { formatDuration } from './utils/time.js';

export interface ServerDependencies {
  client: IActivityWatchClient;
  capabilitiesService: CapabilitiesService;
  categoryService: CategoryService;
  queryService: QueryService;
  queryBuilderService: QueryBuilderService;
  calendarService: CalendarService;
  afkService: AfkActivityService;
  unifiedService: UnifiedActivityService;
  periodSummaryService: PeriodSummaryService;
}

export interface ServerLifecycleOptions {
  loadCategories?: boolean;
  performHealthCheck?: boolean;
}

export async function createServerWithDependencies(
  deps: ServerDependencies,
  options: ServerLifecycleOptions = {}
): Promise<Server> {
  const {
    client,
    capabilitiesService,
    categoryService,
    queryBuilderService,
    calendarService,
    unifiedService,
    periodSummaryService,
  } = deps;

  const {
    loadCategories = true,
    performHealthCheck: shouldPerformHealthCheck = true,
  } = options;

  if (loadCategories) {
    logger.info('Loading categories...');
    await categoryService.loadFromActivityWatch();
    if (categoryService.hasCategories()) {
      capabilitiesService.setCategoriesConfigured(true);
      logger.info(`Categories configured: ${categoryService.getCategories().length} categories available`);
    }
  } else if (categoryService.hasCategories()) {
    capabilitiesService.setCategoriesConfigured(true);
  }

  if (shouldPerformHealthCheck) {
    logger.info('Performing startup health check...');
    const healthCheck = await performHealthCheck(client);

    if (!healthCheck.healthy) {
      logger.warn('Health check failed, but server will start anyway', {
        errors: healthCheck.errors,
        warnings: healthCheck.warnings,
      });
    } else {
      logger.info('Health check passed');
    }
    logger.debug(formatHealthCheckResult(healthCheck));
  }

  const server = new Server(
    {
      name: 'activitywatch-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info(`Tool called: ${name}`, { args });

    try {
      switch (name) {
        case 'aw_get_capabilities': {
          const params = GetCapabilitiesSchema.parse((args ?? {}) as GetCapabilitiesParams);
          logger.debug('Fetching capabilities', { params });

          const [buckets, capabilities, suggestedTools] = await Promise.all([
            capabilitiesService.getAvailableBuckets(),
            capabilitiesService.detectCapabilities(),
            capabilitiesService.getSuggestedTools(),
          ]);

          logger.info('Capabilities retrieved', {
            bucketCount: buckets.length,
            capabilities,
            suggestedToolCount: suggestedTools.length,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    available_buckets: buckets,
                    capabilities,
                    suggested_tools: suggestedTools,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'aw_get_activity': {
          const params = args as any;
          const result = await unifiedService.getActivity(params);

          logger.info('Unified activity retrieved', {
            totalTime: result.total_time_seconds,
            activityCount: result.activities.length,
          });

          if (params.response_format === 'concise') {
            const lines: string[] = [];
            lines.push(`# Activity Summary`);
            lines.push(`**Period**: ${params.time_period || 'today'}`);
            lines.push(`**Total Active Time**: ${(result.total_time_seconds / 3600).toFixed(2)} hours`);
            lines.push('');
            lines.push(`## Top ${result.activities.length} Activities`);
            lines.push('');

            for (const activity of result.activities) {
              lines.push(`### ${activity.app}`);
              lines.push(`- **Time**: ${activity.duration_hours.toFixed(2)}h (${activity.percentage.toFixed(1)}%)`);

              if (activity.category) {
                lines.push(`- **Category**: ${activity.category}`);
              }

              lines.push(`- **Events**: ${activity.event_count}`);
              lines.push('');
            }

            return {
              content: [
                {
                  type: 'text',
                  text: lines.join('\n'),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'aw_get_calendar_events': {
          const params: GetCalendarEventsParams = GetCalendarEventsSchema.parse(args);
          const result = await calendarService.getEvents({
            time_period: params.time_period,
            custom_start: params.custom_start,
            custom_end: params.custom_end,
            include_all_day: params.include_all_day,
            include_cancelled: params.include_cancelled,
            summary_query: params.summary_query,
            limit: params.limit,
          });

          if (params.response_format === 'raw') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          if (params.response_format === 'detailed') {
            return {
              content: [
                {
                  type: 'text',
                  text: formatCalendarEventsDetailed(result),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: formatCalendarEventsConcise(result),
              },
            ],
          };
        }

        case 'aw_get_period_summary': {
          const params: GetPeriodSummaryParams = GetPeriodSummarySchema.parse(args);
          const result = await periodSummaryService.getPeriodSummary(params);

          return {
            content: [
              {
                type: 'text',
                text: formatPeriodSummaryConcise(result),
              },
            ],
          };
        }

        case 'aw_get_raw_events': {
          const params: GetRawEventsParams = GetRawEventsSchema.parse(args);

          logger.debug('Fetching raw events', {
            bucketId: params.bucket_id,
            startTime: params.start_time,
            endTime: params.end_time,
            limit: params.limit,
          });

          const buckets = await client.getBuckets();
          if (!buckets[params.bucket_id]) {
            const availableBuckets = Object.keys(buckets);
            logger.warn('Bucket not found', {
              requestedBucket: params.bucket_id,
              availableBuckets,
            });
            const message =
              `Bucket '${params.bucket_id}' not found.\n\n` +
              `Available buckets:\n${availableBuckets.map(b => `  - ${b}`).join('\n')}\n\n` +
              `Use the 'aw_get_capabilities' tool to see all available buckets with descriptions.`;
            return {
              content: [
                {
                  type: 'text',
                  text: message,
                },
              ],
              isError: true,
            };
          }

          const events = await client.getEvents(params.bucket_id, {
            start: params.start_time,
            end: params.end_time,
            limit: params.limit,
          });

          logger.info('Raw events retrieved', {
            bucketId: params.bucket_id,
            eventCount: events.length,
          });

          if (params.response_format === 'raw') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(events, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: formatRawEventsConcise(params.bucket_id, events),
              },
            ],
          };
        }

        case 'aw_query_events': {
          const params: QueryEventsParams = QueryEventsSchema.parse(args);

          logger.debug('Building custom query', {
            queryType: params.query_type,
            startTime: params.start_time,
            endTime: params.end_time,
            filterAfk: params.filter_afk,
          });

          const result = await queryBuilderService.queryEvents(params);

          logger.info('Query executed', {
            eventCount: result.events.length,
            totalDuration: result.total_duration_seconds,
            bucketsQueried: result.buckets_queried.length,
          });

          if (params.response_format === 'raw') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    events: result.events,
                    total_duration_seconds: result.total_duration_seconds,
                    query_used: result.query_used,
                    buckets_queried: result.buckets_queried,
                  }, null, 2),
                },
              ],
            };
          }

          if (params.response_format === 'detailed') {
            return {
              content: [
                {
                  type: 'text',
                  text: formatQueryResultsDetailed(result),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: formatQueryResultsConcise(result),
              },
            ],
          };
        }

        case 'aw_get_meeting_context': {
          const params: GetMeetingContextParams = GetMeetingContextSchema.parse(args);
          const { response_format: responseFormat, ...serviceParams } = params;
          const result = await unifiedService.getMeetingContext(serviceParams);

          if ((responseFormat ?? 'detailed') === 'concise') {
            if (result.meetings.length === 0) {
              const message = result.message ?? 'No meeting focus data available.';
              return {
                content: [
                  {
                    type: 'text',
                    text: message,
                  },
                ],
              };
            }

            const lines: string[] = [];
            lines.push('# Meeting Focus Context');
            if (result.time_range) {
              lines.push(
                `**Range**: ${result.time_range.start} → ${result.time_range.end}`
              );
            }
            lines.push('');

            for (const entry of result.meetings) {
              lines.push(`## ${entry.meeting.summary}`);
              lines.push(
                `- When: ${entry.meeting.start} → ${entry.meeting.end}`
              );
              if (entry.meeting.calendar) {
                lines.push(`- Calendar: ${entry.meeting.calendar}`);
              }
              if (entry.meeting.location) {
                lines.push(`- Location: ${entry.meeting.location}`);
              }
              if (entry.meeting.attendees?.length) {
                lines.push(
                  `- Attendees: ${entry.meeting.attendees.map(a => a.name ?? a.email ?? 'Unknown').join(', ')}`
                );
              }
              const totals = entry.totals;
              lines.push(
                `- Overlap: ${formatDuration(totals.overlap_seconds)} of ${formatDuration(totals.scheduled_seconds)}`
              );
              if (totals.meeting_only_seconds > 0) {
                lines.push(
                  `- Meeting-only: ${formatDuration(totals.meeting_only_seconds)}`
                );
              }
              lines.push('');
              if (entry.focus.length > 0) {
                lines.push('### Focused Apps');
                for (const focus of entry.focus) {
                  const titles = focus.titles.length > 0
                    ? ` — ${focus.titles.slice(0, 3).join(', ')}${focus.titles.length > 3 ? '…' : ''}`
                    : '';
                  lines.push(
                    `- ${focus.app}: ${formatDuration(focus.duration_seconds)} (${focus.percentage.toFixed(1)}%)${titles}`
                  );
                }
              } else {
                lines.push('### Focused Apps');
                lines.push('- No overlapping focus data during this meeting.');
              }
              lines.push('');
            }

            return {
              content: [
                {
                  type: 'text',
                  text: lines.join('\n'),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'aw_list_categories': {
          logger.debug('Listing categories');

          await categoryService.reloadCategories();
          const categories = categoryService.getCategories();

          logger.info('Categories listed', {
            categoryCount: categories.length,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    categories: categories.map((cat) => ({
                      id: cat.id,
                      name: cat.name.join(' > '),
                      name_array: cat.name,
                      rule: cat.rule,
                      ...(cat.data && {
                        color: cat.data.color,
                        score: cat.data.score,
                      }),
                    })),
                    total_count: categories.length,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'aw_add_category': {
          const params = args as { name: string[]; regex: string; color?: string; score?: number };

          logger.debug('Adding category', {
            name: params.name,
            regex: params.regex,
            color: params.color,
            score: params.score,
          });

          const data = params.color || params.score !== undefined
            ? {
                ...(params.color && { color: params.color }),
                ...(params.score !== undefined && { score: params.score }),
              }
            : undefined;

          const newCategory = await categoryService.addCategory(
            params.name,
            {
              type: 'regex',
              regex: params.regex,
            },
            data
          );

          logger.info('Category added', {
            id: newCategory.id,
            name: newCategory.name.join(' > '),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    category: {
                      id: newCategory.id,
                      name: newCategory.name.join(' > '),
                      name_array: newCategory.name,
                      rule: newCategory.rule,
                      ...(newCategory.data && {
                        color: newCategory.data.color,
                        score: newCategory.data.score,
                      }),
                    },
                    message: `Category "${newCategory.name.join(' > ')}" created successfully`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'aw_update_category': {
          const params = args as {
            id: number;
            name?: string[];
            regex?: string;
            color?: string;
            score?: number
          };

          logger.debug('Updating category', {
            id: params.id,
            name: params.name,
            regex: params.regex,
            color: params.color,
            score: params.score,
          });

          const updates: Partial<{
            name: string[];
            rule: { type: 'regex'; regex: string };
            data: { color?: string; score?: number }
          }> = {};

          if (params.name) {
            updates.name = params.name;
          }
          if (params.regex) {
            updates.rule = { type: 'regex', regex: params.regex };
          }
          if (params.color || params.score !== undefined) {
            updates.data = {
              ...(params.color && { color: params.color }),
              ...(params.score !== undefined && { score: params.score }),
            };
          }

          const updatedCategory = await categoryService.updateCategory(params.id, updates);

          logger.info('Category updated', {
            id: updatedCategory.id,
            name: updatedCategory.name.join(' > '),
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    category: {
                      id: updatedCategory.id,
                      name: updatedCategory.name.join(' > '),
                      name_array: updatedCategory.name,
                      rule: updatedCategory.rule,
                      ...(updatedCategory.data && {
                        color: updatedCategory.data.color,
                        score: updatedCategory.data.score,
                      }),
                    },
                    message: `Category ${params.id} updated successfully`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'aw_delete_category': {
          const params = args as { id: number };

          logger.debug('Deleting category', {
            id: params.id,
          });

          const category = categoryService.getCategoryById(params.id);
          if (!category) {
            const message = `Category with id ${params.id} not found`;
            logger.warn(message);
            return {
              content: [
                {
                  type: 'text',
                  text: message,
                },
              ],
              isError: true,
            };
          }

          const categoryName = category.name.join(' > ');
          await categoryService.deleteCategory(params.id);

          logger.info('Category deleted', {
            id: params.id,
            name: categoryName,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Category "${categoryName}" (id: ${params.id}) deleted successfully`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          logger.error(`Unknown tool requested: ${name}`);
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown tool "${name}"`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      if (error instanceof AWError) {
        logger.error(`Tool error: ${name}`, error);
        return {
          content: [
            {
              type: 'text',
              text: error.message,
            },
          ],
          isError: true,
        };
      }

      if (error instanceof Error) {
        logger.error(`Tool error: ${name}`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      logger.error(`Unknown error in tool: ${name}`, error);
      return {
        content: [
          {
            type: 'text',
            text: 'An unknown error occurred',
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Creates a configured MCP server instance
 */
export async function createMCPServer(awUrl: string): Promise<Server> {
  const client = new ActivityWatchClient(awUrl);
  const capabilitiesService = new CapabilitiesService(client);
  const categoryService = new CategoryService(client);
  const queryService = new QueryService(client, capabilitiesService);
  const queryBuilderService = new QueryBuilderService(client, capabilitiesService);
  const calendarService = new CalendarService(client, capabilitiesService);
  const afkService = new AfkActivityService(client, capabilitiesService);
  const unifiedService = new UnifiedActivityService(
    queryService,
    categoryService,
    calendarService
  );
  const periodSummaryService = new PeriodSummaryService(
    unifiedService,
    queryService,
    afkService,
    categoryService,
    calendarService
  );

  return createServerWithDependencies({
    client,
    capabilitiesService,
    categoryService,
    queryService,
    queryBuilderService,
    calendarService,
    afkService,
    unifiedService,
    periodSummaryService,
  });
}
