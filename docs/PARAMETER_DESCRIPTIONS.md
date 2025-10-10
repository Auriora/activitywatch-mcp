# Enhanced Parameter Descriptions - Review Summary

This document details the improvements made to all parameter descriptions to ensure LLMs can populate them correctly on the first attempt.

## Principles Applied

### 1. **Concrete Examples**
Every parameter now includes real-world examples showing exact format and values.

### 2. **Format Specifications**
Clear format requirements with multiple accepted formats where applicable.

### 3. **Default Behavior**
Explicit explanation of what happens when parameter is omitted.

### 4. **Validation Rules**
Clear constraints, minimums, maximums, and relationships between parameters.

### 5. **Usage Guidance**
When to use specific values and why.

### 6. **Anti-Patterns**
What NOT to do (e.g., "Do NOT guess bucket_id").

## Parameter-by-Parameter Review

### Common Parameters (Window & Web Activity)

#### `time_period`
**Before:**
```
Time period to analyze. Use "custom" only if user specifies exact dates.
```

**After:**
```
Time period to analyze. Options: "today" (since midnight), "yesterday" (previous day), 
"this_week" (Monday to now), "last_week" (previous Monday-Sunday), "last_7_days" 
(rolling 7 days), "last_30_days" (rolling 30 days), "custom" (requires custom_start 
and custom_end). Use natural periods unless user specifies exact dates.
```

**Improvements:**
- ✅ Explains what each option means
- ✅ Clarifies "this_week" starts Monday
- ✅ Distinguishes calendar week vs rolling days
- ✅ States dependency on custom_start/custom_end

---

#### `custom_start` & `custom_end`
**Before:**
```
Start date for custom period (ISO 8601 or YYYY-MM-DD format)
```

**After:**
```
Start date/time for custom period. Required only when time_period="custom". 
Formats: ISO 8601 ("2025-01-14T09:00:00Z") or simple date ("2025-01-14" assumes 00:00:00). 
Examples: "2025-01-14", "2025-01-14T14:30:00Z"
```

**Improvements:**
- ✅ Concrete examples with actual dates
- ✅ Explains when required (conditional)
- ✅ Shows both formats with examples
- ✅ Clarifies default time when date-only
- ✅ Specifies relationship (end must be after start)

---

#### `top_n`
**Before:**
```
Number of top applications to return
```

**After:**
```
Number of top applications to return, ranked by time spent. Default: 10. 
Use 5 for quick overview, 20+ for comprehensive analysis. Maximum: 100.
```

**Improvements:**
- ✅ Explains ranking criteria (by time spent)
- ✅ States default value
- ✅ Provides usage guidance (5 vs 20+)
- ✅ States maximum limit
- ✅ Helps LLM choose appropriate value

---

#### `group_by` (Window Activity)
**Before:**
```
How to group window activity. "application" groups by app name (recommended for overview).
```

**After:**
```
How to group results. "application": Group by app name only (e.g., all Chrome windows 
together) - recommended for overview. "title": Group by window title (e.g., separate 
"Chrome - Gmail" from "Chrome - GitHub") - use for detailed analysis. "both": Show 
both levels of grouping.
```

**Improvements:**
- ✅ Concrete examples for each option
- ✅ Shows what "together" means
- ✅ Explains when to use each option
- ✅ Clarifies "both" option behavior

---

#### `group_by` (Web Activity)
**Before:**
```
How to group web activity. "domain" is recommended for overview.
```

**After:**
```
How to group results. "domain": Group by domain name (e.g., all github.com pages together) 
- recommended for overview. "url": Group by full URL (e.g., separate github.com/user/repo1 
from github.com/user/repo2) - use for detailed page-level analysis. "title": Group by 
page title - use when user asks about specific page names.
```

**Improvements:**
- ✅ Concrete examples showing difference
- ✅ Explains granularity levels
- ✅ Clear use case for each option
- ✅ Helps LLM match user intent

---

#### `response_format`
**Before:**
```
Response verbosity: "concise" for human-readable summary (recommended), "detailed" for technical data
```

