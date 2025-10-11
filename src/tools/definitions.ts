import { Tool } from "@modelcontextprotocol/sdk/types.js";
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

✅ **RECOMMENDED TOOL FOR ACCURATE TIME TRACKING**: This is the primary tool for activity analysis.
It provides accurate, enriched data by combining:
- Window activity (base layer - which apps were ACTIVELY FOCUSED)
- Browser activity (enrichment - only when browser window was ACTIVELY FOCUSED)
- Editor activity (enrichment - only when editor window was ACTIVELY FOCUSED)

🎯 **KEY ACCURACY FEATURE**:
Unlike raw bucket queries, this tool uses window-based filtering to ensure browser/editor
time only counts when those windows were actually active. A browser tab open for 30 minutes
but only viewed for 2 minutes will correctly show 2 minutes, not 30.

WHEN TO USE:
- User asks about time spent on applications, websites, or coding
- Questions like "What did I work on today?" or "How much time on GitHub?"
- Productivity analysis across apps, browsing, and coding
- When you need accurate "time spent" metrics
- When you need context about what was done in each application
- Any general activity analysis question

WHEN NOT TO USE:
- For comprehensive period or daily overview → use aw_get_period_summary instead
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
  - browser: {url, domain, title} (only in detailed format when browsing)
  - editor: {file, project, language, git} (only in detailed format when coding)
  - category: Category name (always included when categories are configured)
  - event_count, first_seen, last_seen
- time_range: {start, end} timestamps of analyzed period

Default response is human-readable summary. Use response_format='detailed' for full structured data with browser/editor enrichment.`,
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
          description: 'How to group results. Can be a single grouping option or an array for multi-level hierarchical grouping. Single options: "application": Group by app name (e.g., all Chrome windows together). "title": Group by window title (e.g., separate "Chrome - Gmail" from "Chrome - GitHub"). "category": Group by full category hierarchy (events can appear in multiple categories). "domain": Group by website domain (browser activity only). "project": Group by project/repository (editor activity only). "hour": Group by hour of day (00:00-01:00, 01:00-02:00, etc.). "category_top_level": Group by top-level category only (e.g., "Work", "Media"). "language": Group by programming language (editor activity only). Multi-level: Pass an array like ["category_top_level", "project"] to group by category, then by project within each category. The hierarchy is shown in the title field as "Category > Project".',
          oneOf: [
            {
              type: 'string',
              enum: ['application', 'title', 'category', 'domain', 'project', 'hour', 'category_top_level', 'language'],
              default: 'application',
            },
            {
              type: 'array',
              items: {
                type: 'string',
                enum: ['application', 'title', 'category', 'domain', 'project', 'hour', 'category_top_level', 'language'],
              },
              minItems: 2,
              maxItems: 3,
            },
          ],
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed'],
          default: 'concise',
          description: 'Output format. "concise": Human-readable text summary optimized for user presentation (recommended for most queries). "detailed": Full JSON with all fields including browser/editor enrichment, categories, and precise timestamps (use when user needs technical data or export).',
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
    name: 'aw_get_period_summary',
    description: `Provides a comprehensive overview of activity for various time periods with flexible detail levels.

WHEN TO USE:
- User asks for weekly, monthly, or rolling period summaries
- Questions like "What did I do this week?" or "Summarize my last 30 days"
- Getting activity trends over multiple days
- Comparing activity across different time periods
- When you need aggregated statistics beyond a single day

WHEN NOT TO USE:
- For detailed analysis with enrichment → use aw_get_activity instead
- For custom filtering or queries → use aw_query_events instead
- For low-level event inspection → use aw_get_raw_events instead

CAPABILITIES:
- Supports multiple period types: daily, weekly, monthly, last 24 hours, last 7 days, last 30 days
- Flexible detail levels: hourly, daily, weekly breakdowns, or none
- Combines window activity, web activity, and AFK detection
- Calculates total active time vs away-from-keyboard time
- Identifies top 5 applications and websites for the entire period
- Provides period-appropriate breakdowns (hourly for daily, daily for weekly, etc.)
- Generates automatic insights including averages and trends
- Works even if some data sources are missing (gracefully degrades)

PERIOD TYPES:
- "daily": Single day (00:00-23:59 in specified timezone)
- "weekly": Week from Monday to Sunday
- "monthly": Calendar month
- "last_24_hours": Rolling 24 hours from current time
- "last_7_days": Rolling 7 days from current time
- "last_30_days": Rolling 30 days from current time

