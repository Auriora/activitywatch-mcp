# Tool Description Updates - Data Accuracy Warnings

**Date**: 2025-10-11  
**Type**: Documentation Enhancement  
**Impact**: User-facing tool descriptions

## Summary

Updated tool descriptions for `aw_get_activity`, `aw_query_events`, and `aw_get_raw_events` to clearly emphasize the critical distinction between window-based filtering and bucket-based queries.

## Problem Identified

During testing, it was discovered that the tool descriptions did not adequately warn users about a critical data accuracy issue:

- **Browser/editor bucket queries** return ALL events from those buckets (AFK-filtered only)
- They do **NOT** filter by whether the browser/editor window was actively focused
- Example: A browser tab open for 30 minutes but only actively viewed for 2 minutes would show 30 minutes in raw queries, but correctly show 2 minutes in `aw_get_activity`

This led to confusion when interpreting results from different tools.

## Changes Made

### 1. Enhanced `aw_get_activity` Description

**Added**:
- ✅ Visual indicator for "RECOMMENDED TOOL FOR ACCURATE TIME TRACKING"
- 🎯 "KEY ACCURACY FEATURE" section explaining window-based filtering
- Concrete example: "A browser tab open for 30 minutes but only viewed for 2 minutes will correctly show 2 minutes, not 30"
- Emphasis on "ACTIVELY FOCUSED" in capability descriptions

**Why**: This is the primary tool users should use for accurate time tracking. The description now makes this crystal clear.

### 2. Enhanced `aw_query_events` Description

**Added**:
- ⚠️ "IMPORTANT DATA ACCURACY WARNING" section at the top
- Clear statement: "Browser/editor queries return ALL events from those buckets (AFK-filtered only)"
- Explicit note: "They do NOT filter by whether the browser/editor window was actually active"
- Concrete example in warning section
- Updated "WHEN NOT TO USE" section with "(RECOMMENDED)" tags pointing to `aw_get_activity`
- Added "(AFK-filtered, NOT window-filtered)" to query type descriptions
- Added ⚠️ warnings to examples showing potential misinterpretation
- Updated RETURNS section with warning about duration not equaling active window time
- Added to LIMITATIONS: "Browser/editor queries do NOT filter by active window"

**Why**: This tool is useful for exploration and enrichment, but should not be the primary source for "time spent" analysis.

### 3. Enhanced `aw_get_raw_events` Description

**Added**:
- ⚠️ "DATA ACCURACY WARNING" section at the top
- Clear statements about browser/web and editor buckets
- Explicit recommendation to use `aw_get_activity` for accurate metrics
- Updated "WHEN NOT TO USE" section with "(RECOMMENDED)" tags
- Added to LIMITATIONS: "Browser/editor buckets do NOT filter by active window"

**Why**: Raw events are useful for debugging but can be misleading for time tracking.

## Technical Background

### How ActivityWatch Tracks Data

1. **Window Watcher**: Records which application window is actively focused
2. **Browser Watcher**: Records which tab/URL is active in the browser (regardless of window focus)
3. **Editor Watcher**: Records which file is open in the editor (regardless of window focus)
4. **AFK Watcher**: Records when the user is away from keyboard

### The Canonical Events Approach

`aw_get_activity` implements ActivityWatch's canonical events approach:

1. **Base Layer**: Window events (defines when each app was actively focused)
2. **Enrichment**: Browser events (only counted when browser window was focused)
3. **Enrichment**: Editor events (only counted when editor window was focused)

This prevents double-counting and ensures accurate time tracking.

### Example Scenario

**User's actual activity**:
- 10:00-10:05: Actively browsing Augment product page in Firefox (5 min)
- 10:05-10:35: Working in WebStorm, Firefox tab still open in background (30 min)
- 10:35-10:37: Back to Firefox, same tab (2 min)

**What different tools report**:

| Tool | Firefox Time | Augment Page Time | Explanation |
|------|--------------|-------------------|-------------|
| `aw_get_activity` | 7 min | 7 min | ✅ Correct: Only counts when Firefox window was active |
| `aw_query_events` (browser) | 37 min | 37 min | ⚠️ Misleading: Counts entire time tab was open |
| `aw_get_raw_events` (web bucket) | 37 min | 37 min | ⚠️ Misleading: Raw bucket data, no window filtering |

## Impact on Users

### Before Changes
- Users might use `aw_query_events` for time tracking and get inflated numbers
- No clear guidance on which tool to use for accurate metrics
- Confusion about why different tools show different durations

### After Changes
- Clear visual indicators (✅ ⚠️ 🎯) guide users to the right tool
- Explicit warnings prevent misinterpretation of data
- Concrete examples help users understand the difference
- "(RECOMMENDED)" tags point users to the accurate tool

## Recommendations for AI Agents

When analyzing ActivityWatch data:

1. **Primary Analysis**: Always use `aw_get_activity` for time tracking
2. **Enrichment**: Use `aw_query_events` or `aw_get_raw_events` to explore details
3. **Be Explicit**: When presenting data from non-window-filtered tools, clearly state:
   - "This shows time the tab/file was open, not necessarily active"
   - "For accurate active time, see the aw_get_activity results"

## Testing

The changes were validated by:
1. Comparing results from `aw_get_activity` vs `aw_query_events` for the same time period
2. Identifying discrepancies (e.g., 31 min vs 3 min for Augment page)
3. Confirming the window-based filtering explanation matches the observed data

## Files Modified

- `src/index.ts`: Updated tool descriptions for:
  - `aw_get_activity` (lines 121-147)
  - `aw_get_raw_events` (lines 312-361)
  - `aw_query_events` (lines 378-456)

## Related Documentation

- `docs/concepts/canonical-events.md`: Explains the canonical events approach
- `docs/concepts/data-accuracy.md`: (Recommended to create) Deep dive on data accuracy

## Future Improvements

Consider:
1. Adding a `aw_compare_tools` diagnostic tool that shows the difference between window-filtered and bucket-based queries
2. Creating a visual diagram showing the data flow and filtering stages
3. Adding runtime warnings when `aw_query_events` returns significantly different durations than `aw_get_activity`

---

**Conclusion**: These changes significantly improve the clarity of tool descriptions and help users (both human and AI) choose the right tool for accurate activity analysis.

