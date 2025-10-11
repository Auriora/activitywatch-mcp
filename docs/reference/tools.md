# Tools Reference

**Last updated:** October 11, 2025

Complete reference for all ActivityWatch MCP tools with parameters, return values, and usage examples.

## Tool Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| [`aw_get_capabilities`](#aw_get_capabilities) | Discovery | **Always call first** - Check available data |
| [`aw_get_activity`](#aw_get_activity) | **Unified Analysis** | **Recommended** - General activity with enrichment |
| [`aw_get_daily_summary`](#aw_get_daily_summary) | Overview | Daily comprehensive summary |
| [`aw_get_window_activity`](#aw_get_window_activity) | Applications | Focused app usage analysis |
| [`aw_get_web_activity`](#aw_get_web_activity) | Websites | Focused web browsing analysis |
| [`aw_get_editor_activity`](#aw_get_editor_activity) | Coding | Focused IDE/editor analysis |
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
- For comprehensive daily overview → use `aw_get_daily_summary` instead
- For exact event timestamps → use `aw_get_raw_events` instead

### Capabilities
- **Canonical Events**: Uses ActivityWatch's canonical events for accurate data
- **AFK Filtering**: Automatically filters to only active periods
- **Window-Based Filtering**: Browser/editor data only when those windows were active
- **No Double-Counting**: Prevents inflated metrics
- **Rich Enrichment**: Browser URLs/domains and editor files/projects

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `"today"` | Time period: `"today"`, `"yesterday"`, `"this_week"`, `"last_week"`, `"last_7_days"`, `"last_30_days"`, `"custom"` |
| `custom_start` | string | - | Start time for custom period (ISO 8601). Required when `time_period="custom"` |
| `custom_end` | string | - | End time for custom period (ISO 8601). Required when `time_period="custom"` |
| `top_n` | number | `10` | Number of top activities to return (1-100) |
| `group_by` | enum | `"application"` | Grouping: `"application"`, `"title"` |
| `include_browser_details` | boolean | `true` | Include browser URLs/domains when available |
| `include_editor_details` | boolean | `true` | Include editor files/projects when available |
| `include_categories` | boolean | `false` | Include category information |
| `exclude_system_apps` | boolean | `true` | Filter out system apps (Finder, Dock, etc.) |
| `min_duration_seconds` | number | `5` | Minimum event duration to include |
| `response_format` | enum | `"concise"` | Output format: `"concise"`, `"detailed"` |

### Returns
```typescript
{
  total_time_seconds: number;          // Total active time (AFK-filtered)
  activities: Array<{
    app: string;                       // Application name
    title: string;                     // Window title
    duration_seconds: number;
    duration_hours: number;
    percentage: number;
    browser?: {                        // Only when browsing
      url: string;
      domain: string;
      title: string;
    };
    editor?: {                         // Only when coding
      file: string;
      project: string;
      language: string;
      git?: {
        branch: string;
        commit: string;
        repository: string;
      };
    };
    category?: string;                 // If include_categories=true
    event_count: number;
    first_seen: string;                // ISO 8601 timestamp
    last_seen: string;                 // ISO 8601 timestamp
  }>;
  time_range: {
    start: string;                     // ISO 8601 timestamp  
    end: string;                       // ISO 8601 timestamp
  };
}
```

### Examples

**Today's activity with enrichment:**
```json
{
  "time_period": "today",
  "include_browser_details": true,
  "include_editor_details": true,
  "include_categories": true
}
```

**Detailed view of this week:**
```json
{
  "time_period": "this_week", 
  "response_format": "detailed",
  "top_n": 15
}
```

---

## aw_get_daily_summary

**Provides comprehensive overview of all activity for a specific day.**

### When to Use
- User asks for summary/overview: "What did I do yesterday?"
- Daily review or retrospective analysis
- Getting holistic view combining apps, websites, and time patterns

### When NOT to Use
- For detailed analysis of just applications → use `aw_get_window_activity`
- For detailed analysis of just websites → use `aw_get_web_activity`
- For multi-day periods → use other tools with appropriate time_period

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string | today | Date to summarize (YYYY-MM-DD format) |
| `include_hourly_breakdown` | boolean | `true` | Include hour-by-hour activity breakdown |

### Returns
```typescript
{
  date: string;                        // YYYY-MM-DD
  total_active_time_hours: number;     // Hours of active use
  total_afk_time_hours: number;        // Hours away from keyboard
  top_applications: Array<{            // Top 5 apps
    name: string;
    duration_hours: number;
    percentage: number;
  }>;
  top_websites: Array<{               // Top 5 websites
    domain: string;
    duration_hours: number; 
    percentage: number;
  }>;
  top_categories?: Array<{            // If categories configured
    category_name: string;
    duration_hours: number;
    percentage: number;
    event_count: number;
  }>;
  hourly_breakdown?: Array<{          // If include_hourly_breakdown=true
    hour: number;                     // 0-23
    active_seconds: number;
    top_app?: string;
  }>;
  insights: string[];                 // Auto-generated observations
}
```

### Examples

**Yesterday's summary:**
```json
{
  "date": "2025-10-10"
}
```

**Today without hourly breakdown:**
```json
{
  "include_hourly_breakdown": false
}
```

---

## aw_get_window_activity

**Analyzes application and window usage over a time period.**

### When to Use
- User asks about time in specific applications: "How long did I use VS Code?"
- Productivity analysis focused on application usage
- Comparing application usage across time periods

### When NOT to Use  
- For website/browser activity → use `aw_get_web_activity` instead
- For comprehensive daily overview → use `aw_get_daily_summary` instead
- For unified analysis with enrichment → use `aw_get_activity` instead

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `"today"` | Time period (same options as aw_get_activity) |
| `custom_start` | string | - | Start time for custom period |
| `custom_end` | string | - | End time for custom period |
| `top_n` | number | `10` | Number of top applications (1-100) |
| `group_by` | enum | `"application"` | Grouping: `"application"`, `"title"`, `"both"` |
| `include_categories` | boolean | `false` | Include category information |
| `exclude_system_apps` | boolean | `true` | Filter out system applications |
| `min_duration_seconds` | number | `5` | Minimum event duration |
| `response_format` | enum | `"concise"` | Output format: `"concise"`, `"detailed"` |

### Returns
```typescript
{
  total_time_seconds: number;          // Total active time (AFK-filtered)
  applications: Array<{
    name: string;                      // Application name
    duration_seconds: number;
    duration_hours: number;
    percentage: number;
    window_titles?: string[];          // If group_by="both" or detailed
    category?: string;                 // If include_categories=true
    event_count?: number;              // If response_format="detailed"
    first_seen?: string;               // If response_format="detailed"
    last_seen?: string;                // If response_format="detailed"
  }>;
  time_range: {
    start: string;
    end: string;
  };
}
```

---

## aw_get_web_activity

**Analyzes web browsing and website usage over a time period.**

### When to Use
- User asks about time on specific websites or domains
- Analyzing browsing patterns or habits
- Identifying most-visited websites

### When NOT to Use
- For application usage (non-browser) → use `aw_get_window_activity` instead
- For comprehensive daily overview → use `aw_get_daily_summary` instead
- For unified analysis with enrichment → use `aw_get_activity` instead

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `"today"` | Time period (same options as aw_get_activity) |
| `custom_start` | string | - | Start time for custom period |
| `custom_end` | string | - | End time for custom period |
| `top_n` | number | `10` | Number of top websites (1-100) |
| `group_by` | enum | `"domain"` | Grouping: `"domain"`, `"url"`, `"title"` |
| `include_categories` | boolean | `false` | Include category information |
| `exclude_domains` | array | `["localhost", "127.0.0.1"]` | Domain names to exclude |
| `min_duration_seconds` | number | `5` | Minimum visit duration |
| `response_format` | enum | `"concise"` | Output format: `"concise"`, `"detailed"` |

### Returns
```typescript
{
  total_time_seconds: number;          // Total browsing time (AFK-filtered)
  websites: Array<{
    domain: string;                    // Domain name
    url?: string;                      // Full URL (if group_by="url")
    title?: string;                    // Page title (if group_by="title")
    duration_seconds: number;
    duration_hours: number;
    percentage: number;
    category?: string;                 // If include_categories=true
    event_count?: number;              // If response_format="detailed"
    first_seen?: string;               // If response_format="detailed"
    last_seen?: string;                // If response_format="detailed"
    audible?: boolean;                 // If response_format="detailed"
    incognito?: boolean;               // If response_format="detailed"
    tab_count_avg?: number;            // If response_format="detailed"
  }>;
  time_range: {
    start: string;
    end: string;
  };
}
```

---

## aw_get_editor_activity

**Analyzes IDE and editor activity over a time period.**

### When to Use
- User asks about coding/development time: "What did I code today?"
- Questions about time in specific projects or files
- Analyzing development patterns across IDEs/editors

### When NOT to Use
- For general application usage → use `aw_get_window_activity` instead
- For browser-based coding → use `aw_get_web_activity` instead
- For unified analysis with enrichment → use `aw_get_activity` instead

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `time_period` | enum | `"today"` | Time period (same options as aw_get_activity) |
| `custom_start` | string | - | Start time for custom period |
| `custom_end` | string | - | End time for custom period |
| `top_n` | number | `10` | Number of top items (1-100) |
| `group_by` | enum | `"project"` | Grouping: `"project"`, `"file"`, `"language"`, `"editor"` |
| `include_categories` | boolean | `false` | Include category information |
| `include_git_info` | boolean | `false` | Include git metadata (detailed mode only) |
| `min_duration_seconds` | number | `5` | Minimum event duration |
| `response_format` | enum | `"concise"` | Output format: `"concise"`, `"detailed"` |

### Returns
```typescript
{
  total_time_seconds: number;          // Total editing time (AFK-filtered)
  editors: Array<{
    name: string;                      // Project/file/language/editor name
    duration_seconds: number;
    duration_hours: number;
    percentage: number;
    projects?: string[];               // If grouping shows multiple
    files?: string[];                  // If grouping shows multiple
    languages?: string[];              // If grouping shows multiple
    git_info?: {                       // If include_git_info=true
      branch?: string;
      commit?: string;
      repository?: string;
    };
    category?: string;                 // If include_categories=true
    event_count?: number;              // If response_format="detailed"
    first_seen?: string;               // If response_format="detailed"
    last_seen?: string;                // If response_format="detailed"
    editor_version?: string;           // If response_format="detailed"
    state_breakdown?: {                // If response_format="detailed"
      [state: string]: number;
    };
  }>;
  time_range: {
    start: string;
    end: string;
  };
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
2. aw_get_daily_summary         → Get overview  
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
3. aw_get_daily_summary        → See categorized breakdown
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