DETAIL LEVELS:
- "hourly": Hour-by-hour breakdown (recommended for daily/24hr periods)
- "daily": Day-by-day breakdown (recommended for weekly/7-day/30-day periods)
- "weekly": Week-by-week breakdown (recommended for monthly periods)
- "none": No breakdown, just totals and top items
- Auto-selected if not specified based on period_type

LIMITATIONS:
- Cannot see detailed window titles or full URL lists
- Insights are basic pattern recognition, not deep analysis
- Requires at least some tracking data for the specified period
- Large periods with detailed breakdowns may take longer to process

RETURNS:
- period_type: The type of period summarized
- period_start/period_end: ISO timestamps of the period boundaries
- timezone: Timezone used for period boundaries
- total_active_time_hours: Hours of active computer use
- total_afk_time_hours: Hours away from keyboard
- top_applications: Top 5 apps with duration and percentage
- top_websites: Top 5 websites with duration and percentage
- top_categories: Top 5 categories (if configured)
- hourly_breakdown: Hour-by-hour data (if detail_level='hourly')
- daily_breakdown: Day-by-day data (if detail_level='daily')
- weekly_breakdown: Week-by-week data (if detail_level='weekly')
- insights: Array of auto-generated observations about the period

Always returns human-readable formatted summary optimized for user presentation.`,
    inputSchema: {
      type: 'object',
      properties: {
        period_type: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'last_24_hours', 'last_7_days', 'last_30_days'],
          description: 'Type of period to summarize. "daily": Single day. "weekly": Week (Mon-Sun). "monthly": Calendar month. "last_24_hours": Rolling 24 hours. "last_7_days": Rolling 7 days. "last_30_days": Rolling 30 days.',
        },
        date: {
          type: 'string',
          description: 'Reference date in YYYY-MM-DD format. For daily/weekly/monthly: the date within the period. For rolling periods: ignored (uses current time). Defaults to today. Examples: "2025-01-14", "2024-12-25".',
        },
        detail_level: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'none'],
          description: 'Level of detail for breakdown. "hourly": Hour-by-hour (best for daily/24hr). "daily": Day-by-day (best for weekly/7-day/30-day). "weekly": Week-by-week (best for monthly). "none": No breakdown. Auto-selected if omitted.',
        },
        timezone: {
          type: 'string',
          description: 'Timezone for period boundaries and display. Supports: IANA names (Europe/Dublin), abbreviations (IST, EST), or UTC offsets (UTC+1, UTC-5). Defaults to user preference or system timezone.',
        },
      },
      required: ['period_type'],
    },
  },
  {
    name: 'aw_get_calendar_events',
    description: `Surfaces scheduled meetings from ActivityWatch calendar import buckets (e.g., aw-import-ical_*).

WHEN TO USE:
- User asks "What meetings do I have today/this week?" or similar scheduling questions
- Need to cross-reference focus time with calendar obligations
- Highlight events even when AFK tracking marks the user as away (calendar always takes precedence)

WHEN NOT TO USE:
- For full productivity summaries → use aw_get_period_summary
- For raw bucket inspection → use aw_get_raw_events

CAPABILITIES:
- Finds all aw-import-ical buckets automatically
- Returns events even if AFK marked you away (calendar ORs with activity)
- Consolidates across multiple calendars/devices
- Filters by time range, search query, cancelled/all-day toggles
- Provides concise human summary or detailed breakdown with attendees and raw metadata

RETURNS:
- events: Normalized list with summary, start/end ISO timestamps, duration, location, status, attendees
- buckets: Calendar bucket IDs queried
- time_range: Start/end timestamps used for the query

LIMITATIONS:
- Only reads events already imported into ActivityWatch
- Does not modify calendar data or infer meeting quality
- Assumes calendar entries include start/end timestamps`,
    inputSchema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'last_30_days', 'custom'],
          description: 'Time window to inspect. Defaults to "today". Use "custom" with custom_start/custom_end for specific ranges.',
        },
        custom_start: {
          type: 'string',
          description: 'Custom range start (ISO 8601 or YYYY-MM-DD). Required when time_period="custom". Example: "2025-01-14T09:00:00Z".',
        },
        custom_end: {
          type: 'string',
          description: 'Custom range end (ISO 8601 or YYYY-MM-DD). Required when time_period="custom". Example: "2025-01-14T17:00:00Z".',
        },
        include_all_day: {
          type: 'boolean',
          default: true,
          description: 'Include all-day events (true by default). Set false to focus on timed meetings.',
        },
        include_cancelled: {
          type: 'boolean',
          default: false,
          description: 'Include cancelled events. Defaults to false so cancelled meetings are hidden.',
        },
        summary_query: {
          type: 'string',
          description: 'Case-insensitive substring filter applied to summary, location, description, or calendar name. Example: "standup".',
        },
        limit: {
          type: 'number',
          default: 50,
          minimum: 1,
          maximum: 200,
          description: 'Maximum number of events to return across all calendar buckets.',
        },
        response_format: {
          type: 'string',
          enum: ['concise', 'detailed', 'raw'],
          default: 'concise',
          description: 'Output verbosity. "concise" → human summary, "detailed" → expanded text, "raw" → JSON payload.',
        },
      },
      required: [],
    },
  },
  {
    name: 'aw_get_raw_events',
    description: `Retrieves raw, unprocessed events from a specific ActivityWatch data bucket.

