/**
 * Zod schemas for MCP tool parameters
 */

import { z } from 'zod';

/**
 * Common schemas
 */

export const TimePeriodSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'last_7_days',
  'last_30_days',
  'custom',
]);

export const ResponseFormatSchema = z.enum(['concise', 'detailed', 'raw']);

/**
 * Tool parameter schemas
 */

export const GetCapabilitiesSchema = z.object({});

export const GetWindowActivitySchema = z.object({
  time_period: TimePeriodSchema.default('today').describe(
    'Time period to analyze. Use "custom" only if user specifies exact dates.'
  ),
  custom_start: z.string().optional().describe(
    'Start date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  custom_end: z.string().optional().describe(
    'End date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  top_n: z.number().min(1).max(100).default(10).describe(
    'Number of top applications to return'
  ),
  group_by: z.enum(['application', 'title', 'both']).default('application').describe(
    'How to group window activity. "application" groups by app name (recommended for overview).'
  ),
  response_format: ResponseFormatSchema.default('concise').describe(
    'Response verbosity: "concise" for human-readable summary (recommended), "detailed" for technical data'
  ),
  exclude_system_apps: z.boolean().default(true).describe(
    'Exclude system applications (Finder, Dock, etc.)'
  ),
  min_duration_seconds: z.number().min(0).default(5).describe(
    'Filter out very short events (likely accidental). Default: 5 seconds'
  ),
  include_categories: z.boolean().default(false).describe(
    'Include category information for each application. Shows which category each app matches based on configured rules.'
  ),
});

export const GetWebActivitySchema = z.object({
  time_period: TimePeriodSchema.default('today').describe(
    'Time period to analyze. Use "custom" only if user specifies exact dates.'
  ),
  custom_start: z.string().optional().describe(
    'Start date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  custom_end: z.string().optional().describe(
    'End date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  top_n: z.number().min(1).max(100).default(10).describe(
    'Number of top websites to return'
  ),
  group_by: z.enum(['domain', 'url', 'title']).default('domain').describe(
    'How to group web activity. "domain" is recommended for overview.'
  ),
  response_format: ResponseFormatSchema.default('concise').describe(
    'Response verbosity: "concise" for human-readable summary (recommended), "detailed" for technical data'
  ),
  exclude_domains: z.array(z.string()).default(['localhost', '127.0.0.1']).describe(
    'Domains to exclude from results. Defaults exclude local development.'
  ),
  min_duration_seconds: z.number().min(0).default(5).describe(
    'Filter out very short visits (likely accidental). Default: 5 seconds'
  ),
  include_categories: z.boolean().default(false).describe(
    'Include category information for each website. Shows which category each site matches based on configured rules.'
  ),
});

export const GetEditorActivitySchema = z.object({
  time_period: TimePeriodSchema.default('today').describe(
    'Time period to analyze. Use "custom" only if user specifies exact dates.'
  ),
  custom_start: z.string().optional().describe(
    'Start date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  custom_end: z.string().optional().describe(
    'End date for custom period (ISO 8601 or YYYY-MM-DD format)'
  ),
  top_n: z.number().min(1).max(100).default(10).describe(
    'Number of top items to return'
  ),
  group_by: z.enum(['project', 'file', 'language', 'editor']).default('project').describe(
    'How to group editor activity. "project" groups by project name, "file" by filename, "language" by programming language, "editor" by IDE/editor.'
  ),
  response_format: ResponseFormatSchema.default('concise').describe(
    'Response verbosity: "concise" for human-readable summary (recommended), "detailed" for technical data with git info'
  ),
  min_duration_seconds: z.number().min(0).default(5).describe(
    'Filter out very short events (likely accidental). Default: 5 seconds'
  ),
  include_git_info: z.boolean().default(false).describe(
    'Include git branch/commit information in detailed view. Only works with response_format="detailed".'
  ),
  include_categories: z.boolean().default(false).describe(
    'Include category information for each project/file/language. Shows which category each item matches based on configured rules.'
  ),
});

export const GetDailySummarySchema = z.object({
  date: z.string().optional().describe(
    'Date to summarize (YYYY-MM-DD format). Defaults to today.'
  ),
  include_hourly_breakdown: z.boolean().default(true).describe(
    'Include hour-by-hour activity breakdown'
  ),
});

