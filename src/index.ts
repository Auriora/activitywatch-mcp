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

/**
 * Initialize services
 */
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

// Log startup diagnostics
logStartupDiagnostics(AW_URL);

const client = new ActivityWatchClient(AW_URL);
const capabilitiesService = new CapabilitiesService(client);
const categoryService = new CategoryService(client);
const queryService = new QueryService(client, capabilitiesService);
const queryBuilderService = new QueryBuilderService(client, capabilitiesService);

// Always pass category service - it will handle the case when no categories are configured
// Categories are loaded asynchronously in main(), so we can't check hasCategories() here
const afkService = new AfkActivityService(client, capabilitiesService);
const unifiedService = new UnifiedActivityService(queryService, categoryService);

const dailySummaryService = new DailySummaryService(
  unifiedService,
  queryService,
  afkService,
  categoryService
);

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
    name: 'aw_get_activity',
    description: `Analyzes computer activity with unified window, browser, and editor data.

**RECOMMENDED TOOL**: This is the primary tool for activity analysis. It provides accurate, enriched data by combining:
- Window activity (base layer - which apps were active)
- Browser activity (enrichment - only when browser window was active)
- Editor activity (enrichment - only when editor window was active)

WHEN TO USE:
- User asks about time spent on applications, websites, or coding
- Questions like "What did I work on today?" or "How much time on GitHub?"
- Productivity analysis across apps, browsing, and coding
- When you need context about what was done in each application
- Any general activity analysis question

WHEN NOT TO USE:
- For comprehensive daily overview → use aw_get_daily_summary instead
- For exact event timestamps → use aw_get_raw_events instead
- If no window tracking data exists (check with aw_get_capabilities first)

CAPABILITIES:
- **CANONICAL EVENTS**: Uses ActivityWatch's canonical events approach for accurate data
- **AFK FILTERING**: Automatically filters to only active periods (when user is not AFK)
- **WINDOW-BASED FILTERING**: Browser/editor data only counted when those windows were active
- **NO DOUBLE-COUNTING**: Prevents inflated metrics by proper event intersection
- Combines data across multiple devices if available
- Filters out system applications by default
- Removes very short events (< 5 seconds by default)
- Groups by application or window title
- Enriches with browser URLs/domains when browsing
- Enriches with editor files/projects when coding
- Calculates total time, percentages, and rankings

HOW IT WORKS:
1. Gets window events (defines when each app was active) - AFK filtered
2. Gets browser events filtered to only when browser window was active
3. Gets editor events filtered to only when editor window was active
4. Merges browser/editor data into window events for enriched results

EXAMPLE OUTPUT:
{
  "app": "Google Chrome",
  "duration_hours": 2.5,
  "percentage": 50,
  "browser": {
    "domain": "github.com",
    "url": "https://github.com/ActivityWatch/activitywatch"
  }
}

LIMITATIONS:
- Cannot see page CONTENT or code CONTENT
- Cannot determine quality or productivity of work
- Only shows active window time (not background processes)
- **Only counts time when user is actively working (AFK periods excluded)**
- **Browser activity only counted when browser window was active**
- **Editor activity only counted when editor window was active**
- Requires window watcher to be installed and running
- Time periods limited to available data (check date ranges with aw_get_capabilities)

RETURNS:
- total_time_seconds: Total active time in the period (AFK-filtered)
- activities: Array of enriched activity events with:
  - app: Application name
  - title: Window title
  - duration_seconds, duration_hours, percentage
  - browser: {url, domain, title} (only when browsing)
  - editor: {file, project, language, git} (only when coding)
  - category: Category name (if categorization enabled)
  - event_count, first_seen, last_seen
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
          description: 'Number of top activities to return, ranked by time spent. Default: 10. Use 5 for quick overview, 20+ for comprehensive analysis. Maximum: 100.',
        },
        group_by: {
          type: 'string',
          enum: ['application', 'title'],
          default: 'application',
          description: 'How to group results. "application": Group by app name only (e.g., all Chrome windows together) - recommended for overview. "title": Group by window title (e.g., separate "Chrome - Gmail" from "Chrome - GitHub") - use for detailed analysis.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed'],
          default: 'concise',
          description: 'Output format. "concise": Human-readable text summary optimized for user presentation (recommended for most queries). "detailed": Full JSON with all fields including browser/editor enrichment and precise timestamps (use when user needs technical data or export).',
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
        include_categories: {
          type: 'boolean',
          default: false,
          description: 'Include category information for each activity. Shows which category each activity matches based on configured rules. Requires categories to be configured in ActivityWatch.',
        },
        include_browser_details: {
          type: 'boolean',
          default: true,
          description: 'Include browser enrichment (URLs, domains) when available. Set to false to exclude browser details and only show application usage.',
        },
        include_editor_details: {
          type: 'boolean',
          default: true,
          description: 'Include editor enrichment (files, projects, languages) when available. Set to false to exclude editor details and only show application usage.',
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
- For detailed analysis with enrichment → use aw_get_activity instead
- For multi-day periods → use aw_get_activity with appropriate time_period
- For custom filtering or queries → use aw_query_events instead

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
- For general activity analysis → use aw_get_activity or aw_get_daily_summary
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

IMPORTANT: This is a low-level tool. For most user queries, the high-level analysis tools (aw_get_activity, aw_get_daily_summary) are more appropriate and user-friendly.`,
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
  {
    name: 'aw_query_events',
    description: `Build and execute custom queries to retrieve ActivityWatch events with flexible filtering.

WHEN TO USE:
- Need to filter events by specific applications, domains, or titles
- Want to combine multiple filtering criteria (e.g., "Chrome activity on github.com")
- Need custom time-based queries beyond standard tools
- Advanced analysis requiring specific event filtering
- Building complex queries with AFK filtering and event merging
- When standard tools don't provide the exact filtering needed

WHEN NOT TO USE:
- For general activity overview → use aw_get_activity instead
- For daily summaries → use aw_get_daily_summary instead
- When you need aggregated statistics → high-level tools are more efficient
- For simple queries → aw_get_activity is easier to use

CAPABILITIES:
- **Flexible Query Types**: window, browser, editor, afk, or custom queries
- **Advanced Filtering**: Filter by apps, domains, titles, or exclude specific items
- **AFK Filtering**: Automatically filter out away-from-keyboard periods
- **Event Merging**: Combine consecutive similar events for cleaner results
- **Custom Queries**: Full control with ActivityWatch query language
- **Multi-bucket Support**: Automatically queries relevant buckets
- **Duration Filtering**: Filter out short events (noise reduction)

QUERY TYPES:
- "window": Query application/window events
- "browser": Query web browsing events
- "editor": Query code editor events
- "afk": Query AFK (away from keyboard) events
- "custom": Build custom query with full control

FILTERING OPTIONS:
- filter_afk: Remove AFK periods (default: true)
- filter_apps: Include only specific applications
- exclude_apps: Exclude specific applications
- filter_domains: Include only specific domains (browser queries)
- filter_titles: Filter by window/page title patterns
- min_duration_seconds: Filter out short events

EXAMPLES:
1. Chrome activity on GitHub:
   query_type: "browser"
   filter_domains: ["github.com"]

2. VS Code excluding system files:
   query_type: "window"
   filter_apps: ["Code", "Visual Studio Code"]
   exclude_apps: ["Finder"]

3. All coding activity:
   query_type: "editor"
   merge_events: true

RETURNS:
- events: Array of filtered events
- total_duration_seconds: Total time in filtered events
- query_used: The actual query executed (for debugging)
- buckets_queried: Which buckets were queried

LIMITATIONS:
- Requires understanding of query parameters
- Custom queries require knowledge of ActivityWatch query language
- Time range must be specified in ISO 8601 format
- Results limited by limit parameter (default: 1000)`,
    inputSchema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['window', 'browser', 'editor', 'afk', 'custom'],
          description: 'Type of query to build. "window": Query window/application events. "browser": Query web browsing events. "editor": Query code editor events. "afk": Query AFK (away from keyboard) events. "custom": Build a custom query with full control.',
        },
        start_time: {
          type: 'string',
          description: 'Start timestamp in ISO 8601 format. Examples: "2025-01-14T09:00:00Z", "2025-01-14T09:00:00-05:00". Must be before end_time.',
        },
        end_time: {
          type: 'string',
          description: 'End timestamp in ISO 8601 format. Examples: "2025-01-14T17:00:00Z", "2025-01-14T17:00:00-05:00". Must be after start_time.',
        },
        filter_afk: {
          type: 'boolean',
          default: true,
          description: 'Whether to filter out AFK (away from keyboard) periods. Default: true (only include active time). Set to false to include all time regardless of AFK status.',
        },
        filter_apps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter to only include specific applications. Example: ["Chrome", "Firefox", "Safari"]. Leave empty to include all apps.',
        },
        exclude_apps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude specific applications. Example: ["Finder", "Dock"]. Leave empty to not exclude any apps.',
        },
        filter_domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter to only include specific domains (for browser queries). Example: ["github.com", "stackoverflow.com"]. Leave empty to include all domains.',
        },
        filter_titles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter to only include events with titles matching these patterns (regex). Example: ["Gmail", "GitHub.*Pull Request"]. Leave empty to include all titles.',
        },
        merge_events: {
          type: 'boolean',
          default: true,
          description: 'Whether to merge consecutive similar events. Default: true (combines events with same app/title). Set to false to keep all events separate.',
        },
        min_duration_seconds: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Minimum event duration to include. Events shorter than this are filtered out. Default: 0 (include all). Use 5+ to filter noise.',
        },
        custom_query: {
          type: 'array',
          items: { type: 'string' },
          description: 'Custom ActivityWatch query language statements. Only used when query_type="custom". Example: ["events = query_bucket(\\"aw-watcher-window_hostname\\");", "RETURN = events;"]. Allows full control over query logic.',
        },
        bucket_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific bucket IDs to query. Only used when query_type="custom". Get bucket IDs from aw_get_capabilities. Example: ["aw-watcher-window_my-laptop", "aw-watcher-web-chrome_my-laptop"].',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 10000,
          default: 1000,
          description: 'Maximum number of events to return. Default: 1000. Use lower values for quick queries, higher for comprehensive analysis.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed', 'raw'],
          default: 'detailed',
          description: 'Output format. "concise": Summary with first 10 events. "detailed": Full event list with key fields. "raw": Complete unprocessed JSON.',
        },
      },
      required: ['query_type', 'start_time', 'end_time'],
    },
  },
  {
    name: 'aw_list_categories',
    description: `List all configured categories in ActivityWatch.

WHEN TO USE:
- User asks "what categories do I have?" or "show me my categories"
- Before adding/updating categories to see what exists
- To understand the current category structure
- To get category IDs for updates/deletions

CAPABILITIES:
- Automatically reloads categories from server to ensure latest data
- Lists all categories with their IDs, names, and rules
- Shows hierarchical category structure (e.g., "Work > Email")
- Displays regex patterns used for matching
- Returns categories from ActivityWatch server settings

RETURNS:
- Array of categories with id, name (hierarchical), and rule (regex pattern)

NO PARAMETERS REQUIRED - just call it to see all categories.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'aw_add_category',
    description: `Add a new category to ActivityWatch.

WHEN TO USE:
- User wants to create a new category for tracking specific activities
- To classify activities that aren't currently categorized
- To add subcategories to existing categories

CAPABILITIES:
- Creates a new category with a regex rule
- Supports hierarchical categories (e.g., ["Work", "Email"])
- Supports custom colors and productivity scores
- Automatically assigns a unique ID
- Saves to ActivityWatch server settings
- Makes category immediately available for classification

PARAMETERS:
- name: Array of strings for hierarchical name (e.g., ["Work", "Email"])
- regex: Regular expression pattern to match app names, window titles, or URLs
  - Example: "gmail|outlook|mail" matches Gmail, Outlook, or Mail apps
  - Case-insensitive matching
  - Use | for OR, .* for wildcards
- color: (Optional) Hex color code for dashboard visualization (e.g., "#FF5733")
- score: (Optional) Productivity score for the category (e.g., 10 for high productivity)

EXAMPLES:
- Add "Work > Email": name=["Work", "Email"], regex="gmail|outlook|mail", color="#4285F4"
- Add "Entertainment": name=["Entertainment"], regex="youtube|netflix|spotify", color="#FF0000", score=-5
- Add "Development > Python": name=["Development", "Python"], regex="python|pycharm|jupyter", color="#3776AB"

RETURNS:
- The newly created category with its assigned ID`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hierarchical category name (e.g., ["Work", "Email"])',
        },
        regex: {
          type: 'string',
          description: 'Regular expression pattern to match activities',
        },
        color: {
          type: 'string',
          description: 'Hex color code for visualization (e.g., "#FF5733")',
        },
        score: {
          type: 'number',
          description: 'Productivity score (positive for productive, negative for distracting)',
        },
      },
      required: ['name', 'regex'],
    },
  },
  {
    name: 'aw_update_category',
    description: `Update an existing category in ActivityWatch.

WHEN TO USE:
- User wants to modify a category's name, regex pattern, color, or score
- To fix or improve category matching rules
- To reorganize category hierarchy
- To change category colors for better visualization

CAPABILITIES:
- Updates category name, regex pattern, color, and/or score
- Preserves category ID
- Saves changes to ActivityWatch server settings
- Changes take effect immediately

PARAMETERS:
- id: Category ID (get from aw_list_categories)
- name: (Optional) New hierarchical name
- regex: (Optional) New regex pattern
- color: (Optional) New hex color code (e.g., "#FF5733")
- score: (Optional) New productivity score

EXAMPLES:
- Update regex: id=5, regex="gmail|outlook|mail|thunderbird"
- Rename category: id=3, name=["Work", "Meetings"]
- Update color: id=7, color="#FF5733"
- Update all: id=7, name=["Entertainment", "Gaming"], regex="steam|epic|gog", color="#9B59B6", score=-3

RETURNS:
- The updated category`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Category ID to update',
        },
        name: {
          type: 'array',
          items: { type: 'string' },
          description: 'New hierarchical category name (optional)',
        },
        regex: {
          type: 'string',
          description: 'New regular expression pattern (optional)',
        },
        color: {
          type: 'string',
          description: 'New hex color code (optional, e.g., "#FF5733")',
        },
        score: {
          type: 'number',
          description: 'New productivity score (optional)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'aw_delete_category',
    description: `Delete a category from ActivityWatch.

WHEN TO USE:
- User wants to remove a category they no longer need
- To clean up unused or duplicate categories
- To reorganize category structure

CAPABILITIES:
- Permanently deletes a category by ID
- Saves changes to ActivityWatch server settings
- Cannot be undone (category is removed from server)

PARAMETERS:
- id: Category ID to delete (get from aw_list_categories)

WARNING:
- This permanently removes the category from ActivityWatch
- Historical data is not affected, but future classification won't use this category
- Cannot be undone

RETURNS:
- Success message with deleted category name`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Category ID to delete',
        },
      },
      required: ['id'],
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

      case 'aw_get_activity': {
        const params = args as any; // Will create proper schema later
        const result = await unifiedService.getActivity(params);

        logger.info('Unified activity retrieved', {
          totalTime: result.total_time_seconds,
          activityCount: result.activities.length,
        });

        if (params.response_format === 'concise') {
          // Format concise output
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

            if (activity.browser) {
              lines.push(`- **Browser**: ${activity.browser.domain}`);
              if (activity.browser.url && !activity.browser.url.includes(' URLs')) {
                lines.push(`  - URL: ${activity.browser.url}`);
              }
            }

            if (activity.editor) {
              lines.push(`- **Editor**: ${activity.editor.file}`);
              if (activity.editor.project) {
                lines.push(`  - Project: ${activity.editor.project}`);
              }
              if (activity.editor.language) {
                lines.push(`  - Language: ${activity.editor.language}`);
              }
            }

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

        // Concise format
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

        // Reload categories from server to ensure we have the latest
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

/**
 * Start server
 */
async function main() {
  try {
    // Load categories from ActivityWatch server (with fallback to environment variable)
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

