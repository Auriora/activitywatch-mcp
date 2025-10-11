# Title Parsing Rules Configuration

This document explains how to configure custom title parsing rules in `config/app-names.json`.

## Overview

Title parsing rules allow you to extract structured information from window titles for any application. Rules are defined in the `titleParsing.rules` array in `config/app-names.json`.

## Rule Structure

Each rule has the following structure:

```json
{
  "name": "Rule Name",
  "description": "What this rule does",
  "appPatterns": ["app-name-1", "app-name-2"],
  "titlePattern": "regex pattern",
  "captureGroups": {
    "fieldName": 1,
    "anotherField": 2
  },
  "enrichmentType": "terminal|ide|custom",
  "fields": {
    "staticField": "value"
  },
  "computedFields": {
    "dynamicField": "expression"
  },
  "matchType": "regex|contains",
  "priority": 10
}
```

## Field Descriptions

### Required Fields

#### `name` (string)
Human-readable name for the rule.

**Example**: `"Terminal - SSH Session"`

---

#### `appPatterns` (array of strings)
List of application names this rule applies to. Supports wildcards with `*`.

**Examples**:
- `["kgx", "gnome-terminal"]` - Exact matches
- `["jetbrains-*"]` - Matches all JetBrains IDEs
- `["*chrome*"]` - Matches any app with "chrome" in the name

---

#### `enrichmentType` (string)
Type of enrichment this rule provides. Options:
- `"terminal"` - Terminal/SSH information
- `"ide"` - IDE/editor information
- `"custom"` - Custom enrichment (any structured data)

---

### Pattern Matching Fields

You must provide **either** `titlePattern` (regex) **or** `titlePatterns` (contains).

#### `titlePattern` (string, optional)
Regular expression to match against the window title. Use capture groups `()` to extract data.

**Example**:
```json
"titlePattern": "^([^@]+)@([^:]+):\\s*(.+)$"
```

Matches: `username@hostname: /directory`

---

#### `titlePatterns` (array of strings, optional)
List of strings to check if they're contained in the title. Used with `matchType: "contains"`.

**Example**:
```json
"titlePatterns": ["Confirm Exit", "Rename", "Delete"],
"matchType": "contains"
```

Matches any title containing these strings.

---

### Data Extraction Fields

#### `captureGroups` (object, optional)
Maps field names to regex capture group numbers (1-indexed).

**Example**:
```json
"titlePattern": "^([^@]+)@([^:]+):\\s*(.+)$",
"captureGroups": {
  "username": 1,
  "hostname": 2,
  "directory": 3
}
```

Extracts three fields from the regex groups.

---

#### `fields` (object, optional)
Static fields to add to the enrichment data.

**Example**:
```json
"fields": {
  "isDialog": true,
  "service": "Portainer",
  "type": "infrastructure"
}
```

Special value `"$title"` will be replaced with the full window title.

---

#### `computedFields` (object, optional)
Dynamic fields computed from extracted data. Supports simple expressions.

**Example**:
```json
"computedFields": {
  "isRemote": "hostname !== localHostname",
  "isSSH": "hostname !== localHostname"
}
```

Available variables:
- All fields from `captureGroups`
- All fields from `fields`
- `localHostname` - From config
- `$title` - Full window title
- `$app` - Application name

---

### Optional Fields

#### `description` (string, optional)
Human-readable description of what the rule does.

---

#### `matchType` (string, optional)
How to match the title. Options:
- `"regex"` (default) - Use `titlePattern` regex
- `"contains"` - Check if title contains any of `titlePatterns`

---

#### `priority` (number, optional)
Rule priority (lower = higher priority). Default: 100.

When multiple rules match the same app, the rule with the lowest priority number wins.

**Example**: Dialog detection (priority 1) should run before project extraction (priority 10).

---

## Complete Examples

### Example 1: Terminal SSH Session

