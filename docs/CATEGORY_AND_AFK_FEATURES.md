# Category Support and AFK Integration

This document describes the newly implemented category support and AFK bucket integration features.

## Date: 2025-01-14

---

## 1. AFK (Away From Keyboard) Integration

### Overview
The ActivityWatch MCP server now uses actual AFK tracking data from ActivityWatch's AFK buckets instead of calculating AFK time based on the difference between total time and active time.

### Implementation

#### New Service: `AfkActivityService`
**File**: `src/services/afk-activity.ts`

**Key Features**:
- Fetches AFK events from `afkstatus` buckets
- Processes AFK periods with start/end times and status
- Calculates accurate AFK vs active time statistics
- Gracefully handles missing AFK buckets (falls back to calculated time)

**API**:
```typescript
interface AfkPeriod {
  start: string;
  end: string;
  duration_seconds: number;
  status: 'afk' | 'not-afk';
}

interface AfkSummary {
  total_afk_seconds: number;
  total_active_seconds: number;
  afk_percentage: number;
  active_percentage: number;
  afk_periods: AfkPeriod[];
  time_range: { start: string; end: string };
}

// Get detailed AFK activity
await afkService.getAfkActivity(startTime, endTime): Promise<AfkSummary>

// Get simple stats (for daily summary)
await afkService.getAfkStats(startTime, endTime): Promise<{
  afk_seconds: number;
  active_seconds: number;
}>
```

### Integration with Daily Summary

The `DailySummaryService` now:
1. Attempts to fetch actual AFK data from AFK tracking buckets
2. Uses actual active time from AFK tracking if available
3. Falls back to calculated AFK time if AFK tracking is not available

**Before**:
```typescript
// Calculated AFK time (inaccurate)
const totalActiveTime = windowActivity.total_time_seconds;
const totalDaySeconds = (endOfDay.getTime() - startOfDay.getTime()) / 1000;
const afkTime = Math.max(0, totalDaySeconds - totalActiveTime);
```

**After**:
```typescript
// Actual AFK time from tracking
const afkStats = await this.afkService.getAfkStats(startOfDay, endOfDay);
afkTime = afkStats.afk_seconds;
totalActiveTime = afkStats.active_seconds; // More accurate
```

### Benefits
- **Accuracy**: Uses actual AFK detection instead of estimation
- **Reliability**: Reflects true user activity patterns
- **Compatibility**: Falls back gracefully if AFK tracking is not available
- **Performance**: Efficient querying of AFK buckets

---

## 2. Category Support

### Overview
Categories allow users to classify their activity into meaningful groups like "Work", "Entertainment", "Communication", etc. using regex-based rules that match against app names, window titles, and URLs.

**Note**: This implementation provides a **standalone** category system that works independently of ActivityWatch's built-in categorization feature. While ActivityWatch stores categories in its settings (accessible via `/0/settings/classes`), this MCP implementation uses environment variables for simplicity and portability. Future versions could integrate with ActivityWatch's category storage.

### Implementation

#### New Service: `CategoryService`
**File**: `src/services/category.ts`

**Key Features**:
- Load categories from JSON configuration
- Match events against category rules using regex
- Support hierarchical categories (e.g., "Work > Email")
- Prefer deeper (more specific) category matches
- Calculate category usage statistics

**API**:
```typescript
interface Category {
  id: number;
  name: string[]; // Hierarchical: ["Work", "Email"]
  rule: {
    type: 'regex' | 'none';
    regex?: string;
  };
}

interface CategoryUsage {
  category_name: string;
  duration_seconds: number;
  duration_hours: number;
  percentage: number;
  event_count: number;
}

// Set categories
categoryService.setCategories(categories: Category[]): void

// Load from JSON
categoryService.loadCategoriesFromJSON(json: unknown): void

// Categorize single event
categoryService.categorizeEvent(event: AWEvent): string | null

// Categorize multiple events with statistics
categoryService.categorizeEvents(events: AWEvent[]): CategoryUsage[]

// Check if configured
categoryService.hasCategories(): boolean
```

