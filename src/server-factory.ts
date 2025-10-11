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

import { ActivityWatchClient } from './client/activitywatch.js';
import { CapabilitiesService } from './services/capabilities.js';
import { QueryService } from './services/query.js';
import { QueryBuilderService } from './services/query-builder.js';
import { AfkActivityService } from './services/afk-activity.js';
import { CategoryService } from './services/category.js';
import { DailySummaryService } from './services/daily-summary.js';
import { UnifiedActivityService } from './services/unified-activity.js';

import {
  GetCapabilitiesSchema,
  GetDailySummarySchema,
  GetRawEventsSchema,
  QueryEventsSchema,
} from './tools/schemas.js';

import { AWError } from './types.js';
import {
  formatRawEventsConcise,
  formatQueryResultsConcise,
  formatQueryResultsDetailed,
} from './utils/formatters.js';
import { logger } from './utils/logger.js';
import { performHealthCheck, logStartupDiagnostics } from './utils/health.js';
import { tools } from './tools/definitions.js';

/**
 * Creates a configured MCP server instance
 */
export async function createMCPServer(awUrl: string): Promise<Server> {
  // Log startup diagnostics
  logStartupDiagnostics(awUrl);

  // Initialize services
  const client = new ActivityWatchClient(awUrl);
  const capabilitiesService = new CapabilitiesService(client);
  const categoryService = new CategoryService(client);
  const queryService = new QueryService(client, capabilitiesService);
  const queryBuilderService = new QueryBuilderService(client, capabilitiesService);
  const afkService = new AfkActivityService(client, capabilitiesService);
  const unifiedService = new UnifiedActivityService(queryService, categoryService);
  const dailySummaryService = new DailySummaryService(
    unifiedService,
    queryService,
    afkService,
    categoryService
  );

  // Load categories from ActivityWatch server
  logger.info('Loading categories...');
  await categoryService.loadFromActivityWatch();
  if (categoryService.hasCategories()) {
    capabilitiesService.setCategoriesConfigured(true);
    logger.info(`Categories configured: ${categoryService.getCategories().length} categories available`);
  }

  // Perform health check on startup
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

  // Create MCP server
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

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info(`Tool called: ${name}`, { args });

    try {
      switch (name) {
        case 'aw_get_capabilities': {
          GetCapabilitiesSchema.parse(args);
          logger.debug('Fetching capabilities');

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

        case 'aw_get_daily_summary': {
          const params = GetDailySummarySchema.parse(args);
          const result = await dailySummaryService.getDailySummary(params);

          return {
            content: [
              {
                type: 'text',
                text: dailySummaryService.formatConcise(result),
              },
            ],
          };
        }

        case 'aw_get_raw_events': {
          const params = GetRawEventsSchema.parse(args);

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
            throw new AWError(
              `Bucket '${params.bucket_id}' not found.\n\n` +
              `Available buckets:\n${availableBuckets.map(b => `  - ${b}`).join('\n')}\n\n` +
              `Use the 'aw_get_capabilities' tool to see all available buckets with descriptions.`,
              'BUCKET_NOT_FOUND',
              { requestedBucket: params.bucket_id, availableBuckets }
            );
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
          const params = QueryEventsSchema.parse(args);

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
            throw new Error(`Category with id ${params.id} not found`);
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
          throw new Error(`Unknown tool: ${name}`);
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

