# Category Colors and Metadata Support

## Overview

The MCP now supports full category metadata including colors and productivity scores. This allows you to customize how categories appear in the ActivityWatch dashboard and assign productivity values to different activities.

## New Features

### 1. **Color Support**
Categories can now have custom hex colors for better visualization in the ActivityWatch dashboard.

**Example Colors:**
- Work categories: Blue/Green tones (`#4285F4`, `#34A853`)
- Media/Entertainment: Red/Orange tones (`#FF0000`, `#FF5733`)
- Communication: Cyan/Purple tones (`#00FFFF`, `#9B59B6`)
- Learning: Yellow/Amber tones (`#FFC107`, `#FF9800`)

### 2. **Productivity Score Support**
Assign numerical scores to categories to track productivity:
- **Positive scores** (1-10): Productive activities
- **Negative scores** (-10 to -1): Distracting activities
- **Zero or unset**: Neutral activities

## Updated MCP Tools

### `aw_add_category`

**New Parameters:**
- `color` (optional): Hex color code (e.g., "#FF5733")
- `score` (optional): Productivity score number

**Examples:**

```typescript
// Add category with color
{
  "name": ["Work", "Programming"],
  "regex": "VSCode|IntelliJ|PyCharm",
  "color": "#4285F4"
}

// Add category with color and score
{
  "name": ["Media", "Social Media"],
  "regex": "facebook|twitter|instagram",
  "color": "#FF5733",
  "score": -5
}

// Add productive category
{
  "name": ["Work", "Deep Work"],
  "regex": "Writing|Research|Analysis",
  "color": "#34A853",
  "score": 10
}
```

### `aw_update_category`

**New Parameters:**
- `color` (optional): New hex color code
- `score` (optional): New productivity score

**Examples:**

```typescript
// Update just the color
{
  "id": 5,
  "color": "#9B59B6"
}

// Update color and score
{
  "id": 8,
  "color": "#FF0000",
  "score": -3
}

// Update everything
{
  "id": 10,
  "name": ["Work", "Meetings"],
  "regex": "zoom|teams|meet",
  "color": "#FFC107",
  "score": 5
}
```

### `aw_list_categories`

**Enhanced Output:**
Now includes `color` and `score` fields when present.

**Example Response:**
```json
{
  "categories": [
    {
      "id": 0,
      "name": "Work",
      "name_array": ["Work"],
      "rule": {
        "type": "regex",
        "regex": "Google Docs|libreoffice"
      },
      "color": "#4285F4",
      "score": 8
    }
  ],
  "total_count": 1
}
```

## Color Scheme Recommendations

### Professional Color Palette

**Work Categories:**
- `#4285F4` - Google Blue (general work)
- `#34A853` - Google Green (productive work)
- `#FBBC04` - Google Yellow (learning)
- `#EA4335` - Google Red (urgent/important)

**Programming:**
- `#007ACC` - VS Code Blue
- `#3776AB` - Python Blue
- `#F7DF1E` - JavaScript Yellow
- `#E34F26` - HTML5 Orange

**Media/Entertainment:**
- `#FF0000` - YouTube Red
- `#1DB954` - Spotify Green
- `#FF5733` - Netflix Red
- `#9B59B6` - Twitch Purple

**Communication:**
- `#00FFFF` - Cyan (general comms)
- `#0078D4` - Microsoft Blue (Teams)
- `#2D8CFF` - Zoom Blue
- `#E01E5A` - Slack Magenta

**Neutral:**
- `#CCCCCC` - Gray (uncategorized)
- `#9E9E9E` - Dark Gray (system)

## Productivity Score Guidelines

### Recommended Scoring System

**Highly Productive (8-10):**
- Deep work sessions
- Writing/documentation
- Code development
- Learning/research

**Moderately Productive (4-7):**
- Meetings
- Email management
- Code reviews
- Planning

**Neutral (0-3):**
- General browsing
- File management
- System tasks

**Mildly Distracting (-1 to -3):**
- News reading
- Light social media
- Music/podcasts

**Highly Distracting (-4 to -10):**
- Gaming
- Video streaming
- Heavy social media use

## Implementation Details

### Data Structure

Categories now support an optional `data` field:

```typescript
interface CategoryData {
  color?: string;    // Hex color code
  score?: number;    // Productivity score
}

interface Category {
  id: number;
  name: string[];
  rule: CategoryRule;
  data?: CategoryData;  // NEW
}
```

### Backward Compatibility

- Existing categories without colors/scores continue to work
- Colors and scores are optional
- Old MCP clients can ignore these fields
- ActivityWatch web UI will use colors if present

## Migration Guide

### Adding Colors to Existing Categories

Use `aw_update_category` to add colors to your existing categories:

```typescript
// Update Work category
aw_update_category({ id: 0, color: "#4285F4" })

// Update Media category
aw_update_category({ id: 7, color: "#FF0000", score: -5 })

// Update Programming category
aw_update_category({ id: 1, color: "#007ACC", score: 9 })
```

### Bulk Color Update Script

You can update multiple categories at once by calling the update tool multiple times.

## Best Practices

1. **Use Consistent Color Schemes**: Stick to a palette for visual coherence
2. **Meaningful Scores**: Base scores on actual productivity impact
3. **Color Accessibility**: Ensure sufficient contrast for visibility
4. **Document Your System**: Keep track of your color/score meanings

## Examples

### Complete Category with All Fields

```json
{
  "name": ["Work", "Programming", "Python"],
  "regex": "python|pycharm|jupyter|ipython",
  "color": "#3776AB",
  "score": 9
}
```

### Updating Multiple Fields

```typescript
aw_update_category({
  id: 5,
  name: ["Work", "Deep Work"],
  regex": "Writing|Research|Analysis|Focus",
  color: "#34A853",
  score: 10
})
```

## See Also

- [Category Management](./CATEGORY_MANAGEMENT.md)
- [Category Auto-Reload](./CATEGORY_AUTO_RELOAD.md)
- [ActivityWatch Integration](./ACTIVITYWATCH_INTEGRATION.md)