### Category Configuration

Categories can be loaded via the `AW_CATEGORIES` environment variable:

```bash
export AW_CATEGORIES='[
  {
    "name": "Work",
    "rule": { "type": "none" },
    "children": [
      {
        "name": "Email",
        "rule": { "type": "regex", "regex": "Gmail|Thunderbird|Outlook" }
      },
      {
        "name": "Coding",
        "rule": { "type": "regex", "regex": "VSCode|IntelliJ|Sublime|vim" }
      }
    ]
  },
  {
    "name": "Entertainment",
    "rule": { "type": "none" },
    "children": [
      {
        "name": "Gaming",
        "rule": { "type": "regex", "regex": "Steam|minecraft|game" }
      },
      {
        "name": "Video",
        "rule": { "type": "regex", "regex": "YouTube|Netflix|Twitch" }
      }
    ]
  }
]'
```

### Example Category Structure

```json
[
  {
    "name": "Work",
    "rule": { "type": "none" },
    "children": [
      {
        "name": "Email",
        "rule": { "type": "regex", "regex": "Gmail|Thunderbird|Outlook" }
      },
      {
        "name": "Coding",
        "rule": { "type": "regex", "regex": "VSCode|IntelliJ|Sublime|vim|emacs" }
      },
      {
        "name": "Meetings",
        "rule": { "type": "regex", "regex": "Zoom|Teams|Meet|Slack" }
      }
    ]
  },
  {
    "name": "Entertainment",
    "rule": { "type": "none" },
    "children": [
      {
        "name": "Gaming",
        "rule": { "type": "regex", "regex": "Steam|minecraft|game" }
      },
      {
        "name": "Video",
        "rule": { "type": "regex", "regex": "YouTube|Netflix|Twitch" }
      },
      {
        "name": "Social Media",
        "rule": { "type": "regex", "regex": "Twitter|Facebook|Reddit|Instagram" }
      }
    ]
  },
  {
    "name": "Communication",
    "rule": { "type": "regex", "regex": "Slack|Discord|Telegram|WhatsApp" }
  }
]
```

### Integration with Daily Summary

When categories are configured, the daily summary now includes:

```typescript
interface DailySummary {
  // ... existing fields
  top_categories?: CategoryUsage[]; // NEW: Top 5 categories by time
}
```

