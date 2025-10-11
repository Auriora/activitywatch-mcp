# User Preferences Configuration

The `config/user-preferences.json` file allows you to customize the behavior of the ActivityWatch MCP server to match your personal preferences.

## Quick Start

1. **Edit** `config/user-preferences.json`
2. **Set your timezone** (most important setting)
3. **Restart** the MCP server
4. **Verify** by running `aw_get_capabilities` to see your configured preferences

## Configuration File

**Location**: `config/user-preferences.json`

**Schema**: `config/user-preferences.schema.json` (provides IDE autocomplete and validation)

### Example Configuration

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "Europe/Dublin",
  "dateFormat": "YYYY-MM-DD",
  "weekStartsOn": "monday",
  "hourFormat": "24h"
}
```

## Settings Reference

### timezone

**Type**: `string`  
**Default**: `"UTC"`  
**Required**: No

The timezone used for date boundaries and time display in daily summaries and other time-based queries.

#### Supported Formats

1. **IANA Timezone Names** (recommended):
   - `"Europe/Dublin"` - Irish timezone (handles DST automatically)
   - `"America/New_York"` - Eastern Time (US)
   - `"America/Los_Angeles"` - Pacific Time (US)
   - `"Asia/Tokyo"` - Japan Standard Time
   - `"Australia/Sydney"` - Australian Eastern Time
   - See [full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

2. **Timezone Abbreviations**:
   - `"UTC"` - Coordinated Universal Time
   - `"GMT"` - Greenwich Mean Time
   - `"IST"` - Irish Standard Time (UTC+1)
   - `"EST"` - Eastern Standard Time (UTC-5)
   - `"PST"` - Pacific Standard Time (UTC-8)
   - `"CET"` - Central European Time (UTC+1)

3. **UTC Offsets**:
   - `"UTC+1"` - One hour ahead of UTC
   - `"UTC-5"` - Five hours behind UTC
   - `"+1"` - Short form for UTC+1
   - `"-5"` - Short form for UTC-5

#### How Timezone Affects Queries

When you request a period summary for a specific date, the timezone determines the date boundaries:

**Example**: Daily period summary for "2025-10-11"

- **UTC**: 2025-10-11 00:00:00 UTC to 2025-10-11 23:59:59 UTC
- **Europe/Dublin (UTC+1)**: 2025-10-10 23:00:00 UTC to 2025-10-11 22:59:59 UTC
- **America/New_York (UTC-4)**: 2025-10-11 04:00:00 UTC to 2025-10-12 03:59:59 UTC

This ensures that "October 11" means October 11 in **your** timezone, not UTC.

#### Override Per Request

You can override the default timezone for individual requests:

```typescript
aw_get_period_summary({
  period_type: "daily",
  date: "2025-10-11",
  timezone: "America/New_York"  // Override default
})
```

#### Environment Variable Override

Set `ACTIVITYWATCH_TIMEZONE` or `TZ` environment variable to override the config file:

```bash
export ACTIVITYWATCH_TIMEZONE="Europe/Dublin"
```

Priority order: **Tool Parameter > Environment Variable > Config File > System Timezone**

### dateFormat

**Type**: `string`  
**Default**: `"YYYY-MM-DD"`  
**Required**: No  
**Status**: Currently informational (not yet implemented)

Preferred date format for display.

**Options**:
- `"YYYY-MM-DD"` - ISO 8601 format (2025-10-11)
- `"DD/MM/YYYY"` - European format (11/10/2025)
- `"MM/DD/YYYY"` - US format (10/11/2025)
- `"DD.MM.YYYY"` - German format (11.10.2025)

### weekStartsOn

**Type**: `string`  
**Default**: `"monday"`  
**Required**: No

First day of the week for weekly summaries and reports.

**Options**:
- `"monday"` - Week starts on Monday (ISO 8601 standard, common in Europe)
- `"sunday"` - Week starts on Sunday (common in US)

### hourFormat

**Type**: `string`  
**Default**: `"24h"`  
**Required**: No  
**Status**: Currently informational (not yet implemented)

Preferred hour format for time display.

**Options**:
- `"24h"` - 24-hour format (00:00 - 23:59)
- `"12h"` - 12-hour format with AM/PM (12:00 AM - 11:59 PM)

## IDE Support

The JSON schema file (`user-preferences.schema.json`) provides:

- ✅ **Autocomplete** - Your IDE will suggest valid values
- ✅ **Validation** - Errors shown for invalid configurations
- ✅ **Documentation** - Hover over fields to see descriptions
- ✅ **Examples** - See example values for each field

### Supported IDEs

- Visual Studio Code (built-in)
- WebStorm / IntelliJ IDEA (built-in)
- Sublime Text (with JSON schema plugin)
- Vim/Neovim (with LSP and JSON schema support)

## Validation

The configuration is validated when loaded. Invalid configurations will:

1. Log a warning to the console
2. Fall back to default values
3. Continue running (graceful degradation)

### Common Validation Errors

**Invalid timezone**:
```
[UserPreferences] Invalid timezone "Invalid/Timezone", falling back to system timezone
```

**Solution**: Use a valid IANA timezone name, abbreviation, or UTC offset.

**Invalid JSON**:
```
[UserPreferences] Failed to load config/user-preferences.json, using defaults
```

**Solution**: Check JSON syntax (missing commas, quotes, brackets).

## Examples

### For Ireland

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "Europe/Dublin",
  "weekStartsOn": "monday",
  "hourFormat": "24h"
}
```

### For US East Coast

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "America/New_York",
  "weekStartsOn": "sunday",
  "hourFormat": "12h"
}
```

### For Japan

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "Asia/Tokyo",
  "weekStartsOn": "monday",
  "hourFormat": "24h"
}
```

### For Australia

```json
{
  "$schema": "./user-preferences.schema.json",
  "timezone": "Australia/Sydney",
  "weekStartsOn": "monday",
  "hourFormat": "24h"
}
```

## Troubleshooting

### Timezone not being applied

1. **Check the config file** - Ensure `config/user-preferences.json` exists and is valid JSON
2. **Restart the MCP server** - Changes require a restart
3. **Check capabilities** - Run `aw_get_capabilities` to see configured timezone in `user_preferences`
4. **Check the output** - Daily summaries should show timezone in header: `Daily Summary for 2025-10-11 (Europe/Dublin)`
5. **Check console logs** - Look for `[UserPreferences] Loaded preferences: timezone=...`

### Wrong timezone being used

1. **Check environment variables** - `ACTIVITYWATCH_TIMEZONE` or `TZ` override the config file
2. **Check parameter override** - Tool calls with `timezone` parameter override everything
3. **Verify timezone name** - Use exact IANA names (case-sensitive)

### IDE not showing autocomplete

1. **Check schema reference** - Ensure `"$schema": "./user-preferences.schema.json"` is present
2. **Restart IDE** - Some IDEs need restart to pick up schema changes
3. **Check file association** - Ensure `.json` files are associated with JSON language mode

## See Also

- [Timezone Support Implementation](../updates/timezone-support.md) - Technical details
- [Configuration Overview](../../config/README.md) - All configuration files
- [IANA Timezone Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) - Full timezone list
