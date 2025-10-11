# Window Title Parsing Implementation Summary

## Overview

Implemented intelligent window title parsing to extract structured information from window titles, **avoiding redundancy** with existing ActivityWatch bucket data.

## What Was Implemented

### ✅ Terminal Title Parsing (FULL IMPLEMENTATION)

**Why**: No terminal bucket exists in ActivityWatch - this provides completely unique information.

**Extracts**:
- `username`: SSH username
- `hostname`: Machine hostname (e.g., `bruce-7490`, `bruce-5560`)
- `directory`: Current working directory
- `isRemote`: Boolean indicating if SSH'd to remote machine
- `isSSH`: Boolean indicating if it's an SSH session

**Example**:
```
Title: "bcherrington@bruce-7490: ~/Projects/Docker"

Parsed:
{
  username: "bcherrington",
  hostname: "bruce-7490",
  directory: "~/Projects/Docker",
  isRemote: true,  // bruce-7490 != bruce-5560 (local)
  isSSH: true
}
```

**Use Cases**:
- Track time spent on different remote servers
- Identify which projects/directories you work in
- Distinguish local vs remote work
- Track SSH session patterns
- Group activity by hostname or directory

---

### ⚠️ IDE Title Parsing (PARTIAL - Dialog Detection Only)

**Why**: Editor bucket already provides file/project/language data. Only dialog detection is unique.

**Extracts**:
- `isDialog`: Boolean indicating if window is a dialog/modal
- `dialogType`: Type of dialog (e.g., "Confirm Exit", "Commit:")
- `project`: Project name (fallback when no editor bucket)
- `file`: File name (fallback when no editor bucket)

**Important**: Only parses IDE titles when editor bucket data is **NOT** available.

**Example**:
```
Title: "Confirm Exit"

Parsed:
{
  isDialog: true,
  dialogType: "Confirm Exit"
}
```

**Use Cases**:
- Filter out non-productive time (dialogs, modals, commit windows)
- More accurate coding time tracking
- Identify interruption patterns

**Dialog Patterns Detected**:
- `Confirm Exit`
- `Accept All Changes?`
- `Rename`, `Delete`, `Move`
- `Commit:`, `Push`, `Pull`, `Merge`, `Rebase`
- `Tip of the Day`
- `New Agent Session`

---

### ❌ Browser Title Parsing (NOT IMPLEMENTED)

**Why**: Browser bucket already provides superior data (`url`, `domain`, `title`).

**Decision**: Skip browser title parsing entirely to avoid redundancy.

---

## Architecture

### Files Created/Modified

1. **`src/utils/title-parser.ts`** (NEW)
   - Terminal title parser
   - IDE title parser (dialog detection)
   - Helper functions (`isTerminalApp`, `isIDEApp`, `isDialogTitle`)
   - Configuration management

2. **`src/services/unified-activity.ts`** (MODIFIED)
   - Integrated title parsing into enrichment flow
   - Added terminal and IDE enrichment fields
   - Only parses IDE titles when editor bucket unavailable

3. **`src/types.ts`** (MODIFIED)
   - Added `TerminalEnrichment` interface
   - Added `IDEEnrichment` interface
   - Updated `CanonicalEvent` to include terminal and IDE fields

4. **`config/app-names.json`** (MODIFIED)
   - Added `parsing` section with:
     - `localHostname`: "bruce-5560"
     - `terminalApps`: List of terminal applications
     - `ideApps`: List of IDE applications
     - `dialogPatterns`: List of dialog patterns to detect

5. **`src/config/app-names.ts`** (MODIFIED)
   - Added `getParsingConfig()` function
   - Exports parsing configuration

6. **`docs/WINDOW_TITLE_PARSING.md`** (NEW)
   - Comprehensive analysis of window title patterns
   - Parsing strategy and rationale
   - Implementation plan

7. **`docs/TITLE_PARSING_IMPLEMENTATION.md`** (NEW - this file)
   - Implementation summary
   - Usage examples

---

## Configuration

### Local Hostname

Set your local machine hostname in `config/app-names.json`:

```json
{
  "parsing": {
    "localHostname": "bruce-5560"
  }
}
```

This is used to determine if a terminal session is remote (SSH) or local.

### Terminal Apps

Customize which apps are recognized as terminals:

```json
{
  "parsing": {
    "terminalApps": [
      "kgx",
      "gnome-terminal",
      "konsole",
      "Terminal",
      "iTerm2",
      "Alacritty",
      "kitty"
    ]
  }
}
```

### Dialog Patterns

Customize which IDE window titles are recognized as dialogs:

```json
{
  "parsing": {
    "dialogPatterns": [
      "Confirm Exit",
      "Accept All Changes?",
      "Rename",
      "Delete",
      "Commit:",
      "Push"
    ]
  }
}
```

---

## Usage Examples

### Query Terminal Activity by Hostname

```typescript
// Get activity data
const activity = await aw_get_activity({
  time_period: "last_7_days",
  response_format: "detailed"
});

// Filter for remote work
const remoteWork = activity.activities.filter(a => 
  a.terminal?.isRemote === true
);

// Group by hostname
const byHostname = {};
for (const activity of remoteWork) {
  const hostname = activity.terminal.hostname;
  byHostname[hostname] = (byHostname[hostname] || 0) + activity.duration_hours;
}

console.log("Time by remote host:", byHostname);
// Output: { "bruce-7490": 2.15, "production-server": 1.5 }
```

### Filter Out IDE Dialogs

```typescript
// Get activity data
const activity = await aw_get_activity({
  time_period: "today",
  response_format: "detailed"
});

// Filter out dialogs for accurate coding time
const productiveCoding = activity.activities.filter(a => 
  a.ide?.isDialog !== true
);

const totalCodingTime = productiveCoding
  .reduce((sum, a) => sum + a.duration_hours, 0);

console.log("Productive coding time:", totalCodingTime);
```

### Track Directory-Based Work

```typescript
// Get terminal activity
const activity = await aw_get_activity({
  time_period: "last_7_days",
  response_format: "detailed"
});

// Group by directory
const byDirectory = {};
for (const activity of activity.activities) {
  if (activity.terminal) {
    const dir = activity.terminal.directory;
    byDirectory[dir] = (byDirectory[dir] || 0) + activity.duration_hours;
  }
}

console.log("Time by directory:", byDirectory);
// Output: { "~/Projects/Docker": 0.91, "~/Projects/Bruce-7490": 0.60 }
```

---

## Example Output

### Before Title Parsing:

```json
{
  "app": "kgx",
  "title": "bcherrington@bruce-7490: ~/Projects/Docker",
  "duration_hours": 0.91,
  "percentage": 12.4
}
```

### After Title Parsing:

```json
{
  "app": "kgx",
  "title": "bcherrington@bruce-7490: ~/Projects/Docker",
  "duration_hours": 0.91,
  "percentage": 12.4,
  "terminal": {
    "username": "bcherrington",
    "hostname": "bruce-7490",
    "directory": "~/Projects/Docker",
    "isRemote": true,
    "isSSH": true
  }
}
```

---

## Benefits

### 1. Remote Work Tracking
- See which remote servers you work on
- Track time spent on each remote machine
- Identify SSH session patterns

### 2. Directory-Based Analysis
- Track which projects/directories you work in
- Identify most-used directories across all hosts
- Correlate directory with productivity

### 3. Accurate Coding Time
- Filter out IDE dialogs and modals
- More accurate time tracking for actual coding
- Identify interruption patterns

### 4. No Data Redundancy
- Terminal parsing provides unique data (no terminal bucket exists)
- IDE parsing only when editor bucket unavailable
- Browser parsing skipped (bucket provides better data)

---

## Future Enhancements

### Potential Additions:

1. **Grouping by Hostname**
   - Add `group_by: 'hostname'` option to `aw_get_activity`
   - Automatically group terminal activity by remote host

2. **Directory Filtering**
   - Add `filter_directory` parameter
   - Query like: "Show me all time in ~/Projects/Docker"

3. **Remote vs Local Analysis**
   - Add summary statistics for local vs remote work
   - Track SSH session duration and frequency

4. **Dialog Filtering**
   - Add `exclude_dialogs` parameter to automatically filter IDE dialogs
   - More accurate productivity metrics

---

## Testing

After restarting the MCP server, test with:

```javascript
// Test terminal parsing
const activity = await aw_get_activity({
  time_period: "last_7_days",
  response_format: "detailed"
});

// Check for terminal enrichment
const terminalActivity = activity.activities.find(a => a.terminal);
console.log("Terminal enrichment:", terminalActivity?.terminal);

// Expected output:
// {
//   username: "bcherrington",
//   hostname: "bruce-7490",
//   directory: "~/Projects/Docker",
//   isRemote: true,
//   isSSH: true
// }
```

---

## Summary

✅ **Implemented**: Terminal title parsing (unique data)  
⚠️ **Implemented**: IDE dialog detection (unique data)  
❌ **Skipped**: Browser title parsing (redundant with browser bucket)  
❌ **Skipped**: IDE file/project parsing when editor bucket available (redundant)

This implementation provides **maximum value** while **avoiding redundancy** with existing ActivityWatch bucket data!