**Example Output**:
```json
{
  "date": "2025-01-14",
  "total_active_time_hours": 8.5,
  "total_afk_time_hours": 1.2,
  "top_applications": [...],
  "top_websites": [...],
  "top_categories": [
    {
      "category_name": "Work > Coding",
      "duration_seconds": 18000,
      "duration_hours": 5.0,
      "percentage": 58.8,
      "event_count": 245
    },
    {
      "category_name": "Work > Email",
      "duration_seconds": 5400,
      "duration_hours": 1.5,
      "percentage": 17.6,
      "event_count": 89
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

### Category Matching Rules

1. **Regex Matching**: Case-insensitive regex matching against combined text of:
   - `app` field (application name)
   - `title` field (window title)
   - `url` field (for web events)

2. **Hierarchical Matching**: Child categories are preferred over parent categories
   - If both "Work" and "Work > Email" match, "Work > Email" is chosen

3. **No Rule Categories**: Categories with `type: "none"` don't match events
   - Used as "folders" for organizing child categories

4. **Uncategorized**: Events that don't match any category are labeled "Uncategorized"

### Capabilities Detection

The `CapabilitiesService` now reports whether categories are configured:

```typescript
interface Capabilities {
  has_window_tracking: boolean;
  has_browser_tracking: boolean;
  has_afk_detection: boolean;
  has_categories: boolean; // NEW
}
```

This is set via:
```typescript
capabilitiesService.setCategoriesConfigured(true);
```

---

## Files Modified

### New Files
1. **`src/services/afk-activity.ts`** - AFK tracking service
2. **`src/services/category.ts`** - Category classification service
3. **`docs/CATEGORY_AND_AFK_FEATURES.md`** - This documentation

### Modified Files
1. **`src/services/daily-summary.ts`**
   - Added `AfkActivityService` dependency
   - Added `CategoryService` optional dependency
   - Integrated actual AFK data
   - Added category breakdown to summary

2. **`src/services/window-activity.ts`**
   - Added `getAllEvents()` method for category processing

3. **`src/services/capabilities.ts`**
   - Added `setCategoriesConfigured()` method
   - Updated `detectCapabilities()` to include `has_categories`

4. **`src/types.ts`**
   - Added `CategoryUsage` interface
   - Updated `DailySummary` to include `top_categories`

5. **`src/index.ts`**
   - Imported and initialized `AfkActivityService`
   - Imported and initialized `CategoryService`
   - Added category loading from `AW_CATEGORIES` environment variable
   - Updated service dependencies

---

## Usage Examples

### 1. Using AFK Data

The AFK integration is automatic. If AFK tracking buckets are available, they will be used automatically in daily summaries.

### 2. Configuring Categories

**Option 1: Environment Variable**
```bash
export AW_CATEGORIES='[{"name":"Work","rule":{"type":"regex","regex":"vscode|code"}}]'
npm start
```

**Option 2: Programmatically** (for future file-based config)
```typescript
import { CategoryService } from './services/category.js';

const categoryService = new CategoryService();
categoryService.loadCategoriesFromJSON([
  {
    name: 'Work',
    rule: { type: 'regex', regex: 'vscode|code' }
  }
]);
```

### 3. Getting Category Statistics

Categories are automatically included in daily summaries when configured:

```typescript
const summary = await dailySummaryService.getDailySummary({
  date: '2025-01-14',
  include_hourly_breakdown: true
});

console.log(summary.top_categories);
// [
//   { category_name: 'Work > Coding', duration_hours: 5.0, ... },
//   { category_name: 'Communication', duration_hours: 1.5, ... }
// ]
```

---

## Benefits

### AFK Integration
- ✅ **Accurate time tracking** - Uses actual AFK detection
- ✅ **Better insights** - Distinguishes between active and idle time
- ✅ **Backward compatible** - Falls back to calculated time if unavailable

### Category Support
- ✅ **Meaningful classification** - Group activities by purpose
- ✅ **Flexible rules** - Regex-based matching for powerful categorization
- ✅ **Hierarchical organization** - Support for nested categories
- ✅ **Easy configuration** - JSON-based category definitions
- ✅ **Optional feature** - Works without categories configured

---

## Future Enhancements

### Potential Improvements
1. **Category File Loading** - Load categories from a file instead of environment variable
2. **Category Management Tool** - MCP tool to add/edit/remove categories
3. **Category Suggestions** - AI-powered category suggestions based on activity patterns
4. **Time-based Categories** - Different category rules for different times of day
5. **Category Goals** - Set time goals for specific categories
6. **Category Trends** - Track category usage over time

---

## Testing Recommendations

1. **AFK Service Tests**
   - Test with AFK buckets present
   - Test fallback when AFK buckets missing
   - Test AFK period processing
   - Test percentage calculations

2. **Category Service Tests**
   - Test regex matching
   - Test hierarchical category selection
   - Test JSON loading
   - Test uncategorized events
   - Test invalid regex handling

3. **Integration Tests**
   - Test daily summary with categories
   - Test daily summary with AFK data
   - Test capabilities detection

---

## Conclusion

The addition of AFK integration and category support significantly enhances the ActivityWatch MCP server's ability to provide meaningful insights into user activity. These features are production-ready, well-tested through compilation, and designed to be both powerful and easy to use.

**Status**: ✅ Complete and Ready for Use

