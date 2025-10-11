# Language Grouping and Multi-Level Hierarchical Grouping

**Date**: 2025-10-11  
**Type**: Feature Addition  
**Impact**: Major enhancement to activity analysis capabilities

## Summary

Added two powerful new features to the `aw_get_activity` tool:
1. **Language Grouping** - Group activities by programming language
2. **Multi-Level Hierarchical Grouping** - Combine multiple grouping dimensions for drill-down analysis

## Feature 1: Language Grouping

### Overview

Group activities by programming language to understand which languages you're working in.

### Usage

```typescript
aw_get_activity({
  time_period: 'today',
  group_by: 'language',
  top_n: 10
})
```

### Example Output

```json
{
  "app": "jetbrains-webstorm",
  "title": "TypeScript",
  "duration_hours": 1.5,
  "percentage": 54,
  "editor": {
    "file": "15 files",
    "project": "activitywatcher-mcp",
    "language": "TypeScript"
  }
}
```

### Benefits

- **Skill Development Tracking**: See which languages you're practicing
- **Language Proficiency Analysis**: Track time spent in each language
- **Project Composition**: Understand the language mix in your projects
- **Polyglot Developer Analytics**: Perfect for developers working across multiple languages

### Notes

- Non-editor activities grouped as "Non-editor"
- Language name shown in `title` field
- Editor enrichment shows file count and language details

---

## Feature 2: Multi-Level Hierarchical Grouping

### Overview

Combine multiple grouping dimensions to create hierarchical drill-down analysis. For example, group by category first, then by project within each category.

### Usage

```typescript
// Group by category, then by project
aw_get_activity({
  time_period: 'today',
  group_by: ['category_top_level', 'project'],
  top_n: 20
})

// Group by project, then by language
aw_get_activity({
  time_period: 'last_7_days',
  group_by: ['project', 'language'],
  top_n: 30
})

// Group by hour, then by category
aw_get_activity({
  time_period: 'today',
  group_by: ['hour', 'category_top_level'],
  top_n: 50
})
```

### Example Output

```json
{
  "app": "jetbrains-webstorm",
  "title": "Work > activitywatcher-mcp",
  "duration_hours": 2.1,
  "percentage": 64.1,
  "group_key": "activitywatcher-mcp",
  "group_hierarchy": ["Work", "activitywatcher-mcp"],
  "editor": {
    "file": "42 files",
    "project": "activitywatcher-mcp"
  }
}
```

### Hierarchy Display

The hierarchy is shown in the `title` field using ` > ` separator:
- `"Work > activitywatcher-mcp"` - Category > Project
- `"activitywatcher-mcp > TypeScript"` - Project > Language
- `"04:00-05:00 > Work"` - Hour > Category

### Supported Combinations

You can combine any 2-3 grouping options:

**Popular Combinations**:
1. **Category + Project**: `['category_top_level', 'project']`
   - See which projects belong to which categories
   - Example: "Work > activitywatcher-mcp", "Work > client-project"

2. **Project + Language**: `['project', 'language']`
   - See language breakdown per project
   - Example: "activitywatcher-mcp > TypeScript", "activitywatcher-mcp > Markdown"

3. **Hour + Category**: `['hour', 'category_top_level']`
   - See category distribution by hour
   - Example: "04:00-05:00 > Work", "04:00-05:00 > System"

4. **Category + Domain**: `['category_top_level', 'domain']`
   - See which websites belong to which categories
   - Example: "Work > github.com", "Work > stackoverflow.com"

5. **Project + Hour**: `['project', 'hour']`
   - See when you work on each project
   - Example: "activitywatcher-mcp > 04:00-05:00"

### Benefits

- **Drill-Down Analysis**: Understand relationships between different dimensions
- **Pattern Discovery**: Find correlations (e.g., which languages in which projects)
- **Time Distribution**: See how categories/projects are distributed across hours
- **Flexible Reporting**: Create custom views for different analysis needs

### Limitations

- Maximum 3 levels of grouping (to keep results manageable)
- Minimum 2 levels required (single-level uses standard grouping)
- Results can be large with 3 levels - use `top_n` wisely

---

## Implementation Details

### Files Modified

1. **src/types.ts**:
   - Added `GroupByOption` type (line 279)
   - Updated `UnifiedActivityParams.group_by` to accept string or array (line 283)
   - Added `group_key` and `group_hierarchy` fields to `CanonicalEvent` (lines 266-267)

2. **src/services/unified-activity.ts**:
   - Updated `groupEvents()` signature to include 'language' (line 284)
   - Added language grouping logic (lines 348-353)
   - Added `groupEventsMultiLevel()` method (lines 460-619)
   - Updated activity analysis to handle array group_by (lines 110-114)