```json
{
  "name": "Terminal - SSH Session",
  "description": "Parse terminal window titles to extract hostname, directory, and SSH status",
  "appPatterns": ["kgx", "gnome-terminal", "konsole", "Terminal", "iTerm2"],
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

**Input**: `bcherrington@bruce-7490: ~/Projects/Docker`

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

### Example 2: IDE Dialog Detection

```json
{
  "name": "JetBrains IDE - Dialog Detection",
  "description": "Detect IDE dialogs and modals to filter non-productive time",
  "appPatterns": ["jetbrains-*", "Code", "Visual Studio Code"],
  "titlePatterns": [
    "Confirm Exit",
    "Accept All Changes?",
    "Rename",
    "Delete",
    "Commit:",
    "Push"
  ],
  "matchType": "contains",
  "enrichmentType": "ide",
  "fields": {
    "isDialog": true,
    "dialogType": "$title"
  },
  "priority": 1
}
```

**Input**: `Confirm Exit`

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

### Example 3: Portainer Instance

```json
{
  "name": "Portainer Web App",
  "description": "Extract Portainer instance information",
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

**Input**: `Portainer | Docker Desktop 7490 — Mozilla Firefox`

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

### Example 4: AWS Console

```json
{
  "name": "AWS Console",
  "description": "Extract AWS service and region from console window title",
  "appPatterns": ["*chrome*", "firefox"],
  "titlePattern": "(.+) \\| (.+) \\| (.+)",
  "captureGroups": {
    "service": 1,
    "account": 2,
    "region": 3
  },
  "enrichmentType": "custom",
  "fields": {
    "platform": "AWS",
    "type": "cloud-console"
  }
}
```

**Input**: `EC2 Dashboard | Production | us-east-1`

**Output**:
```json
{
  "custom": {
    "service": "EC2 Dashboard",
    "account": "Production",
    "region": "us-east-1",
    "platform": "AWS",
    "type": "cloud-console"
  }
}
```

---

## Adding Your Own Rules

### Step 1: Identify the Pattern

Look at window titles for the app you want to parse:

```
Example titles:
- "myuser@server1: /var/www"
- "myuser@server2: /home/myuser"
```

Pattern: `username@hostname: directory`

---

### Step 2: Create a Regex

```regex
^([^@]+)@([^:]+):\s*(.+)$
```

- `([^@]+)` - Capture everything before `@` (username)
- `@` - Literal `@`
- `([^:]+)` - Capture everything before `:` (hostname)
- `:\s*` - Literal `:` and optional whitespace
- `(.+)` - Capture rest (directory)

---

### Step 3: Define the Rule

```json
{
  "name": "My Custom Terminal",
  "appPatterns": ["my-terminal-app"],
  "titlePattern": "^([^@]+)@([^:]+):\\s*(.+)$",
  "captureGroups": {
    "username": 1,
    "hostname": 2,
    "directory": 3
  },
  "enrichmentType": "terminal"
}
```

---

### Step 4: Add to Config

Add your rule to `config/app-names.json` in the `titleParsing.rules` array:

```json
{
  "titleParsing": {
    "localHostname": "your-hostname",
    "rules": [
      {
        "name": "My Custom Terminal",
        ...
      },
      ...existing rules...
    ]
  }
}
```

---

### Step 5: Rebuild and Test

```bash
npm run build
# Restart MCP server
# Test with aw_get_activity
```

---

## Tips and Best Practices

### 1. Use Specific App Patterns

❌ Bad: `["*"]` - Matches everything  
✅ Good: `["kgx", "gnome-terminal"]` - Specific apps

### 2. Order Rules by Priority

Rules with lower priority numbers run first. Use this for:
- Dialog detection (priority 1) before content extraction (priority 10)
- Specific patterns before generic patterns

### 3. Test Your Regex

Use a regex tester like [regex101.com](https://regex101.com) to test your patterns.

### 4. Use Wildcards Wisely

- `jetbrains-*` - Matches all JetBrains IDEs
- `*chrome*` - Matches Chrome, Chromium, Google-chrome, etc.

### 5. Avoid Redundancy

Don't parse data that's already available from ActivityWatch buckets:
- ❌ Browser URLs (browser bucket has this)
- ❌ Editor files (editor bucket has this)
- ✅ Terminal hostnames (no terminal bucket)
- ✅ IDE dialogs (unique information)

---

## Troubleshooting

### Rule Not Matching

1. Check app name matches `appPatterns`
2. Test regex pattern with actual window title
3. Check priority - higher priority rule might be matching first

### Fields Not Appearing

1. Verify `enrichmentType` is correct
2. Check `captureGroups` numbers match regex groups
3. Ensure rule is in `titleParsing.rules` array

### Multiple Rules Matching

Use `priority` to control which rule wins:
- Lower number = higher priority
- Default priority is 100

---

## Reference: Enrichment Types

### `terminal`
For terminal/SSH information. Fields typically include:
- `username`, `hostname`, `directory`
- `isRemote`, `isSSH`

### `ide`
For IDE/editor information. Fields typically include:
- `isDialog`, `dialogType`
- `project`, `file` (fallback only)

### `custom`
For any other structured data. You define the fields.

---

## Need Help?

See `docs/WINDOW_TITLE_PARSING.md` for more examples and analysis of common window title patterns.