**After:**
```
Output format. "concise": Human-readable text summary optimized for user presentation 
(recommended for most queries). "detailed": Full JSON with all fields including window_titles 
array and precise timestamps (use when user needs technical data or export).
```

**Improvements:**
- ✅ Explains what "optimized for user presentation" means
- ✅ Lists specific fields in detailed mode
- ✅ Clear use cases (presentation vs export)
- ✅ Stronger recommendation for default

---

#### `exclude_system_apps`
**Before:**
```
Exclude system applications (Finder, Dock, etc.)
```

**After:**
```
Whether to exclude system/OS applications from results. true (default): Filters out Finder, 
Dock, Window Server, explorer.exe, etc. false: Include all applications. Set to false only 
if user specifically asks about system apps.
```

**Improvements:**
- ✅ Explains boolean behavior
- ✅ Lists specific examples (cross-platform)
- ✅ States default value
- ✅ Guidance on when to change

---

#### `exclude_domains`
**Before:**
```
Domains to exclude from results. Defaults exclude local development.
```

**After:**
```
Array of domain names to exclude from results. Default: ["localhost", "127.0.0.1"] to 
filter local development. Add domains like "about:blank", "chrome://newtab" to exclude 
browser UI pages. Examples: ["localhost", "192.168.1.1"], ["example.com", "test.local"]
```

**Improvements:**
- ✅ Shows array format
- ✅ Lists default values
- ✅ Suggests additional useful exclusions
- ✅ Multiple concrete examples
- ✅ Explains purpose of defaults

---

#### `min_duration_seconds`
**Before:**
```
Filter out very short events (likely accidental). Default: 5 seconds
```

**After:**
```
Minimum event duration to include. Events shorter than this are filtered out as likely 
accidental window switches. Default: 5 seconds. Use 0 to include all events, 30+ to 
focus on sustained usage. Recommended: keep default unless user requests otherwise.
```

**Improvements:**
- ✅ Explains filtering logic
- ✅ States default
- ✅ Provides alternative values with rationale
- ✅ Strong recommendation to keep default

---

### Daily Summary Parameters

#### `date`
**Before:**
```
Date to summarize (YYYY-MM-DD format). Defaults to today.
```

**After:**
```
Date to summarize in YYYY-MM-DD format. Examples: "2025-01-14", "2024-12-25". 
Defaults to today if omitted. Use "yesterday" in time_period tools for yesterday, 
or specify exact date here. Must be a date with available data (check with 
aw_get_capabilities for date ranges).
```

**Improvements:**
- ✅ Concrete examples
- ✅ Clarifies default behavior
- ✅ Distinguishes from time_period parameter
- ✅ Reminds to check data availability
- ✅ References capabilities tool

---

#### `include_hourly_breakdown`
**Before:**
```
Include hour-by-hour activity breakdown
```

**After:**
```
Whether to include hour-by-hour (0-23) activity breakdown showing active time and 
top app for each hour. true (default): Include hourly data - recommended for 
understanding daily patterns. false: Omit hourly data for faster response - use 
when user only wants overall summary.
```

**Improvements:**
- ✅ Explains what's in the breakdown
- ✅ Specifies hour range (0-23)
- ✅ States default
- ✅ Explains trade-off (detail vs speed)
- ✅ Guidance on when to use each

---

### Raw Events Parameters

#### `bucket_id`
**Before:**
```
Bucket identifier (use aw_get_capabilities to discover available buckets)
```

**After:**
```
Exact bucket identifier from ActivityWatch. MUST call aw_get_capabilities first to 
get valid bucket IDs. Format: "aw-watcher-window_hostname" or "aw-watcher-web-chrome_hostname". 
Examples: "aw-watcher-window_my-laptop", "aw-watcher-web-chrome_desktop-pc". 
Do NOT guess - use exact ID from capabilities.
```

**Improvements:**
- ✅ Strong emphasis on prerequisite (MUST call capabilities)
- ✅ Shows format pattern
- ✅ Multiple concrete examples
- ✅ Explicit anti-pattern (Do NOT guess)
- ✅ Prevents common error

---

#### `start_time` & `end_time`
**Before:**
```
Start time (ISO 8601 format)
```