⚠️ **DATA ACCURACY WARNING**:
- Browser/web buckets contain ALL tab activity (AFK-filtered only)
- Editor buckets contain ALL file activity (AFK-filtered only)
- These do NOT filter by whether the window was actively focused
- For accurate "time spent" metrics, use aw_get_activity instead
- Use this tool only for debugging, exploration, or when you need raw event data

WHEN TO USE:
- User needs exact timestamps for specific events
- Questions about precise timing (e.g., "What was I doing at exactly 2:15pm?")
- Debugging or troubleshooting data collection issues
- Exporting raw data for external analysis
- When high-level tools don't provide enough detail
- Advanced users who understand ActivityWatch bucket structure

WHEN NOT TO USE:
- For general activity analysis → use aw_get_activity or aw_get_period_summary (RECOMMENDED)
- For accurate "time spent" metrics → use aw_get_activity instead (RECOMMENDED)
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
- **Browser/editor buckets do NOT filter by active window** (only AFK-filtered)
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

IMPORTANT: This is a low-level tool. For most user queries, the high-level analysis tools (aw_get_activity, aw_get_period_summary) are more appropriate and user-friendly.`,
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

⚠️ **IMPORTANT DATA ACCURACY WARNING**:
- Browser/editor queries return ALL events from those buckets (AFK-filtered only)
- They do NOT filter by whether the browser/editor window was actually active
- A browser tab can be "open" for 30 minutes but only actively viewed for 2 minutes
- For accurate "time spent" analysis, use aw_get_activity instead (window-based filtering)
- Use this tool for enrichment/exploration, not primary time tracking

WHEN TO USE:
- Need to filter events by specific applications, domains, or titles
- Want to combine multiple filtering criteria (e.g., "Chrome activity on github.com")
- Need custom time-based queries beyond standard tools
- Advanced analysis requiring specific event filtering
- Building complex queries with AFK filtering and event merging
- Exploring what tabs/files were open (not necessarily active)
- When standard tools don't provide the exact filtering needed

WHEN NOT TO USE:
- For general activity overview → use aw_get_activity instead (RECOMMENDED)
- For accurate "time spent" metrics → use aw_get_activity instead (RECOMMENDED)
- For daily or multi-day summaries → use aw_get_period_summary instead
- When you need aggregated statistics → high-level tools are more efficient
- For simple queries → aw_get_activity is easier to use and more accurate

CAPABILITIES:
- **Flexible Query Types**: window, browser, editor, afk, or custom queries
- **Advanced Filtering**: Filter by apps, domains, titles, or exclude specific items
- **AFK Filtering**: Automatically filter out away-from-keyboard periods
- **Event Merging**: Combine consecutive similar events for cleaner results
- **Custom Queries**: Full control with ActivityWatch query language
- **Multi-bucket Support**: Automatically queries relevant buckets
- **Duration Filtering**: Filter out short events (noise reduction)

QUERY TYPES:
- "window": Query application/window events (AFK-filtered)
- "browser": Query web browsing events (AFK-filtered, NOT window-filtered)
- "editor": Query code editor events (AFK-filtered, NOT window-filtered)
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
   ⚠️ Returns time tab was open, not time window was active

2. VS Code excluding system files:
   query_type: "window"
   filter_apps: ["Code", "Visual Studio Code"]
   exclude_apps: ["Finder"]

3. All coding activity:
   query_type: "editor"
   merge_events: true
   ⚠️ Returns time files were open, not time editor window was active

RETURNS:
- events: Array of filtered events
- total_duration_seconds: Total time in filtered events (⚠️ may not equal active window time)
- query_used: The actual query executed (for debugging)
- buckets_queried: Which buckets were queried

LIMITATIONS:
- **Browser/editor queries do NOT filter by active window** (only AFK-filtered)
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

export { tools };
