# Configurable Title Parsing - Implementation Summary

## Overview

Implemented a **fully configurable** window title parsing system that allows users to define custom parsing rules in `config/app-names.json` without writing any code.

## Key Features

### ✅ Data-Driven Configuration
- All parsing rules defined in JSON config file
- No code changes needed to add new rules
- Hot-reloadable (restart MCP server to apply changes)

### ✅ Flexible Pattern Matching
- **Regex patterns** for complex extraction
- **Contains matching** for simple string detection
- **Wildcard support** in app patterns (`jetbrains-*`, `*chrome*`)
- **Capture groups** for extracting structured data

### ✅ Multiple Enrichment Types
- `terminal` - SSH/terminal information
- `ide` - IDE/editor information
- `custom` - Any structured data you define

### ✅ Smart Prioritization
- Rules sorted by priority (lower number = higher priority)
- Prevents conflicts when multiple rules match
- Dialog detection runs before content extraction

### ✅ Computed Fields
- Dynamic fields based on extracted data
- Simple expression evaluation
- Built-in variables: `localHostname`, `$title`, `$app`

---

## Architecture

### Files Created

1. **`src/utils/configurable-title-parser.ts`** (NEW)
   - Rule-based parsing engine
   - Pattern matching (regex + contains)
   - Data extraction and computation
   - Rule validation

2. **`config/title-parsing-rules.md`** (NEW)
   - Comprehensive documentation
   - Rule structure reference
   - Examples and best practices
   - Troubleshooting guide

### Files Modified

3. **`config/app-names.json`**
   - Added `titleParsing` section
   - Includes 5 example rules:
     - Terminal SSH session
     - IDE dialog detection
     - IDE project/file extraction
     - Portainer instance
     - 1Password vault

4. **`src/config/app-names.ts`**
   - Added `getTitleParsingConfig()` function
   - Loads rules from JSON

5. **`src/services/unified-activity.ts`**
   - Integrated configurable parser
   - Applies rules to window events
   - Adds enrichment data to canonical events

6. **`src/types.ts`**
   - Changed to generic `Record<string, any>` types
   - Allows any fields defined by rules
   - Added `CustomEnrichment` type

---

## Configuration Example

### Basic Rule Structure

```json
{
  "titleParsing": {
    "localHostname": "bruce-5560",
    "rules": [
      {
        "name": "Terminal - SSH Session",
        "appPatterns": ["kgx", "gnome-terminal"],
        "titlePattern": "^([^@]+)@([^:]+):\\s*(.+)$",
        "captureGroups": {
          "username": 1,
          "hostname": 2,
          "directory": 3
        },
        "enrichmentType": "terminal",
        "computedFields": {
          "isRemote": "hostname !== localHostname"
        }
      }
    ]
  }
}
```

### Rule Components

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Human-readable identifier | `"Terminal - SSH Session"` |
| `appPatterns` | Which apps this rule applies to | `["kgx", "jetbrains-*"]` |
| `titlePattern` | Regex to match title | `"^([^@]+)@([^:]+):\\s*(.+)$"` |
| `captureGroups` | Extract data from regex groups | `{"username": 1, "hostname": 2}` |
| `enrichmentType` | Type of data | `"terminal"`, `"ide"`, `"custom"` |
| `fields` | Static fields to add | `{"service": "Portainer"}` |
| `computedFields` | Dynamic fields | `{"isRemote": "hostname !== localHostname"}` |
| `priority` | Rule priority (lower = higher) | `1` (dialog) vs `10` (content) |

---

## Example Rules

### 1. Terminal SSH Session

**Input**: `bcherrington@bruce-7490: ~/Projects/Docker`

**Rule**:
```json
{
  "name": "Terminal - SSH Session",
  "appPatterns": ["kgx", "gnome-terminal", "konsole"],
  "titlePattern": "^([^@]+)@([^:]+):\\s*(.+)$",
  "captureGroups": {
    "username": 1,
    "hostname": 2,
    "directory": 3
  },
  "enrichmentType": "terminal",
  "computedFields": {
    "isRemote": "hostname !== localHostname",
    "isSSH": "hostname !== localHostname"
  }
}
```

