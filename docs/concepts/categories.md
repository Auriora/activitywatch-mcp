# Categories - Activity Classification

**Last updated:** October 11, 2025

## Overview

Categories allow you to classify your computer activities into meaningful groups like "Work", "Entertainment", or "Communication" using regex-based rules. This enables better insights into how you spend your time.

## How Categories Work

### Matching Rules

Categories use **regex patterns** to match against activity data:

- **Application names** - `vscode`, `chrome`, `slack`
- **Window titles** - `Gmail`, `GitHub - Pull Request`  
- **URLs** - `github.com`, `youtube.com`
- **File paths** - `src/index.ts`, `README.md`
- **Project names** - `activitywatch-mcp`

**Matching is case-insensitive** and uses JavaScript regex syntax.

### Hierarchical Structure

Categories support nested hierarchies for better organization:

```json
{
  "name": ["Work", "Programming", "TypeScript"],
  "rule": { "type": "regex", "regex": "typescript|.ts$" }
}
```

**Display:** "Work > Programming > TypeScript"

**Precedence:** More specific (deeper) categories are preferred over general ones.

### Example Category Structure

```json
[
  {
    "name": ["Work"],
    "rule": { "type": "none" },
    "children": [
      {
        "name": ["Email"], 
        "rule": { "type": "regex", "regex": "gmail|outlook|mail|thunderbird" }
      },
      {
        "name": ["Programming"],
        "rule": { "type": "none" },
        "children": [
          {
            "name": ["TypeScript"],
            "rule": { "type": "regex", "regex": "typescript|vscode.*\\.ts" }
          },
          {
            "name": ["Python"],
            "rule": { "type": "regex", "regex": "python|pycharm|jupyter" }
          }
        ]
      }
    ]
  },
  {
    "name": ["Entertainment"],
    "rule": { "type": "regex", "regex": "youtube|netflix|spotify|steam" }
  }
]
```

## Storage & Synchronization

### Primary Storage: ActivityWatch Server

Categories are stored in **ActivityWatch's server settings** at `/api/0/settings/classes`:

✅ **Benefits:**
- Single source of truth
- Syncs with ActivityWatch web UI  
- Survives server restarts
- Accessible to multiple clients

### Fallback: Environment Variable

If ActivityWatch server is unavailable, categories load from `AW_CATEGORIES` environment variable:

```bash
export AW_CATEGORIES='[
  {
    "name": ["Work", "Email"],
    "rule": { "type": "regex", "regex": "gmail|outlook" }
  }
]'
```

### Auto-Reload Behavior

The `aw_list_categories` tool **automatically reloads** categories from the server to ensure you always see the latest data, even if categories were modified externally (e.g., through the web UI).

## Category Management Tools

### List Categories - `aw_list_categories`

Shows all configured categories with IDs, names, and patterns:

```json
{
  "categories": [
    {
      "id": 1,
      "name": "Work > Email", 
      "name_array": ["Work", "Email"],
      "rule": {
        "type": "regex",
        "regex": "gmail|outlook|mail"
      },
      "color": "#4285F4",
      "score": 5
    }
  ],
  "total_count": 1
}
```

### Add Category - `aw_add_category`

Creates new categories with optional color and productivity score:

```json
{
  "name": ["Work", "Meetings"],
  "regex": "zoom|teams|meet|webex",
  "color": "#FFC107", 
  "score": 3
}
```

### Update Category - `aw_update_category`  

Modifies existing categories:

```json
{
  "id": 1,
  "regex": "gmail|outlook|mail|thunderbird",
  "color": "#34A853"
}
```

### Delete Category - `aw_delete_category`

Permanently removes categories:

```json
{
  "id": 1
}
```

**⚠️ Warning:** Deletion is permanent and cannot be undone.

## Metadata Support

### Colors

Categories can have custom hex colors for visualization:

**Recommended Color Schemes:**

- **Work:** `#4285F4` (Google Blue), `#34A853` (Green) 
- **Programming:** `#007ACC` (VS Code Blue), `#3776AB` (Python Blue)
- **Media:** `#FF0000` (YouTube Red), `#1DB954` (Spotify Green)
- **Communication:** `#0078D4` (Teams Blue), `#E01E5A` (Slack Magenta)

### Productivity Scores

Assign numerical scores to track productivity:

- **Highly Productive (8-10):** Deep work, coding, writing
- **Moderately Productive (4-7):** Meetings, email, planning  
- **Neutral (0-3):** General browsing, file management
- **Distracting (-1 to -10):** Social media, gaming, entertainment

**Example:**
```json
{
  "name": ["Work", "Deep Work"],
  "regex": "writing|research|analysis|focus",
  "color": "#34A853",
  "score": 10
}
```

## Integration with Activity Analysis

### Daily Summaries

When categories are configured, daily summaries automatically include category breakdowns:

```json
{
  "top_categories": [
    {
      "category_name": "Work > Programming", 
      "duration_seconds": 18000,
      "duration_hours": 5.0,
      "percentage": 58.8,
      "event_count": 245
    },
    {
      "category_name": "Communication",
      "duration_seconds": 3600, 
      "duration_hours": 1.0,
      "percentage": 11.8,
      "event_count": 52
    }
  ]
}
```

