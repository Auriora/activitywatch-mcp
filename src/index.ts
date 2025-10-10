#!/usr/bin/env node

/**
 * ActivityWatch MCP Server
 *
 * Provides LLM agents with tools to query and analyze ActivityWatch data.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { ActivityWatchClient } from './client/activitywatch.js';
import { CapabilitiesService } from './services/capabilities.js';
import { WindowActivityService } from './services/window-activity.js';
import { WebActivityService } from './services/web-activity.js';
import { DailySummaryService } from './services/daily-summary.js';

import {
  GetCapabilitiesSchema,
  GetWindowActivitySchema,
  GetWebActivitySchema,
  GetDailySummarySchema,
  GetRawEventsSchema,
} from './tools/schemas.js';

import { AWError } from './types.js';
import { formatRawEventsConcise } from './utils/formatters.js';
import { logger } from './utils/logger.js';
import { performHealthCheck, logStartupDiagnostics } from './utils/health.js';

/**
 * Initialize services
 */
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

// Log startup diagnostics
logStartupDiagnostics(AW_URL);

const client = new ActivityWatchClient(AW_URL);
const capabilitiesService = new CapabilitiesService(client);
const windowService = new WindowActivityService(client, capabilitiesService);
const webService = new WebActivityService(client, capabilitiesService);
const dailySummaryService = new DailySummaryService(windowService, webService);

/**
 * Create MCP server
 */
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

/**
 * Tool definitions
 */