**Output**:
```json
{
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

### 2. IDE Dialog Detection

**Input**: `Confirm Exit`

**Rule**:
```json
{
  "name": "JetBrains IDE - Dialog Detection",
  "appPatterns": ["jetbrains-*"],
  "titlePatterns": ["Confirm Exit", "Rename", "Delete"],
  "matchType": "contains",
  "enrichmentType": "ide",
  "fields": {
    "isDialog": true,
    "dialogType": "$title"
  },
  "priority": 1
}
```

**Output**:
```json
{
  "ide": {
    "isDialog": true,
    "dialogType": "Confirm Exit"
  }
}
```

---

### 3. Custom: Portainer Instance

**Input**: `Portainer | Docker Desktop 7490 — Mozilla Firefox`

**Rule**:
```json
{
  "name": "Portainer Web App",
  "appPatterns": ["WebApp-Portainer*"],
  "titlePattern": "Portainer \\| (.+) — Mozilla Firefox",
  "captureGroups": {
    "instance": 1
  },
  "enrichmentType": "custom",
  "fields": {
    "service": "Portainer",
    "type": "infrastructure"
  }
}
```

**Output**:
```json
{
  "custom": {
    "instance": "Docker Desktop 7490",
    "service": "Portainer",
    "type": "infrastructure"
  }
}
```

---

## Adding Your Own Rules

### Step 1: Identify the Pattern

Look at window titles:
```
ChatGPT - Test SMTP email
ChatGPT - Write a function
ChatGPT - Debug code
```

Pattern: `ChatGPT - <topic>`

### Step 2: Create the Regex

```regex
^ChatGPT - (.+)$
```

### Step 3: Define the Rule

```json
{
  "name": "ChatGPT Topic Extraction",
  "appPatterns": ["*chrome*", "firefox"],
  "titlePattern": "^ChatGPT - (.+)$",
  "captureGroups": {
    "topic": 1
  },
  "enrichmentType": "custom",
  "fields": {
    "service": "ChatGPT",
    "type": "ai-assistant"
  }
}
```

### Step 4: Add to Config

Edit `config/app-names.json`:

```json
{
  "titleParsing": {
    "localHostname": "your-hostname",
    "rules": [
      {
        "name": "ChatGPT Topic Extraction",
        ...
      },
      ...existing rules...
    ]
  }
}
```

### Step 5: Rebuild and Test

```bash
npm run build
# Restart MCP server
# Test with aw_get_activity
```

---

## Advanced Features

### Wildcard App Patterns

```json
"appPatterns": ["jetbrains-*"]  // Matches all JetBrains IDEs
"appPatterns": ["*chrome*"]     // Matches Chrome, Chromium, etc.
"appPatterns": ["WebApp-*"]     // Matches all web apps
```

### Priority System

```json
{
  "name": "Dialog Detection",
  "priority": 1,  // Runs first
  ...
},
{
  "name": "Content Extraction",
  "priority": 10,  // Runs second
  ...
}
```

### Computed Fields

```json
"computedFields": {
  "isRemote": "hostname !== localHostname",
  "isProduction": "hostname === \"prod-server\"",
  "isLocal": "hostname === localHostname"
}
```

Supported expressions:
- `field !== value` - Not equals
- `field === value` - Equals
- `true` / `false` - Boolean literals

### Special Values

```json
"fields": {
  "fullTitle": "$title",  // Replaced with window title
  "appName": "$app"       // Replaced with app name
}
```

---

## Benefits

### 1. No Code Changes Required
- Add new rules without touching TypeScript
- Non-developers can customize parsing
- Easy to share configurations

### 2. Flexible and Extensible
- Support any app with any title pattern
- Extract any structured data
- Define custom enrichment types

### 3. Maintainable
- All rules in one place
- Self-documenting with `name` and `description`
- Easy to debug with rule validation

### 4. Powerful
- Regex for complex patterns
- Computed fields for dynamic data
- Priority system for conflict resolution

---

## Migration from Old System

The old hardcoded parser (`src/utils/title-parser.ts`) is **deprecated** but still present for reference.

**Old approach**:
- Hardcoded parsing logic in TypeScript
- Required code changes to add new patterns
- Limited to terminal and IDE apps

**New approach**:
- Configurable rules in JSON
- No code changes needed
- Works with any app

**Migration**: The default rules in `config/app-names.json` replicate the old behavior, so no action needed.

---

## Testing

After adding a rule, test it:

```javascript
const activity = await aw_get_activity({
  time_period: "last_7_days",
  response_format: "detailed"
});

// Find activity with your enrichment
const enriched = activity.activities.find(a => 
  a.terminal || a.ide || a.custom
);

console.log("Enrichment data:", enriched);
```

---

## Troubleshooting

### Rule Not Matching

1. **Check app pattern**: Use `*` wildcards if needed
2. **Test regex**: Use [regex101.com](https://regex101.com)
3. **Check priority**: Lower priority rule might be matching first
4. **Validate rule**: Check console for validation errors

### Fields Not Appearing

1. **Verify enrichmentType**: Must be `terminal`, `ide`, or `custom`
2. **Check capture groups**: Numbers must match regex groups (1-indexed)
3. **Rebuild**: Run `npm run build` after config changes
4. **Restart**: Restart MCP server to reload config

### Multiple Rules Matching

Use `priority` to control which rule wins:
```json
{
  "name": "High Priority Rule",
  "priority": 1,
  ...
},
{
  "name": "Low Priority Rule",
  "priority": 10,
  ...
}
```

---

## Documentation

- **Rule Reference**: `config/title-parsing-rules.md`
- **Examples**: See `config/app-names.json` for 5 working examples
- **Pattern Analysis**: `docs/WINDOW_TITLE_PARSING.md`

---

## Summary

✅ **Fully configurable** - All rules in JSON  
✅ **No code changes** - Add rules without TypeScript  
✅ **Flexible matching** - Regex + contains + wildcards  
✅ **Multiple enrichment types** - terminal, ide, custom  
✅ **Computed fields** - Dynamic data from expressions  
✅ **Priority system** - Control rule precedence  
✅ **Well documented** - Comprehensive guides and examples  

The title parsing system is now **completely data-driven** and ready for users to customize! 🎉