### Activity Tools

All activity tools support the `include_categories` parameter to show category assignments:

```json
{
  "time_period": "today",
  "include_categories": true
}
```

**Returns activities with category labels:**
```json
{
  "app": "VS Code",
  "duration_hours": 3.5,
  "category": "Work > Programming > TypeScript",
  "percentage": 45.2
}
```

## Configuration Examples

### Basic Work Categories

```json
[
  {
    "name": ["Work", "Email"],
    "rule": { "type": "regex", "regex": "gmail|outlook|thunderbird" },
    "color": "#4285F4",
    "score": 5
  },
  {
    "name": ["Work", "Coding"], 
    "rule": { "type": "regex", "regex": "vscode|pycharm|intellij|sublime" },
    "color": "#007ACC",
    "score": 9
  },
  {
    "name": ["Work", "Meetings"],
    "rule": { "type": "regex", "regex": "zoom|teams|meet|slack" },
    "color": "#FFC107", 
    "score": 6
  }
]
```

### Entertainment Categories

```json
[
  {
    "name": ["Entertainment"],
    "rule": { "type": "none" },
    "children": [
      {
        "name": ["Gaming"],
        "rule": { "type": "regex", "regex": "steam|epic|gog|minecraft" },
        "color": "#9B59B6",
        "score": -5
      },
      {
        "name": ["Video"], 
        "rule": { "type": "regex", "regex": "youtube|netflix|twitch" },
        "color": "#FF0000",
        "score": -3
      },
      {
        "name": ["Social Media"],
        "rule": { "type": "regex", "regex": "twitter|facebook|reddit|instagram" },
        "color": "#FF5733", 
        "score": -7
      }
    ]
  }
]
```

### Programming Language Categories

```json
[
  {
    "name": ["Programming"],
    "rule": { "type": "none" },
    "children": [
      {
        "name": ["TypeScript"],
        "rule": { "type": "regex", "regex": "typescript|\\.ts$|\\.tsx$" },
        "color": "#3178C6",
        "score": 9
      },
      {
        "name": ["Python"], 
        "rule": { "type": "regex", "regex": "python|\\.py$|jupyter|pycharm" },
        "color": "#3776AB",
        "score": 9  
      },
      {
        "name": ["JavaScript"],
        "rule": { "type": "regex", "regex": "javascript|\\.js$|\\.jsx$|node" },
        "color": "#F7DF1E",
        "score": 8
      }
    ]
  }
]
```

## Best Practices

### Regex Pattern Tips

1. **Use alternation for variants:** `gmail|googlemail|google.com`
2. **Match file extensions:** `\\.ts$|\\.tsx$` 
3. **Be specific enough:** `vscode` vs `code` (too general)
4. **Test patterns:** Use regex testers to validate

### Category Organization

1. **Start broad, then specialize** - Add subcategories as needed
2. **Keep hierarchies shallow** - 2-3 levels maximum  
3. **Use consistent naming** - "Work > Email" not "Work-Email"
4. **Avoid overlaps** - Each activity should match one category

### Performance Considerations

1. **Limit category count** - 20-50 categories is reasonable
2. **Optimize regex patterns** - Avoid complex lookaheads
3. **Test with real data** - Verify patterns match as expected

## Troubleshooting

### Categories Not Loading

**Problem:** Categories aren't appearing in daily summaries

**Solutions:**
1. Check ActivityWatch server is running
2. Verify categories exist: `aw_list_categories`  
3. Check environment variable syntax if using fallback
4. Restart MCP server after configuration changes

### Pattern Not Matching

**Problem:** Activities not being categorized correctly

**Solutions:**  
1. Test regex pattern with online regex tester
2. Check case sensitivity (patterns are case-insensitive)
3. Use `response_format: "detailed"` to see raw event data
4. Add more specific patterns or alternatives

### Sync Issues

**Problem:** Changes in web UI not reflecting in MCP

**Solution:** Call `aw_list_categories` to trigger auto-reload

## Technical Details

### Category Data Structure
tri
```typescript
interface Category {
  readonly id: number;
  readonly name: readonly string[];     // Hierarchical path
  readonly rule: {
    readonly type: 'regex' | 'none';   
    readonly regex?: string;            // Pattern to match
  };
  readonly data?: {                     // Optional metadata
    readonly color?: string;            // Hex color code
    readonly score?: number;            // Productivity score
  };
}
```

### Matching Algorithm

1. **Combine event fields** - app, title, url, file, project
2. **Test each category regex** - Case-insensitive matching  
3. **Prefer deeper matches** - More specific categories win
4. **Return first match** - Categories are tested in order
5. **Default to "Uncategorized"** - If no patterns match

### Storage Format

Categories are stored as a JSON array in ActivityWatch settings:

```json
{
  "classes": [
    {
      "id": 1,
      "name": ["Work", "Email"],
      "rule": { "type": "regex", "regex": "gmail|outlook" },
      "data": { "color": "#4285F4", "score": 5 }
    }
  ]
}
```

## References

- [Tools Reference](../reference/tools.md) - Category management tools
- [ActivityWatch Integration](../reference/activitywatch-integration.md) - Storage details  
- [Developer Guide](../developer/best-practices.md) - Implementation patterns
