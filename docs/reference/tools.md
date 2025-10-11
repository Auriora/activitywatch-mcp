# Tools Reference

**Last updated:** October 11, 2025

Complete reference for all ActivityWatch MCP tools with parameters, return values, and usage examples.

## Tool Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| [`aw_get_capabilities`](#aw_get_capabilities) | Discovery | **Always call first** - Check available data |
| [`aw_get_activity`](#aw_get_activity) | **Unified Analysis** | **Primary tool** - Apps, websites, and coding with enrichment |
| [`aw_get_calendar_events`](#aw_get_calendar_events) | Calendar | Surface meetings that override AFK |
| [`aw_get_period_summary`](#aw_get_period_summary) | Period Overview | Comprehensive daily/week/month summaries |
| [`aw_query_events`](#aw_query_events) | Custom Queries | Advanced filtering and custom queries |
| [`aw_get_raw_events`](#aw_get_raw_events) | Raw Data | Debugging and exact timestamps |
| **Category Management** | | |
| [`aw_list_categories`](#aw_list_categories) | List | Show configured categories |
| [`aw_add_category`](#aw_add_category) | Create | Add new category |
| [`aw_update_category`](#aw_update_category) | Modify | Update existing category |
| [`aw_delete_category`](#aw_delete_category) | Remove | Delete category |

---

## aw_get_capabilities

**Discover available ActivityWatch data and determine which tools can be used.**

### When to Use
- **Always call this tool first** in new conversations
- When user asks "what data do I have?" 
- When other tools fail with "no buckets found" errors
- To check date ranges of available data

### When NOT to Use
- For actual activity analysis (use specific activity tools instead)

### Parameters
**None** - Just call it to discover what's available.

### Returns
```typescript
{
  available_buckets: Array<{
    id: string;
    type: string; 
    description: string;
    device: string;
    earliest_data: string;    // ISO 8601 date
    latest_data: string;      // ISO 8601 date
  }>;
  capabilities: {
    has_window_tracking: boolean;
    has_browser_tracking: boolean;
    has_afk_detection: boolean;
    has_categories: boolean;
  };
  suggested_tools: string[];  // Tool names that work with available data
}
```

Focus vs meeting time:
- `focus_time_hours` reflects at-keyboard activity (AFK-filtered).
- `meeting_time_hours` includes scheduled meetings, even when you were marked AFK. Calendar-only portions are added without double-counting overlaps.

### Example
```json
{
  "tool": "aw_get_capabilities"
}
```

---

## aw_get_activity

**🌟 Recommended: Analyzes computer activity with unified window, browser, and editor data.**

### When to Use
- User asks about time spent on applications, websites, or coding
- Questions like "What did I work on today?" or "How much time on GitHub?"
- Productivity analysis across apps, browsing, and coding
- Any general activity analysis question

### When NOT to Use
- For comprehensive period overview → use `aw_get_period_summary` instead
- For exact event timestamps → use `aw_get_raw_events` instead

### Capabilities
- **Canonical Events**: Uses ActivityWatch's canonical events for accurate data
- **AFK Filtering**: Automatically filters to only active periods
- **Window-Based Filtering**: Browser/editor data only when those windows were active
- **No Double-Counting**: Prevents inflated metrics
- **Rich Enrichment**: Browser URLs/domains and editor files/projects
- **Calendar Overlay**: Merges meetings, annotates overlapping focus time, and adds calendar-only segments without double-counting

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `"today"` | Time period: `"today"`, `"yesterday"`, `"this_week"`, `"last_week"`, `"last_7_days"`, `"last_30_days"`, `"custom"` |
| `custom_start` | string | - | Start time for custom period (ISO 8601). Required when `time_period="custom"` |
| `custom_end` | string | - | End time for custom period (ISO 8601). Required when `time_period="custom"` |
| `top_n` | number | `10` | Number of top activities to return (1-100) |
| `group_by` | enum | `"application"` | Grouping: `"application"`, `"title"`, `"category"` (events can appear in multiple categories) |
| `exclude_system_apps` | boolean | `true` | Filter out system apps (Finder, Dock, etc.) |
| `min_duration_seconds` | number | `5` | Minimum event duration to include |
| `response_format` | enum | `"concise"` | Output format: `"concise"` (basic info), `"detailed"` (includes browser/editor enrichment) |

### Returns
```typescript
{
  total_time_seconds: number;          // Focus time plus meeting-only time (calendar overrides AFK)
  activities: Array<{
    app: string;                       // Application name
    title: string;                     // Window title
    duration_seconds: number;
    duration_hours: number;
    percentage: number;
    browser?: {                        // Only in detailed format when browsing
      url: string;
      domain: string;
      title: string;
    };
    editor?: {                         // Only in detailed format when coding
      file: string;
      project: string;
      language: string;
      git?: {
        branch: string;
        commit: string;
        repository: string;
      };
    };
    category?: string;                 // Always included when categories configured
    calendar?: Array<{
      meeting_id: string;
      summary: string;
      start: string;
      end: string;
      overlap_seconds: number;
      meeting_only_seconds?: number;
      status?: string;
      calendar?: string;
      location?: string;
    }>;
    meeting_overlap_seconds?: number;
    calendar_only?: boolean;
    event_count: number;
    first_seen: string;                // ISO 8601 timestamp
    last_seen: string;                 // ISO 8601 timestamp
  }>;
  time_range: {
    start: string;                     // ISO 8601 timestamp  
    end: string;                       // ISO 8601 timestamp
  };
  calendar_summary?: {
    focus_seconds: number;
    meeting_seconds: number;
    meeting_only_seconds: number;
    overlap_seconds: number;
    union_seconds: number;
    meeting_count: number;
  };
}
```

### Examples

**Today's activity (concise):**
```json
{
  "time_period": "today"
}
```

**Detailed view of this week with browser/editor enrichment:**
```json
{
  "time_period": "this_week",
  "response_format": "detailed",
  "top_n": 15
}
```

**Group by category:**
```json
{
  "time_period": "today",
  "group_by": "category",
  "response_format": "detailed"
}
```

---

## aw_get_calendar_events

**Surface calendar events imported by ActivityWatch (aw-import-ical_* buckets). Calendar entries always override AFK status—the schedule is ORed with activity so meetings still appear even when you were marked away.**

### When to Use
- Share upcoming or recent meetings for a specific day or range
- Cross-check focus time versus scheduled obligations
- Inspect which calendars are imported before building workflows around them

### When NOT to Use
- For full productivity summaries → prefer `aw_get_period_summary`
- For low-level bucket debugging → use `aw_get_raw_events`
- When no calendar importer is running (call `aw_get_capabilities` first)

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `today` | `"today"`, `"yesterday"`, `"this_week"`, `"last_week"`, `"last_7_days"`, `"last_30_days"`, `"custom"` |
| `custom_start` | string | — | ISO 8601 or `YYYY-MM-DD`. Required when `time_period="custom"` |
| `custom_end` | string | — | ISO 8601 or `YYYY-MM-DD`. Required when `time_period="custom"` |
| `include_all_day` | boolean | `true` | Include all-day blocks. Set `false` to focus on timed meetings |
| `include_cancelled` | boolean | `false` | Include events whose status is `cancelled` |
| `summary_query` | string | — | Case-insensitive substring filter against summary, location, description, or calendar name |
| `limit` | number | `50` | Maximum events to return across all calendar buckets (1–200) |
| `response_format` | enum | `concise` | `"concise"`, `"detailed"`, or `"raw"` |

### Returns

```typescript
{
  events: Array<{
    id: string;                 // Stable identifier per bucket
    summary: string;            // Meeting/event title
    start: string;              // ISO start time (UTC)
    end: string;                // ISO end time (UTC)
    duration_seconds: number;   // Computed duration (all-day defaults to 24h)
    status?: string;            // confirmed, tentative, cancelled, etc.
    all_day: boolean;
    location?: string;
    calendar?: string;          // Calendar/source label when available
    attendees?: Array<{
      name?: string;
      email?: string;
      response_status?: string;
      organizer?: boolean;
    }>;
    source_bucket: string;      // aw-import-ical bucket id
    metadata?: Record<string, unknown>; // Original event payload
  }>;
  buckets: string[];            // Calendar buckets that were queried
  time_range: {
    start: string;              // Range start in ISO 8601
    end: string;                // Range end in ISO 8601
  };
}
```

### Examples

**Today’s meetings (concise output):**
```json
{
  "time_period": "today"
}
```

**Detailed view for a specific date range without all-day blocks:**
```json
{
  "time_period": "custom",
  "custom_start": "2025-02-10T00:00:00Z",
  "custom_end": "2025-02-11T00:00:00Z",
  "include_all_day": false,
  "response_format": "detailed"
}
```

---

## aw_get_period_summary

**Provides comprehensive summaries for single-day and multi-day periods with flexible breakdowns.**

### When to Use
- Need a concise overview for a day, week, month, or rolling range
- Want top applications/websites and AFK balance across a period
- Need hourly, daily, or weekly breakdowns selected automatically or explicitly

### When NOT to Use
- For enriched per-activity details → use `aw_get_activity`
- For custom filtering or complex queries → use `aw_query_events`
- For raw event data → use `aw_get_raw_events`

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period_type` | enum | **required** | `"daily"`, `"weekly"`, `"monthly"`, `"last_24_hours"`, `"last_7_days"`, `"last_30_days"` |
| `date` | string | today | Reference date within the period (YYYY-MM-DD). Ignored for rolling periods. |
| `detail_level` | enum | auto | `"hourly"`, `"daily"`, `"weekly"`, or `"none"`. Auto-selected when omitted. |
| `timezone` | string | user preference | Timezone for period boundaries. Supports IANA names and offsets. |

### Returns
```typescript
{
  period_type: string;                 // Requested period type
  period_start: string;                // ISO 8601 timestamp
  period_end: string;                  // ISO 8601 timestamp
  timezone: string;
  total_active_time_hours: number;
  total_afk_time_hours: number;
  focus_time_hours?: number;          // Focus/at-keyboard time (AFK-filtered)
  meeting_time_hours?: number;        // Total scheduled meeting hours (overlap + calendar-only)
  top_applications: Array<{
    name: string;
    duration_hours: number;
    percentage: number;
  }>;
  top_websites: Array<{
    domain: string;
    duration_hours: number;
    percentage: number;
  }>;
  top_categories?: Array<{
    category_name: string;
    duration_hours: number;
    percentage: number;
    event_count: number;
  }>;
  hourly_breakdown?: Array<{
    hour: number;
    active_seconds: number;
    top_app?: string;
  }>;
  daily_breakdown?: Array<{
    date: string;
    active_seconds: number;
    afk_seconds: number;
    top_app?: string;
  }>;
  weekly_breakdown?: Array<{
    week_start: string;
    week_end: string;
    active_seconds: number;
    afk_seconds: number;
    top_app?: string;
  }>;
  insights: string[];
}
```

### Examples

**Daily summary (today):**
```json
{
  "period_type": "daily"
}
```

**Weekly overview anchored to a date:**
```json
{
  "period_type": "weekly",
  "date": "2025-01-13"
}
```

**Rolling 30 days with daily breakdown:**
```json
{
  "period_type": "last_30_days",
  "detail_level": "daily"
}
```

---

## aw_query_events

**Build and execute custom queries with flexible filtering.**

### When to Use
- Need to filter events by specific applications, domains, or titles
- Want to combine multiple filtering criteria
- Advanced analysis requiring specific event filtering
- When standard tools don't provide the exact filtering needed

### When NOT to Use
- For general activity overview → use `aw_get_activity` instead
- For daily or multi-day summaries → use `aw_get_period_summary` instead
- For simple queries → `aw_get_activity` is easier to use

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query_type` | enum | - | **Required**. Type: `"window"`, `"browser"`, `"editor"`, `"afk"`, `"custom"` |
| `start_time` | string | - | **Required**. Start timestamp (ISO 8601) |
| `end_time` | string | - | **Required**. End timestamp (ISO 8601) |
| `filter_afk` | boolean | `true` | Filter out AFK periods |
| `filter_apps` | array | - | Include only specific applications |
| `exclude_apps` | array | - | Exclude specific applications |
| `filter_domains` | array | - | Include only specific domains (browser queries) |
| `filter_titles` | array | - | Filter by title patterns (regex) |
| `merge_events` | boolean | `true` | Merge consecutive similar events |
| `min_duration_seconds` | number | `0` | Minimum event duration |
| `limit` | number | `1000` | Maximum events to return (1-10000) |
| `response_format` | enum | `"detailed"` | Output format: `"concise"`, `"detailed"`, `"raw"` |

### Returns
```typescript
{
  events: Array<AWEvent>;              // Filtered events
  total_duration_seconds: number;      // Total time in filtered events
  query_used: string[];                // The actual query executed
  buckets_queried: string[];           // Which buckets were queried
}
```

---

## aw_get_raw_events

**Retrieves raw, unprocessed events from a specific ActivityWatch bucket.**

### When to Use
- Need exact timestamps for specific events
- Questions about precise timing: "What was I doing at exactly 2:15pm?"
- Debugging data collection issues
- Exporting raw data for external analysis

### When NOT to Use
- For general activity analysis → use high-level tools instead
- When you don't know bucket_id → use `aw_get_capabilities` first

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bucket_id` | string | **required** | Exact bucket ID from aw_get_capabilities |
| `start_time` | string | **required** | Start timestamp (ISO 8601 with timezone) |
| `end_time` | string | **required** | End timestamp (ISO 8601 with timezone) |
| `limit` | number | `100` | Maximum events to return (1-10000) |
| `response_format` | enum | `"concise"` | Output format: `"concise"`, `"detailed"`, `"raw"` |

### Returns
```typescript
// Depends on response_format:
// "concise": Summary with first 10 events
// "detailed": Formatted event list  
// "raw": Complete unprocessed JSON array
{
  bucket_id: string;
  event_count: number;
  events: Array<{
    timestamp: string;                 // ISO 8601
    duration: number;                  // Seconds
    data: Record<string, any>;         // Bucket-specific data
  }>;
  time_range: {
    start: string;
    end: string;
  };
}
```

### Example
```json
{
  "bucket_id": "aw-watcher-window_my-laptop",
  "start_time": "2025-10-11T09:00:00Z",
  "end_time": "2025-10-11T17:00:00Z",
  "limit": 50
}
```

---

## Category Management Tools

### aw_list_categories

**Lists all configured categories with auto-reload from server.**

### Parameters
**None**

### Returns
```typescript
{
  categories: Array<{
    id: number;
    name: string;                      // Hierarchical display name
    name_array: string[];              // Name components
    rule: {
      type: "regex" | "none";
      regex?: string;
    };
    color?: string;                    // Hex color code
    score?: number;                    // Productivity score
  }>;
  total_count: number;
}
```

---

### aw_add_category

**Creates a new category with hierarchical name and regex pattern.**

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string[] | **Yes** | Hierarchical name (e.g., `["Work", "Email"]`) |
| `regex` | string | **Yes** | Regular expression pattern |
| `color` | string | No | Hex color code (e.g., `"#FF5733"`) |
| `score` | number | No | Productivity score |

### Returns
```typescript
{
  success: boolean;
  category: {
    id: number;                        // Assigned ID
    name: string;                      // Display name
    name_array: string[];
    rule: { type: "regex"; regex: string; };
    color?: string;
    score?: number;
  };
  message: string;
}
```

### Examples

**Basic category:**
```json
{
  "name": ["Work", "Email"],
  "regex": "gmail|outlook|thunderbird"
}
```

**With color and score:**
```json
{
  "name": ["Entertainment", "Gaming"],
  "regex": "steam|epic|gog",
  "color": "#9B59B6", 
  "score": -5
}
```

---

### aw_update_category

**Updates an existing category's name, regex, color, or score.**

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | **Yes** | Category ID to update |
| `name` | string[] | No | New hierarchical name |
| `regex` | string | No | New regex pattern |
| `color` | string | No | New hex color code |
| `score` | number | No | New productivity score |

### Returns
```typescript
{
  success: boolean;
  category: Category;                  // Updated category
  message: string;
}
```

### Examples

**Update regex only:**
```json
{
  "id": 5,
  "regex": "gmail|outlook|mail|thunderbird"
}
```

**Update everything:**
```json
{
  "id": 7,
  "name": ["Work", "Meetings"],
  "regex": "zoom|teams|meet|webex",
  "color": "#FFC107",
  "score": 6
}
```

---

### aw_delete_category

**Permanently deletes a category from ActivityWatch.**

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | **Yes** | Category ID to delete |

### Returns
```typescript
{
  success: boolean;
  message: string;
}
```

**⚠️ Warning:** Deletion is permanent and cannot be undone.

### Example
```json
{
  "id": 5
}
```

---

## Common Parameters Reference

### Time Periods

| Value | Description | Example Range |
|-------|-------------|---------------|
| `"today"` | Since midnight today | 2025-10-11 00:00 to now |
| `"yesterday"` | Previous day | 2025-10-10 00:00 to 23:59 |
| `"this_week"` | Monday to now | 2025-10-07 00:00 to now |
| `"last_week"` | Previous Monday-Sunday | 2025-09-30 to 2025-10-06 |
| `"last_7_days"` | Rolling 7 days | 2025-10-04 to now |
| `"last_30_days"` | Rolling 30 days | 2025-09-11 to now |
| `"custom"` | Specify custom_start/custom_end | User-defined |

### Response Formats

| Value | Description | Use Case |
|-------|-------------|----------|
| `"concise"` | Human-readable summary | User presentation (default) |
| `"detailed"` | Full JSON with all fields | Technical analysis |
| `"raw"` | Unprocessed data | Debugging (raw_events only) |

### Grouping Options

**Window Activity:**
- `"application"` - Group by app name (recommended)
- `"title"` - Group by window title (detailed)
- `"both"` - Show both levels

**Web Activity:**
- `"domain"` - Group by domain (recommended)  
- `"url"` - Group by full URL (detailed)
- `"title"` - Group by page title

**Editor Activity:**
- `"project"` - Group by project (recommended)
- `"file"` - Group by filename
- `"language"` - Group by programming language
- `"editor"` - Group by IDE/editor

---

## Usage Patterns

### Discovery Workflow
```
1. aw_get_capabilities          → Check available data
2. aw_get_period_summary        → Get overview  
3. aw_get_activity             → Detailed analysis
```

### Focused Analysis
```
1. aw_get_capabilities          → Confirm data availability
2. aw_get_window_activity       → App-focused analysis
   OR aw_get_web_activity       → Web-focused analysis  
   OR aw_get_editor_activity    → Coding-focused analysis
```

### Category Management
```
1. aw_list_categories           → See current categories
2. aw_add_category             → Create new categories
3. aw_get_period_summary       → See categorized breakdown
```

## Error Handling

### Common Error Messages

**"No buckets found"**
- **Cause:** ActivityWatch not running or no data collected
- **Solution:** Call `aw_get_capabilities` to check available data

**"Invalid time period"**
- **Cause:** Malformed custom_start/custom_end dates
- **Solution:** Use ISO 8601 format with timezone

**"Category not found"**
- **Cause:** Invalid category ID in update/delete
- **Solution:** Call `aw_list_categories` to get valid IDs

## Best Practices

1. **Always start with capabilities** - Call `aw_get_capabilities` first
2. **Use recommended tool** - `aw_get_activity` for general analysis
3. **Keep defaults** - Most parameters have sensible defaults
4. **Check data availability** - Verify date ranges before queries
5. **Use natural time periods** - Avoid custom dates when possible

## References

- [Canonical Events](../concepts/canonical-events.md) - How unified activity works
- [Categories](../concepts/categories.md) - Category classification system
- [ActivityWatch Integration](../reference/activitywatch-integration.md) - Integration details
