# Configuration

This directory contains configuration files for the ActivityWatch MCP server.

## Configuration Files

- **`user-preferences.json`** - User-specific preferences (timezone, date format, etc.)
- **`user-preferences.schema.json`** - JSON schema for user preferences validation
- **`app-names.json`** - Browser and editor app name mappings
- **`categories.json`** - Activity categorization rules (optional)

## user-preferences.json

This file contains user-specific preferences for the MCP server, including timezone settings.

**Schema**: `user-preferences.schema.json` provides JSON schema validation and IDE autocomplete support.

### Structure

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "UTC",
  "dateFormat": "YYYY-MM-DD",
  "weekStartsOn": "monday",
  "hourFormat": "24h"
}
```

### Timezone Configuration

The `timezone` setting controls how dates and times are interpreted and displayed:

- **Default**: Uses the timezone specified in this file
- **Environment Variable Override**: Set `ACTIVITYWATCH_TIMEZONE` or `TZ` to override
- **Parameter Override**: Pass `timezone` parameter to tools for per-request override
- **Fallback**: If no timezone is configured, uses system timezone

#### Supported Timezone Formats

1. **IANA Timezone Names** (recommended):
   - `Europe/Dublin` - Irish timezone (handles DST automatically)
   - `America/New_York` - Eastern Time
   - `Asia/Tokyo` - Japan Standard Time
   - `Australia/Sydney` - Australian Eastern Time

2. **Timezone Abbreviations**:
   - `IST` - Irish Standard Time (UTC+1)
   - `GMT` - Greenwich Mean Time (UTC+0)
   - `EST` - Eastern Standard Time (UTC-5)
   - `PST` - Pacific Standard Time (UTC-8)

3. **UTC Offsets**:
   - `UTC+1` - One hour ahead of UTC
   - `UTC-5` - Five hours behind UTC
   - `+1` - Short form for UTC+1

#### How Timezone Affects Daily Summaries

When you request a daily summary for "2025-10-11":
- **Without timezone**: Uses UTC midnight to midnight (00:00-23:59 UTC)
- **With timezone**: Uses local midnight to midnight (00:00-23:59 in your timezone)

For example, if you're in Ireland (UTC+1):
- Your work from 23:00 UTC on Oct 10 appears in Oct 11's summary (because it's 00:00 Oct 11 in Ireland)
- Your work from 22:59 UTC on Oct 10 appears in Oct 10's summary

#### Example Configurations

**For Ireland:**
```json
{
  "timezone": "Europe/Dublin"
}
```

**For US East Coast:**
```json
{
  "timezone": "America/New_York"
}
```

**For UTC (default):**
```json
{
  "timezone": "UTC"
}
```

### Other Preferences

- **dateFormat**: Date display format (currently informational, not yet implemented)
- **weekStartsOn**: Whether weeks start on Monday or Sunday (for weekly summaries)
- **hourFormat**: 12-hour or 24-hour time display (currently informational)

## app-names.json

This file defines the mappings between browser/editor types and their window app names. These mappings are used when building canonical queries to match window events with browser/editor events.

### Structure

```json
{
  "browsers": {
    "browserType": ["AppName1", "AppName2", ...]
  },
  "editors": {
    "editorType": ["AppName1", "AppName2", ...]
  },
  "bucketDetection": {
    "browsers": {
      "browserType": ["pattern1", "pattern2", ...]
    },
    "editors": {
      "editorType": ["pattern1", "pattern2", ...]
    }
  }
}
```

### Why This Matters

When ActivityWatch tracks your activity, different components report different information:

- **Window watcher** reports the app name (e.g., `jetbrains-webstorm`, `Google Chrome`)
- **Browser watcher** reports URLs and page titles
- **Editor watcher** reports files and projects

To combine this data accurately, we need to know which window app names correspond to which browsers/editors.

### Customizing App Names

#### Adding a New Browser

1. Add the browser type and app names to the `browsers` section:

```json
{
  "browsers": {
    "mycustombrowser": [
      "MyCustomBrowser",
      "mycustombrowser.exe",
      "custom-browser"
    ]
  }
}
```

2. Add detection patterns to `bucketDetection.browsers`:

```json
{
  "bucketDetection": {
    "browsers": {
      "mycustombrowser": ["mycustombrowser", "custom"]
    }
  }
}
```

The detection patterns are case-insensitive strings that will be searched for in the bucket ID.

#### Adding App Name Variants

If your system reports a different app name for an existing browser/editor, just add it to the array:

```json
{
  "browsers": {
    "chrome": [
      "Google Chrome",
      "chrome.exe",
      "chrome-custom",
      "MyCustomChrome"
    ]
  }
}
```

### How to Find Your App Names

To find out what app names your system reports:

1. **Check ActivityWatch web UI**:
   - Go to http://localhost:5600
   - Click on "Raw Data"
   - Select your window bucket (e.g., `aw-watcher-window_hostname`)
   - Look at the `app` field in the events

2. **Use the MCP tool**:
   ```
   aw_get_raw_events
   bucket_id: "aw-watcher-window_hostname"
   start_time: "2025-10-10T00:00:00Z"
   end_time: "2025-10-10T23:59:59Z"
   limit: 100
   ```
   Look for the `app` field in the returned events.

3. **Check the logs**:
   When the MCP server runs, it logs warnings if it can't detect browser/editor types:
   ```
   [QueryService] WARNING: Could not detect browser type for bucket aw-watcher-web-mycustombrowser_hostname
   ```

### Platform-Specific App Names

Different operating systems report different app names:

#### Linux
- Chrome: `Google-chrome`, `google-chrome`, `chrome`
- Firefox: `firefox`, `Firefox`
- WebStorm: `jetbrains-webstorm`

#### macOS
- Chrome: `Google Chrome`
- Firefox: `Firefox`
- WebStorm: `WebStorm`

#### Windows
- Chrome: `chrome.exe`, `Google Chrome`
- Firefox: `firefox.exe`, `Firefox.exe`
- WebStorm: `webstorm.exe`

The configuration includes common variants for all platforms, but you may need to add your specific variant.

### Bucket Detection

The `bucketDetection` section defines patterns for detecting browser/editor types from bucket IDs.

For example, if you have a bucket named `aw-watcher-web-chrome_hostname`, the detection logic will:
1. Convert to lowercase: `aw-watcher-web-chrome_hostname`
2. Check each browser's detection patterns
3. Find `chrome` in the patterns for the `chrome` browser type
4. Return `chrome` as the detected type

**Special cases:**
- Chrome detection excludes chromium to avoid false positives
- Multiple patterns can be specified for better detection

### Supported Browsers

Out of the box, the following browsers are supported:

- Google Chrome / Chromium
- Mozilla Firefox
- Opera
- Brave
- Microsoft Edge
- Vivaldi
- Safari

### Supported Editors

Out of the box, the following editors are supported:

- Visual Studio Code
- Vim / Neovim
- Emacs
- Sublime Text
- Atom
- JetBrains IDEs:
  - IntelliJ IDEA
  - PyCharm
  - WebStorm
  - PhpStorm
  - GoLand
  - RustRover
  - CLion
  - DataGrip
  - DataSpell
  - Rider
- Obsidian
- Notepad++
- gedit
- Kate
- nano

### Validation

The configuration file is validated against `app-names.schema.json`. Your IDE should provide autocomplete and validation if it supports JSON schemas.

### After Making Changes

1. Save the `app-names.json` file
2. Rebuild the project: `npm run build`
3. Restart the MCP server
4. Test with `aw_get_activity` to verify enrichment is working

### Troubleshooting

**Problem**: Editor enrichment not working

**Solution**: 
1. Check that the editor app name in the window events matches one of the names in the `editors` section
2. Use the steps above to find your actual app name
3. Add it to the appropriate editor's array in `app-names.json`

**Problem**: Browser enrichment not working

**Solution**: Same as above, but check the `browsers` section.

**Problem**: Getting "Could not detect browser/editor type" warnings

**Solution**: 
1. The bucket ID doesn't match any of the detection patterns
2. Add a detection pattern to `bucketDetection.browsers` or `bucketDetection.editors`
3. The pattern should be a substring that appears in your bucket ID (case-insensitive)

### Example: Adding Support for a Custom Browser

Let's say you have a custom browser called "SuperBrowser" with:
- Bucket ID: `aw-watcher-web-superbrowser_hostname`
- Window app name: `SuperBrowser` on macOS, `superbrowser` on Linux

Add to `app-names.json`:

```json
{
  "browsers": {
    "superbrowser": [
      "SuperBrowser",
      "superbrowser",
      "superbrowser.exe"
    ]
  },
  "bucketDetection": {
    "browsers": {
      "superbrowser": ["superbrowser"]
    }
  }
}
```

That's it! Rebuild and restart, and SuperBrowser will be recognized.

### Contributing

If you add support for a new browser or editor, please consider contributing it back to the project so others can benefit!

