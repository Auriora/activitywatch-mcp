# Period Summary Examples

The `aw_get_period_summary` tool provides flexible time period analysis with various detail levels.

## Overview

This tool extends the daily summary concept to support:
- Multiple time periods (daily, weekly, monthly, rolling periods)
- Flexible detail levels (hourly, daily, weekly breakdowns)
- Automatic period boundary calculation
- Timezone-aware period definitions

## Period Types

### Calendar-Based Periods

#### Daily
Single day from 00:00 to 23:59 in the specified timezone.

```typescript
// Get summary for a specific day
aw_get_period_summary({
  period_type: "daily",
  date: "2025-01-15"
})

// Get summary for today (default)
aw_get_period_summary({
  period_type: "daily"
})
```

#### Weekly
Week from Monday to Sunday containing the specified date.

```typescript
// Get summary for the week containing Jan 15
aw_get_period_summary({
  period_type: "weekly",
  date: "2025-01-15"
})

// Get summary for current week
aw_get_period_summary({
  period_type: "weekly"
})
```

#### Monthly
Calendar month containing the specified date.

```typescript
// Get summary for January 2025
aw_get_period_summary({
  period_type: "monthly",
  date: "2025-01-15"
})

// Get summary for current month
aw_get_period_summary({
  period_type: "monthly"
})
```

### Rolling Periods

#### Last 24 Hours
Rolling 24-hour window from current time.

```typescript
aw_get_period_summary({
  period_type: "last_24_hours"
})
```

#### Last 7 Days
Rolling 7-day window from current time.

```typescript
aw_get_period_summary({
  period_type: "last_7_days"
})
```

#### Last 30 Days
Rolling 30-day window from current time.

```typescript
aw_get_period_summary({
  period_type: "last_30_days"
})
```

## Detail Levels

### Hourly Breakdown
Best for daily or 24-hour periods. Shows activity for each hour.

```typescript
aw_get_period_summary({
  period_type: "daily",
  detail_level: "hourly"  // Default for daily periods
})
```

**Output includes:**
- Hour-by-hour activity (0-23)
- Active seconds per hour
- Top app for each hour
- Visual bar chart

### Daily Breakdown
Best for weekly, 7-day, or 30-day periods. Shows activity for each day.

```typescript
aw_get_period_summary({
  period_type: "last_7_days",
  detail_level: "daily"  // Default for weekly/7-day periods
})
```

**Output includes:**
- Day-by-day activity
- Active and AFK seconds per day
- Top app and website for each day
- Visual bar chart

### Weekly Breakdown
Best for monthly periods. Shows activity for each week.

```typescript
aw_get_period_summary({
  period_type: "monthly",
  detail_level: "weekly"
})
```

**Output includes:**
- Week-by-week activity
- Active and AFK seconds per week
- Top app and website for each week
- Visual bar chart

### No Breakdown
Just totals and top items, no time-based breakdown.

```typescript
aw_get_period_summary({
  period_type: "last_30_days",
  detail_level: "none"
})
```

## Common Use Cases

### Weekly Review
```typescript
// Get this week's activity with daily breakdown
aw_get_period_summary({
  period_type: "weekly",
  detail_level: "daily"
})
```

### Monthly Report
```typescript
// Get January 2025 with weekly breakdown
aw_get_period_summary({
  period_type: "monthly",
  date: "2025-01-15",
  detail_level: "weekly"
})
```

### Recent Activity Trend
```typescript
// Get last 30 days with daily breakdown
aw_get_period_summary({
  period_type: "last_30_days",
  detail_level: "daily"
})
```

### Quick Daily Check
```typescript
// Get today with hourly breakdown
aw_get_period_summary({
  period_type: "daily",
  detail_level: "hourly"
})
```

### Rolling 24-Hour Activity
```typescript
// Get last 24 hours with hourly breakdown
aw_get_period_summary({
  period_type: "last_24_hours",
  detail_level: "hourly"
})
```

## Timezone Support

All period types respect timezone boundaries:

```typescript
// Get weekly summary in Dublin timezone
aw_get_period_summary({
  period_type: "weekly",
  timezone: "Europe/Dublin"
})

// Get monthly summary in EST
aw_get_period_summary({
  period_type: "monthly",
  timezone: "EST"
})

// Get daily summary in UTC+1
aw_get_period_summary({
  period_type: "daily",
  timezone: "UTC+1"
})
```

## Auto-Selected Detail Levels

If you don't specify `detail_level`, it's automatically chosen based on `period_type`:

- `daily` → `hourly`
- `weekly` → `daily`
- `monthly` → `daily`
- `last_24_hours` → `hourly`
- `last_7_days` → `daily`
- `last_30_days` → `daily`

## Output Format

All summaries include:

1. **Period Information**
   - Period type and date range
   - Timezone used

2. **Totals**
   - Total active time (hours)
   - Total AFK time (hours)

3. **Top Items**
   - Top 5 applications (with time and percentage)
   - Top 5 websites (with time and percentage)
   - Top 5 categories (if configured)

4. **Breakdown** (based on detail_level)
   - Hourly/daily/weekly activity data
   - Visual bar charts
   - Top app/website for each period

5. **Insights**
   - Period summary
   - Average time per day
   - Most used app and website
   - Activity level assessment

## Comparison with aw_get_daily_summary

`aw_get_daily_summary` is optimized for single-day analysis:
- Fixed to one day
- Always includes hourly breakdown (optional)
- Simpler API

`aw_get_period_summary` is flexible for multi-day analysis:
- Supports 6 different period types
- Flexible detail levels (hourly/daily/weekly/none)
- Better for trends and comparisons
- Includes averages and period-level insights

**Recommendation**: Use `aw_get_daily_summary` for single-day analysis, `aw_get_period_summary` for everything else.