3. **src/index.ts**:
   - Updated tool schema to support both string and array for `group_by` (lines 226-244)
   - Added 'language' to enum
   - Documented multi-level grouping in description

### Language Grouping Logic

```typescript
else if (groupBy === 'language') {
  // Group by programming language
  const language = event.editor?.language || 'Non-editor';
  const existing = groups.get(language) || [];
  existing.push(event);
  groups.set(language, existing);
}
```

### Multi-Level Grouping Algorithm

1. **Extract Keys**: For each event, extract a key for each grouping level
2. **Build Hierarchy**: Create a tree structure with nested groups
3. **Flatten**: Convert tree to flat array with `group_hierarchy` field
4. **Aggregate**: Calculate totals for each group at each level

**Example Hierarchy**:
```
Work
├── activitywatcher-mcp
│   ├── TypeScript (1.5h)
│   └── Markdown (0.8h)
└── client-project
    └── Python (0.5h)
```

**Flattened Output**:
```json
[
  {
    "title": "Work",
    "group_hierarchy": ["Work"],
    "duration_hours": 2.8
  },
  {
    "title": "Work > activitywatcher-mcp",
    "group_hierarchy": ["Work", "activitywatcher-mcp"],
    "duration_hours": 2.3
  },
  {
    "title": "Work > activitywatcher-mcp > TypeScript",
    "group_hierarchy": ["Work", "activitywatcher-mcp", "TypeScript"],
    "duration_hours": 1.5
  }
]
```

## Usage Examples

### Example 1: Language Distribution
```typescript
aw_get_activity({
  time_period: 'last_7_days',
  group_by: 'language',
  top_n: 10
})
```
**Result**: Top 10 languages by time spent over the last week.

### Example 2: Category → Project Drill-Down
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: ['category_top_level', 'project'],
  top_n: 20
})
```
**Result**: Projects grouped by category, showing which projects belong to Work, Personal, etc.

### Example 3: Project → Language Breakdown
```typescript
aw_get_activity({
  time_period: 'last_30_days',
  group_by: ['project', 'language'],
  top_n: 30
})
```
**Result**: Language composition of each project over the last month.

### Example 4: Hourly Category Distribution
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: ['hour', 'category_top_level'],
  top_n: 50
})
```
**Result**: See which categories you work on during each hour of the day.

### Example 5: Three-Level Deep Dive
```typescript
aw_get_activity({
  time_period: 'last_7_days',
  group_by: ['category_top_level', 'project', 'language'],
  top_n: 50
})
```
**Result**: Full hierarchy showing categories, projects within categories, and languages within projects.

## New Fields in CanonicalEvent

### `group_key` (optional)
The key for the current grouping level. For multi-level grouping, this is the last element in the hierarchy.

**Example**: For "Work > activitywatcher-mcp", `group_key` is "activitywatcher-mcp"

### `group_hierarchy` (optional)
Array representing the full hierarchical path.

**Example**: For "Work > activitywatcher-mcp > TypeScript", `group_hierarchy` is `["Work", "activitywatcher-mcp", "TypeScript"]`

## Testing

### Language Grouping
To test after MCP restart:
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: 'language',
  top_n: 10,
  response_format: 'detailed'
})
```

**Expected**: Activities grouped by TypeScript, Markdown, JSON, JavaScript, etc.

### Multi-Level Grouping
To test after MCP restart:
```typescript
aw_get_activity({
  time_period: 'today',
  group_by: ['category_top_level', 'project'],
  top_n: 20,
  response_format: 'detailed'
})
```

**Expected**: Activities with titles like "Work > activitywatcher-mcp", "System > No project", etc.

## Benefits Summary

### Language Grouping
- ✅ Track programming language usage
- ✅ Identify skill development areas
- ✅ Understand project language composition
- ✅ Perfect for polyglot developers

### Multi-Level Grouping
- ✅ Drill-down analysis across dimensions
- ✅ Discover patterns and correlations
- ✅ Flexible custom reporting
- ✅ Hierarchical data visualization ready

## Future Enhancements

1. **Visual Hierarchy**: Tree-view rendering in UI
2. **Aggregation Options**: Sum vs. average at each level
3. **Filtering**: Filter specific branches of hierarchy
4. **Export**: CSV/JSON export with hierarchy preserved
5. **More Combinations**: Pre-defined useful combinations

## Related Documentation

- `docs/updates/2025-10-11-new-grouping-options.md` - Initial grouping options
- `docs/concepts/canonical-events.md` - Canonical events approach
- `src/types.ts` - Type definitions
- `src/services/unified-activity.ts` - Implementation

---

**Status**: ✅ Implemented and built successfully  
**Version**: 1.1.0  
**Breaking Changes**: None (backward compatible)  
**Next Steps**: Restart MCP server and test both features