const tools: Tool[] = [
  {
    name: 'aw_get_capabilities',
    description: `Discover what ActivityWatch data is available and determine which analysis tools can be used.

WHEN TO USE:
- ALWAYS call this tool FIRST in a new conversation before using any other ActivityWatch tools
- When the user asks "what data do I have?" or similar discovery questions
- When other tools fail with "no buckets found" errors
- To check date ranges of available data

CAPABILITIES:
- Lists all available data sources (buckets) with human-readable descriptions
- Shows date range for each data source (earliest to latest data)
- Detects which tracking features are active (window/browser/AFK)
- Identifies which devices are being tracked
- Recommends which tools are applicable based on available data

LIMITATIONS:
- Does not return actual activity data, only metadata about what's available
- Cannot create or modify data sources
- Requires ActivityWatch to be running

RETURNS:
- available_buckets: Array of bucket metadata (id, type, description, device, date range)
- capabilities: Boolean flags for has_window_tracking, has_browser_tracking, has_afk_detection
- suggested_tools: Array of tool names that will work with available data

NO PARAMETERS REQUIRED - just call it to discover what's available.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'aw_get_window_activity',
    description: `Analyzes application and window usage over a time period.

WHEN TO USE:
- User asks about time spent in specific applications (e.g., "How long did I use VS Code?")
- Questions about which apps were used during a time period
- Productivity analysis focused on application usage
- Comparing application usage across time periods
- Identifying most-used applications

WHEN NOT TO USE:
- For website/browser activity → use aw_get_web_activity instead
- For comprehensive daily overview → use aw_get_daily_summary instead
- For exact event timestamps → use aw_get_raw_events instead
- If no window tracking data exists (check with aw_get_capabilities first)

CAPABILITIES:
- Automatically discovers and aggregates data from all window tracking buckets
- Combines data across multiple devices if available
- Filters out system applications (Finder, Dock, etc.) by default
- Normalizes application names (e.g., "Code" → "VS Code")
- Removes very short events (< 5 seconds by default) to filter noise
- Groups by application name or window title
- Calculates total time, percentages, and rankings

LIMITATIONS:
- Cannot see WHAT you did in the application (no content access)
- Cannot determine quality or productivity of work
- Only shows active window time (not background processes)
- Requires window watcher (aw-watcher-window) to be installed and running
- Time periods limited to available data (check date ranges with aw_get_capabilities)

RETURNS:
- total_time_seconds: Total active time in the period
- applications: Array of {name, duration_seconds, duration_hours, percentage, window_titles?}
- time_range: {start, end} timestamps of analyzed period

Default response is human-readable summary. Use response_format='detailed' for structured data.`,
    inputSchema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'last_30_days', 'custom'],
          default: 'today',
          description: 'Time period to analyze. Options: "today" (since midnight), "yesterday" (previous day), "this_week" (Monday to now), "last_week" (previous Monday-Sunday), "last_7_days" (rolling 7 days), "last_30_days" (rolling 30 days), "custom" (requires custom_start and custom_end). Use natural periods unless user specifies exact dates.',
        },
        custom_start: {
          type: 'string',
          description: 'Start date/time for custom period. Required only when time_period="custom". Formats: ISO 8601 ("2025-01-14T09:00:00Z") or simple date ("2025-01-14" assumes 00:00:00). Examples: "2025-01-14", "2025-01-14T14:30:00Z"',
        },
        custom_end: {
          type: 'string',
          description: 'End date/time for custom period. Required only when time_period="custom". Formats: ISO 8601 ("2025-01-14T17:00:00Z") or simple date ("2025-01-14" assumes 23:59:59). Must be after custom_start. Examples: "2025-01-14", "2025-01-14T17:00:00Z"',
        },
        top_n: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 100,
          description: 'Number of top applications to return, ranked by time spent. Default: 10. Use 5 for quick overview, 20+ for comprehensive analysis. Maximum: 100.',
        },
        group_by: {
          type: 'string',
          enum: ['application', 'title', 'both'],
          default: 'application',
          description: 'How to group results. "application": Group by app name only (e.g., all Chrome windows together) - recommended for overview. "title": Group by window title (e.g., separate "Chrome - Gmail" from "Chrome - GitHub") - use for detailed analysis. "both": Show both levels of grouping.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed'],
          default: 'concise',
          description: 'Output format. "concise": Human-readable text summary optimized for user presentation (recommended for most queries). "detailed": Full JSON with all fields including window_titles array and precise timestamps (use when user needs technical data or export).',
        },
        exclude_system_apps: {
          type: 'boolean',
          default: true,
          description: 'Whether to exclude system/OS applications from results. true (default): Filters out Finder, Dock, Window Server, explorer.exe, etc. false: Include all applications. Set to false only if user specifically asks about system apps.',
        },
        min_duration_seconds: {
          type: 'number',
          default: 5,
          minimum: 0,
          description: 'Minimum event duration to include. Events shorter than this are filtered out as likely accidental window switches. Default: 5 seconds. Use 0 to include all events, 30+ to focus on sustained usage. Recommended: keep default unless user requests otherwise.',
        },
      },
      required: [],
    },
  },
  {
    name: 'aw_get_web_activity',
    description: `Analyzes web browsing and website usage over a time period.

WHEN TO USE:
- User asks about time spent on specific websites or domains
- Questions about browsing patterns or habits
- Identifying most-visited websites
- Analyzing time spent on different types of sites (social media, documentation, etc.)
- Comparing web usage across time periods

WHEN NOT TO USE:
- For application usage (non-browser) → use aw_get_window_activity instead
- For comprehensive daily overview → use aw_get_daily_summary instead
- For exact page visit timestamps → use aw_get_raw_events instead
- If no browser tracking data exists (check with aw_get_capabilities first)

CAPABILITIES:
- Automatically discovers and aggregates data from all browser tracking buckets
- Combines data across multiple browsers (Chrome, Firefox, Safari, etc.)
- Extracts and normalizes domain names from URLs
- Filters out localhost and development URLs by default
- Removes very short visits (< 5 seconds by default) to filter noise
- Groups by domain, full URL, or page title
- Calculates total time, percentages, and rankings

LIMITATIONS:
- Cannot see page CONTENT or what you read/typed
- Cannot determine if time was productive or not
- Only tracks active tab time (not background tabs)
- Requires browser extension (aw-watcher-web) to be installed
- May not capture incognito/private browsing depending on extension settings
- Time periods limited to available data (check date ranges with aw_get_capabilities)

RETURNS:
- total_time_seconds: Total browsing time in the period
- websites: Array of {domain, url?, title?, duration_seconds, duration_hours, percentage}
- time_range: {start, end} timestamps of analyzed period

Default response is human-readable summary. Use response_format='detailed' for structured data.`,
    inputSchema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'last_30_days', 'custom'],
          default: 'today',
          description: 'Time period to analyze. Options: "today" (since midnight), "yesterday" (previous day), "this_week" (Monday to now), "last_week" (previous Monday-Sunday), "last_7_days" (rolling 7 days), "last_30_days" (rolling 30 days), "custom" (requires custom_start and custom_end). Use natural periods unless user specifies exact dates.',
        },
        custom_start: {
          type: 'string',
          description: 'Start date/time for custom period. Required only when time_period="custom". Formats: ISO 8601 ("2025-01-14T09:00:00Z") or simple date ("2025-01-14" assumes 00:00:00). Examples: "2025-01-14", "2025-01-14T14:30:00Z"',
        },
        custom_end: {
          type: 'string',
          description: 'End date/time for custom period. Required only when time_period="custom". Formats: ISO 8601 ("2025-01-14T17:00:00Z") or simple date ("2025-01-14" assumes 23:59:59). Must be after custom_start. Examples: "2025-01-14", "2025-01-14T17:00:00Z"',
        },
        top_n: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 100,
          description: 'Number of top websites to return, ranked by time spent. Default: 10. Use 5 for quick overview, 20+ for comprehensive analysis. Maximum: 100.',
        },
        group_by: {
          type: 'string',
          enum: ['domain', 'url', 'title'],
          default: 'domain',
          description: 'How to group results. "domain": Group by domain name (e.g., all github.com pages together) - recommended for overview. "url": Group by full URL (e.g., separate github.com/user/repo1 from github.com/user/repo2) - use for detailed page-level analysis. "title": Group by page title - use when user asks about specific page names.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed'],
          default: 'concise',
          description: 'Output format. "concise": Human-readable text summary optimized for user presentation (recommended for most queries). "detailed": Full JSON with all fields including URLs, titles, and precise timestamps (use when user needs technical data or export).',
        },
        exclude_domains: {
          type: 'array',
          items: { type: 'string' },
          default: ['localhost', '127.0.0.1'],
          description: 'Array of domain names to exclude from results. Default: ["localhost", "127.0.0.1"] to filter local development. Add domains like "about:blank", "chrome://newtab" to exclude browser UI pages. Examples: ["localhost", "192.168.1.1"], ["example.com", "test.local"]',
        },
        min_duration_seconds: {
          type: 'number',
          default: 5,
          minimum: 0,
          description: 'Minimum visit duration to include. Visits shorter than this are filtered out as likely accidental clicks or quick tab switches. Default: 5 seconds. Use 0 to include all visits, 30+ to focus on sustained reading/usage. Recommended: keep default unless user requests otherwise.',
        },
      },
      required: [],
    },
  },
  {
    name: 'aw_get_daily_summary',
    description: `Provides a comprehensive overview of all activity for a specific day.

WHEN TO USE:
- User asks for a summary or overview of a day's activity
- Questions like "What did I do yesterday?" or "Summarize my day"
- Getting a holistic view combining apps, websites, and time patterns
- Daily review or retrospective analysis
- When you need both application AND web activity together

WHEN NOT TO USE:
- For detailed analysis of just applications → use aw_get_window_activity instead
- For detailed analysis of just websites → use aw_get_web_activity instead
- For multi-day periods → use aw_get_window_activity or aw_get_web_activity with appropriate time_period
- For real-time "today so far" updates → this works but may be less detailed than specific tools

CAPABILITIES:
- Combines window activity, web activity, and AFK detection into one summary
- Calculates total active time vs away-from-keyboard time
- Identifies top 5 applications with time and percentages
- Identifies top 5 websites with time and percentages
- Provides hour-by-hour activity breakdown showing when you were active
- Generates automatic insights (e.g., "High activity day", "Most used app: VS Code")
- Works even if some data sources are missing (gracefully degrades)

LIMITATIONS:
- Fixed to single day (cannot span multiple days)
- Limited to top 5 apps and websites (use specific tools for more)
- Cannot see detailed window titles or full URL lists
- Insights are basic pattern recognition, not deep analysis
- Requires at least some tracking data for the specified day
- AFK time calculation is approximate (total day - active time)

RETURNS:
- date: The date being summarized (YYYY-MM-DD)
- total_active_time_hours: Hours of active computer use
- total_afk_time_hours: Hours away from keyboard
- top_applications: Top 5 apps with duration and percentage
- top_websites: Top 5 websites with duration and percentage
- hourly_breakdown: Array of {hour, active_seconds, top_app} for each hour (if requested)
- insights: Array of auto-generated observations about the day

Always returns human-readable formatted summary optimized for user presentation.`,
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date to summarize in YYYY-MM-DD format. Examples: "2025-01-14", "2024-12-25". Defaults to today if omitted. Use "yesterday" in time_period tools for yesterday, or specify exact date here. Must be a date with available data (check with aw_get_capabilities for date ranges).',
        },
        include_hourly_breakdown: {
          type: 'boolean',
          default: true,
          description: 'Whether to include hour-by-hour (0-23) activity breakdown showing active time and top app for each hour. true (default): Include hourly data - recommended for understanding daily patterns. false: Omit hourly data for faster response - use when user only wants overall summary.',
        },
      },
      required: [],
    },
  },
  {
    name: 'aw_get_raw_events',
    description: `Retrieves raw, unprocessed events from a specific ActivityWatch data bucket.

WHEN TO USE:
- User needs exact timestamps for specific events
- Questions about precise timing (e.g., "What was I doing at exactly 2:15pm?")
- Debugging or troubleshooting data collection issues
- Exporting raw data for external analysis
- When high-level tools don't provide enough detail
- Advanced users who understand ActivityWatch bucket structure

WHEN NOT TO USE:
- For general activity analysis → use aw_get_window_activity, aw_get_web_activity, or aw_get_daily_summary
- When you don't know the bucket_id → use aw_get_capabilities first to discover buckets
- For aggregated statistics → high-level tools are more efficient
- For user-friendly summaries → this returns technical data

CAPABILITIES:
- Direct access to raw ActivityWatch event data
- Precise timestamp information for each event
- Full event metadata (all data fields preserved)
- Configurable result limit (1 to 10,000 events)
- Three response formats: concise (summary), detailed (formatted), raw (complete JSON)
- Works with any bucket type (window, web, AFK, custom)

LIMITATIONS:
- Requires knowing the exact bucket_id (use aw_get_capabilities to find it)
- Returns unprocessed data (no aggregation, filtering, or normalization)
- No automatic multi-device aggregation
- No automatic system app filtering
- Large result sets can be verbose (use limit parameter wisely)
- Requires manual interpretation of event data structure
- Time range must be specified in ISO 8601 format

RETURNS (depends on response_format):
- concise: Summary with first 10 events and total count
- detailed: Formatted event list with key fields
- raw: Complete unprocessed event array with all fields

IMPORTANT: This is a low-level tool. For most user queries, the high-level analysis tools (aw_get_window_activity, aw_get_web_activity, aw_get_daily_summary) are more appropriate and user-friendly.`,
    inputSchema: {
      type: 'object',
      properties: {
        bucket_id: {
          type: 'string',
          description: 'Exact bucket identifier from ActivityWatch. MUST call aw_get_capabilities first to get valid bucket IDs. Format: "aw-watcher-window_hostname" or "aw-watcher-web-chrome_hostname". Examples: "aw-watcher-window_my-laptop", "aw-watcher-web-chrome_desktop-pc". Do NOT guess - use exact ID from capabilities.',
        },
        start_time: {
          type: 'string',
          description: 'Start timestamp in ISO 8601 format with timezone. Required. Examples: "2025-01-14T09:00:00Z" (UTC), "2025-01-14T09:00:00-05:00" (EST), "2025-01-14T14:30:00+00:00". Must include time component. Must be before end_time.',
        },
        end_time: {
          type: 'string',
          description: 'End timestamp in ISO 8601 format with timezone. Required. Examples: "2025-01-14T17:00:00Z" (UTC), "2025-01-14T17:00:00-05:00" (EST), "2025-01-14T18:45:00+00:00". Must include time component. Must be after start_time. Recommended: limit to 24 hours or less for manageable results.',
        },
        limit: {
          type: 'number',
          default: 100,
          minimum: 1,
          maximum: 10000,
          description: 'Maximum number of events to return. Default: 100 (good for quick queries). Use 1000+ for comprehensive analysis. Maximum: 10000. Note: Large limits may return verbose data - consider using high-level tools instead for aggregated results.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed', 'raw'],
          default: 'concise',
          description: 'Output format. "concise" (default): Shows first 10 events with summary - good for preview. "detailed": Formatted event list with key fields - good for analysis. "raw": Complete unprocessed JSON with all metadata - use for debugging or export only.',
        },
      },
      required: ['bucket_id', 'start_time', 'end_time'],
    },
  },

];

/**
 * List tools handler
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

/**
 * Call tool handler
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info(`Tool called: ${name}`, { args });

  try {
    switch (name) {
      case 'aw_get_capabilities': {
        GetCapabilitiesSchema.parse(args); // Validate args (even though empty)
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

      case 'aw_get_window_activity': {
        const params = GetWindowActivitySchema.parse(args);
        const result = await windowService.getWindowActivity(params);

        logger.info('Window activity retrieved', {
          totalTime: result.total_time_seconds,
          appCount: result.applications.length,
        });

        if (params.response_format === 'concise') {
          return {
            content: [
              {
                type: 'text',
                text: windowService.formatConcise(result),
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

      case 'aw_get_web_activity': {
        const params = GetWebActivitySchema.parse(args);
        const result = await webService.getWebActivity(params);

        if (params.response_format === 'concise') {
          return {
            content: [
              {
                type: 'text',
                text: webService.formatConcise(result),
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

        // Validate bucket exists
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

        // Concise format
        return {
          content: [
            {
              type: 'text',
              text: formatRawEventsConcise(params.bucket_id, events),
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

/**
 * Start server
 */
async function main() {
  try {
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

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('ActivityWatch MCP server running on stdio');
  } catch (error) {
    logger.error('Failed to start server', error);
    throw error;
  }
}

main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});