export const GetRawEventsSchema = z.object({
  bucket_id: z.string().describe(
    'Bucket identifier (use aw_get_capabilities to discover available buckets)'
  ),
  start_time: z.string().describe(
    'Start time (ISO 8601 format)'
  ),
  end_time: z.string().describe(
    'End time (ISO 8601 format)'
  ),
  limit: z.number().min(1).max(10000).default(100).describe(
    'Maximum events to return. Use pagination for larger datasets.'
  ),
  response_format: ResponseFormatSchema.default('concise').describe(
    'Response verbosity: "concise" for summary, "detailed" for more info, "raw" for complete data'
  ),
});

export const QueryEventsSchema = z.object({
  query_type: z.enum(['window', 'browser', 'editor', 'afk', 'custom']).describe(
    'Type of query to build. "window": Query window/application events. "browser": Query web browsing events. "editor": Query code editor events. "afk": Query AFK (away from keyboard) events. "custom": Build a custom query with full control.'
  ),
  start_time: z.string().describe(
    'Start timestamp in ISO 8601 format. Examples: "2025-01-14T09:00:00Z", "2025-01-14T09:00:00-05:00". Must be before end_time.'
  ),
  end_time: z.string().describe(
    'End timestamp in ISO 8601 format. Examples: "2025-01-14T17:00:00Z", "2025-01-14T17:00:00-05:00". Must be after start_time.'
  ),

  // Filtering options
  filter_afk: z.boolean().default(true).describe(
    'Whether to filter out AFK (away from keyboard) periods. Default: true (only include active time). Set to false to include all time regardless of AFK status.'
  ),
  filter_apps: z.array(z.string()).optional().describe(
    'Filter to only include specific applications. Example: ["Chrome", "Firefox", "Safari"]. Leave empty to include all apps.'
  ),
  exclude_apps: z.array(z.string()).optional().describe(
    'Exclude specific applications. Example: ["Finder", "Dock"]. Leave empty to not exclude any apps.'
  ),
  filter_domains: z.array(z.string()).optional().describe(
    'Filter to only include specific domains (for browser queries). Example: ["github.com", "stackoverflow.com"]. Leave empty to include all domains.'
  ),
  filter_titles: z.array(z.string()).optional().describe(
    'Filter to only include events with titles matching these patterns (regex). Example: ["Gmail", "GitHub.*Pull Request"]. Leave empty to include all titles.'
  ),

  // Aggregation options
  merge_events: z.boolean().default(true).describe(
    'Whether to merge consecutive similar events. Default: true (combines events with same app/title). Set to false to keep all events separate.'
  ),
  min_duration_seconds: z.number().min(0).default(0).describe(
    'Minimum event duration to include. Events shorter than this are filtered out. Default: 0 (include all). Use 5+ to filter noise.'
  ),

  // Custom query (for advanced users)
  custom_query: z.array(z.string()).optional().describe(
    'Custom ActivityWatch query language statements. Only used when query_type="custom". Example: ["events = query_bucket(\\"aw-watcher-window_hostname\\");", "RETURN = events;"]. Allows full control over query logic.'
  ),
  bucket_ids: z.array(z.string()).optional().describe(
    'Specific bucket IDs to query. Only used when query_type="custom". Get bucket IDs from aw_get_capabilities. Example: ["aw-watcher-window_my-laptop", "aw-watcher-web-chrome_my-laptop"].'
  ),

  // Output options
  limit: z.number().min(1).max(10000).default(1000).describe(
    'Maximum number of events to return. Default: 1000. Use lower values for quick queries, higher for comprehensive analysis.'
  ),
  response_format: ResponseFormatSchema.default('detailed').describe(
    'Output format. "concise": Summary with first 10 events. "detailed": Full event list with key fields. "raw": Complete unprocessed JSON.'
  ),
});

/**
 * Type exports
 */

export type GetCapabilitiesParams = z.infer<typeof GetCapabilitiesSchema>;
export type GetWindowActivityParams = z.infer<typeof GetWindowActivitySchema>;
export type GetWebActivityParams = z.infer<typeof GetWebActivitySchema>;
export type GetEditorActivityParams = z.infer<typeof GetEditorActivitySchema>;
export type GetDailySummaryParams = z.infer<typeof GetDailySummarySchema>;
export type GetRawEventsParams = z.infer<typeof GetRawEventsSchema>;
export type QueryEventsParams = z.infer<typeof QueryEventsSchema>;

