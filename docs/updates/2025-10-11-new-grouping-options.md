# New Grouping Options for Activity Analysis

**Date**: 2025-10-11  
**Type**: Feature Addition  
**Impact**: Enhanced activity analysis capabilities

## Summary

Added four new `group_by` options to the `aw_get_activity` tool, enabling users to analyze their activity data from multiple perspectives: by website domain, project/repository, hour of day, and top-level category.

## New Grouping Options

### 1. `group_by='domain'` - Group by Website Domain 🌐

**Use Case**: Understand which websites consume the most time

**Example Output**:
```json
{
  "app": "firefox",
  "title": "prometheus.lan",
  "duration_hours": 0.113,
  "percentage": 3.5,
  "browser": {
    "url": "6 URLs",
    "domain": "prometheus.lan"
  }
}
```

**Benefits**:
- Track research patterns across websites
- Identify time sinks and productivity sites
- Measure learning vs. distraction
- Perfect for browser-heavy workflows

**Notes**:
- Non-browser activities grouped as "Non-browser"
- Domain shown in `title` field for easy identification
- Browser enrichment shows URL count and domain details

---

### 2. `group_by='project'` - Group by Project/Repository 📁

**Use Case**: Track time across different projects

**Example Output**:
```json
{
  "app": "jetbrains-webstorm",
  "title": "activitywatcher-mcp",
  "duration_hours": 2.1,
  "percentage": 64.1,
  "editor": {
    "file": "42 files",
    "project": "activitywatcher-mcp"
  }
}
```

**Benefits**:
- Multi-project time tracking
- Client billing and invoicing data
- Project prioritization insights
- Works with editor enrichment data

**Notes**:
- Non-editor activities grouped as "No project"
- Project name shown in `title` field
- Editor enrichment shows file count and project details

---

### 3. `group_by='hour'` - Group by Hour of Day ⏰

**Use Case**: Understand productivity patterns by time

**Example Output**:
```json
{
  "app": "2 apps",
  "title": "04:00-05:00",
  "duration_hours": 0.95,
  "percentage": 29.0,
  "editor": {
    "file": "19 files",
    "project": "activitywatcher-mcp"
  }
}
```

**Benefits**:
- Identify peak productivity hours
- Optimize work schedule
- Track energy patterns throughout the day
- Plan deep work sessions

**Notes**:
- Hour ranges in UTC (e.g., "04:00-05:00")
- Hour range shown in `title` field
- Shows app count if multiple apps used in that hour
- Aggregates all activity within each hour

---

### 4. `group_by='category_top_level'` - Group by Top-Level Category 📊

**Use Case**: Simplified high-level productivity overview

**Example Output**:
```json
{
  "app": "3 apps",
  "title": "Work",
  "duration_hours": 3.06,
  "percentage": 93.4,
  "category": "Work"
}
```

**Benefits**:
- High-level productivity overview
- Work vs. non-work balance
- Simpler than full category hierarchy
- Quick productivity assessment

**Notes**:
- Extracts first part of category hierarchy (e.g., "Work" from "Work > Programming > IDEs")
- Top-level category shown in `title` field
- Events can appear in multiple top-level categories if they match multiple rules
- "Uncategorized" group for unmatched activities

---

## Implementation Details

### Files Modified

1. **src/types.ts**:
   - Updated `UnifiedActivityParams` interface to include new grouping options
   - Line 281: Added `'domain' | 'project' | 'hour' | 'category_top_level'` to `group_by` type

2. **src/services/unified-activity.ts**:
   - Updated `groupEvents()` method signature (line 281)
   - Added grouping logic for each new option (lines 325-344)
   - Updated app/title field logic to display appropriate values (lines 397-421)
   - Updated category field logic for new grouping types (line 439)

3. **src/index.ts**:
   - Updated tool schema enum (line 228)
   - Updated tool description with new grouping options (line 230)

### Grouping Logic

#### Domain Grouping
```typescript
const domain = event.browser?.domain || 'Non-browser';
const existing = groups.get(domain) || [];
existing.push(event);
groups.set(domain, existing);
```

#### Project Grouping
```typescript
const project = event.editor?.project || 'No project';
const existing = groups.get(project) || [];
existing.push(event);
groups.set(project, existing);
```

#### Hour Grouping
```typescript
const timestamp = new Date(event.timestamp);
const hour = timestamp.getUTCHours();
const key = `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
const existing = groups.get(key) || [];
existing.push(event);
groups.set(key, existing);
```

#### Top-Level Category Grouping
```typescript
const categories = event.categories || [];
const topLevelCategories = new Set<string>();
for (const category of categories) {
  const topLevel = category.split(' > ')[0];
  topLevelCategories.add(topLevel);
}
for (const topLevel of topLevelCategories) {
  const existing = groups.get(topLevel) || [];
  existing.push(event);
  groups.set(topLevel, existing);
}
```

## Usage Examples

### Example 1: Website Time Analysis
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: 'domain',
  top_n: 10
})
```

**Result**: Top 10 websites by time spent, with "Non-browser" showing all coding/terminal time.

### Example 2: Multi-Project Time Tracking
```typescript
aw_get_activity({
  time_period: 'last_7_days',
  group_by: 'project',
  top_n: 5
})
```

**Result**: Time spent on each project over the last week.

### Example 3: Productivity Pattern Analysis
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: 'hour',
  top_n: 24
})
```

**Result**: Hour-by-hour breakdown showing when you're most productive.

### Example 4: Work-Life Balance Check
```typescript
aw_get_activity({
  time_period: 'last_30_days',
  group_by: 'category_top_level',
  top_n: 10
})
```

**Result**: High-level view of time distribution across Work, Entertainment, System, etc.

## Testing Results

All four grouping options tested successfully on 2025-10-11:

### Domain Grouping ✅
- Correctly grouped 9 domains
- "Non-browser" group contained 87.9% of time (coding activities)
- Domain names displayed in `title` field

### Project Grouping ✅
- Correctly separated "activitywatcher-mcp" (64.1%) from "No project" (34.2%)
- Project names displayed in `title` field
- Editor enrichment preserved

### Hour Grouping ✅
- Correctly grouped into 4 hour ranges (03:00-07:00 UTC)
- Hour ranges displayed in `title` field
- Revealed productivity pattern (peak at 04:00-05:00)

### Top-Level Category Grouping ✅
- Correctly extracted top-level categories (Work, System, Comms, Uncategorized)
- Category names displayed in `title` field
- Events appeared in multiple categories when appropriate

## Benefits

1. **Flexibility**: Users can now analyze activity from 7 different perspectives
2. **Insights**: Each grouping reveals different patterns and insights
3. **Productivity**: Helps identify peak hours, time sinks, and project balance
4. **Simplicity**: Top-level category grouping provides quick overview
5. **Compatibility**: All existing grouping options still work as before

## Future Enhancements

Potential additional grouping options:
- `language` - Group by programming language
- `file_extension` - Group by file type
- `git_branch` - Group by Git branch
- `day_of_week` - Group by day (for multi-day queries)
- Composite grouping (e.g., `['category', 'project']` for drill-down)

## Related Documentation

- `docs/concepts/canonical-events.md` - Canonical events approach
- `docs/concepts/categories.md` - Category system
- `src/types.ts` - Type definitions
- `src/services/unified-activity.ts` - Implementation

---

**Status**: ✅ Implemented and tested successfully  
**Version**: 1.0.0  
**Breaking Changes**: None (backward compatible)