**After:**
```
Start timestamp in ISO 8601 format with timezone. Required. Examples: 
"2025-01-14T09:00:00Z" (UTC), "2025-01-14T09:00:00-05:00" (EST), 
"2025-01-14T14:30:00+00:00". Must include time component. Must be before end_time.
```

**Improvements:**
- ✅ Emphasizes timezone requirement
- ✅ Multiple examples with different timezones
- ✅ Shows timezone notation variations
- ✅ States required field
- ✅ Specifies relationship constraint
- ✅ Recommends time range limit

---

#### `limit`
**Before:**
```
Maximum events to return. Use pagination for larger datasets.
```

**After:**
```
Maximum number of events to return. Default: 100 (good for quick queries). 
Use 1000+ for comprehensive analysis. Maximum: 10000. Note: Large limits may 
return verbose data - consider using high-level tools instead for aggregated results.
```

**Improvements:**
- ✅ States default
- ✅ Provides usage guidance by value
- ✅ States maximum
- ✅ Warns about verbosity
- ✅ Suggests alternatives for large datasets

---

#### `response_format` (Raw Events)
**Before:**
```
Response verbosity
```

**After:**
```
Output format. "concise" (default): Shows first 10 events with summary - good for preview. 
"detailed": Formatted event list with key fields - good for analysis. "raw": Complete 
unprocessed JSON with all metadata - use for debugging or export only.
```

**Improvements:**
- ✅ Explains each option's output
- ✅ States default
- ✅ Provides use case for each
- ✅ Warns about "raw" verbosity

---

## Impact Assessment

### Before Enhancement
**Common LLM Errors:**
- ❌ Guessing bucket_id instead of calling capabilities
- ❌ Using wrong date format
- ❌ Not understanding time_period options
- ❌ Choosing wrong group_by value
- ❌ Missing timezone in timestamps

### After Enhancement
**Expected Improvements:**
- ✅ LLMs will call aw_get_capabilities before aw_get_raw_events
- ✅ Correct date/time format on first attempt
- ✅ Appropriate time_period selection
- ✅ Better group_by choices matching user intent
- ✅ Proper ISO 8601 timestamps with timezones
- ✅ Appropriate top_n values for context
- ✅ Better response_format selection

## Testing Checklist

Test these scenarios to validate improvements:

### Date/Time Handling
- [ ] "Show me activity from January 14th" → Correct YYYY-MM-DD format
- [ ] "What did I do this week?" → Uses "this_week", not "custom"
- [ ] "Activity from 2pm to 5pm today" → Correct ISO 8601 with time

### Parameter Selection
- [ ] "Top 5 apps" → Sets top_n=5
- [ ] "All my websites" → Sets appropriate top_n (20-50)
- [ ] "Detailed breakdown" → Sets response_format='detailed'

### Prerequisites
- [ ] First query → Calls aw_get_capabilities
- [ ] Raw events query → Calls capabilities first to get bucket_id
- [ ] Uses exact bucket_id from capabilities response

### Conditional Parameters
- [ ] time_period="custom" → Includes custom_start and custom_end
- [ ] time_period="today" → Does NOT include custom_start/custom_end
- [ ] Omits optional parameters when defaults are appropriate

## Maintenance Guidelines

When adding new parameters:

1. **Always include:**
   - Format specification
   - At least 2 concrete examples
   - Default value (if applicable)
   - Valid range/constraints

2. **Explain:**
   - What the parameter controls
   - When to use different values
   - Relationship to other parameters

3. **Provide guidance:**
   - Recommended values for common scenarios
   - Anti-patterns to avoid
   - Prerequisites or dependencies

4. **Be specific:**
   - Use actual dates/values in examples
   - Show exact format strings
   - List specific options with explanations

## Conclusion

All parameter descriptions now provide:
- ✅ Concrete examples with real values
- ✅ Format specifications
- ✅ Default behavior
- ✅ Usage guidance
- ✅ Validation rules
- ✅ Relationship constraints
- ✅ Anti-patterns to avoid

This should significantly reduce parameter-related errors and improve first-attempt success rate for LLM agents.

