# Category Management with LLMs

This guide explains how to use LLMs to manage ActivityWatch categories through the MCP server.

## Overview

The ActivityWatch MCP server now provides **full integration** with ActivityWatch's native category system, allowing LLMs to:

- ✅ **Read** categories from ActivityWatch server
- ✅ **Create** new categories
- ✅ **Update** existing categories
- ✅ **Delete** categories
- ✅ **Sync** changes back to ActivityWatch server

All category changes are **immediately saved** to the ActivityWatch server and become available in the web UI.

---

## How It Works

### Category Storage

Categories are stored in **ActivityWatch's server settings** at `/api/0/settings/classes`:

```json
{
  "classes": [
    {
      "id": 1,
      "name": ["Work", "Email"],
      "rule": {
        "type": "regex",
        "regex": "gmail|outlook|mail"
      }
    },
    {
      "id": 2,
      "name": ["Entertainment"],
      "rule": {
        "type": "regex",
        "regex": "youtube|netflix|spotify"
      }
    }
  ]
}
```

### Initialization

On startup, the MCP server:

1. **Tries to load categories from ActivityWatch server** (primary source)
2. **Falls back to `AW_CATEGORIES` environment variable** if server categories unavailable
3. **Logs the source and count** of loaded categories

### Synchronization

When you modify categories through the MCP tools:

1. **Changes are made in memory** (fast)
2. **Immediately saved to ActivityWatch server** (persistent)
3. **Available in web UI** (synchronized)

---

## Available Tools

### 1. `aw_list_categories`

List all configured categories.

**Parameters**: None

**Example Request**:
```json
{
  "name": "aw_list_categories"
}
```

**Example Response**:
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
      }
    },
    {
      "id": 2,
      "name": "Entertainment",
      "name_array": ["Entertainment"],
      "rule": {
        "type": "regex",
        "regex": "youtube|netflix|spotify"
      }
    }
  ],
  "total_count": 2
}
```

---

### 2. `aw_add_category`

Create a new category.

**Parameters**:
- `name` (array of strings): Hierarchical category name
- `regex` (string): Regular expression pattern to match activities

**Example Request**:
```json
{
  "name": "aw_add_category",
  "arguments": {
    "name": ["Work", "Meetings"],
    "regex": "zoom|teams|meet|webex"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "category": {
    "id": 3,
    "name": "Work > Meetings",
    "name_array": ["Work", "Meetings"],
    "rule": {
      "type": "regex",
      "regex": "zoom|teams|meet|webex"
    }
  },
  "message": "Category \"Work > Meetings\" created successfully"
}
```

**Regex Tips**:
- Use `|` for OR: `"gmail|outlook|mail"` matches any of these
- Case-insensitive by default
- Matches app names, window titles, and URLs
- Use `.*` for wildcards: `".*python.*"` matches anything containing "python"

---

### 3. `aw_update_category`

Update an existing category's name or regex pattern.

**Parameters**:
- `id` (number): Category ID to update
- `name` (array of strings, optional): New hierarchical name
- `regex` (string, optional): New regex pattern

**Example Request** (update regex only):
```json
{
  "name": "aw_update_category",
  "arguments": {
    "id": 3,
    "regex": "zoom|teams|meet|webex|slack"
  }
}
```

**Example Request** (update both name and regex):
```json
{
  "name": "aw_update_category",
  "arguments": {
    "id": 3,
    "name": ["Work", "Communication"],
    "regex": "zoom|teams|meet|webex|slack|email"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "category": {
    "id": 3,
    "name": "Work > Communication",
    "name_array": ["Work", "Communication"],
    "rule": {
      "type": "regex",
      "regex": "zoom|teams|meet|webex|slack|email"
    }
  },
  "message": "Category 3 updated successfully"
}
```

---

### 4. `aw_delete_category`

Delete a category permanently.

**Parameters**:
- `id` (number): Category ID to delete

**Example Request**:
```json
{
  "name": "aw_delete_category",
  "arguments": {
    "id": 3
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "message": "Category \"Work > Meetings\" (id: 3) deleted successfully"
}
```

**⚠️ Warning**: This permanently removes the category from ActivityWatch. Historical data is not affected, but future classification won't use this category.

---

## LLM Usage Examples

### Example 1: Discover Existing Categories

**User**: "What categories do I have configured?"

**LLM Action**:
```json
{
  "name": "aw_list_categories"
}
```

**LLM Response**: "You have 5 categories configured:
1. Work > Email (matches gmail, outlook, mail)
2. Work > Development (matches vscode, pycharm, intellij)
3. Entertainment (matches youtube, netflix, spotify)
4. Social Media (matches twitter, facebook, instagram)
5. Uncategorized (default)"

---

### Example 2: Add a New Category

**User**: "Can you create a category for my gaming activities? I use Steam, Epic Games, and GOG."

**LLM Action**:
```json
{
  "name": "aw_add_category",
  "arguments": {
    "name": ["Entertainment", "Gaming"],
    "regex": "steam|epic|gog|game"
  }
}
```

**LLM Response**: "I've created a new category 'Entertainment > Gaming' that will match Steam, Epic Games, GOG, and other gaming-related activities. The category has been saved to your ActivityWatch server."

---

### Example 3: Update Category Pattern

**User**: "I noticed my email category isn't catching Thunderbird. Can you add that?"

**LLM Action**:
1. First, list categories to find the email category ID:
```json
{
  "name": "aw_list_categories"
}
```

2. Then update the category:
```json
{
  "name": "aw_update_category",
  "arguments": {
    "id": 1,
    "regex": "gmail|outlook|mail|thunderbird"
  }
}
```

**LLM Response**: "I've updated your 'Work > Email' category to include Thunderbird. The pattern now matches: gmail, outlook, mail, and thunderbird."

---

### Example 4: Reorganize Categories

**User**: "I want to split my 'Work' category into 'Work' and 'Personal Projects'. Can you help?"

**LLM Action**:
1. List current categories
2. Create new "Personal Projects" category
3. Update existing "Work" category to be more specific
4. Provide guidance on which activities to recategorize

---

## Best Practices

### 1. **Always List Categories First**

Before modifying categories, list them to see what exists:
```
User: "Add a category for Python development"
LLM: *Lists categories first to check if one already exists*
```

### 2. **Use Hierarchical Names**

Organize categories hierarchically for better insights:
- ✅ `["Work", "Email"]` - Good
- ✅ `["Work", "Development", "Python"]` - Good
- ❌ `["Work-Email"]` - Bad (not hierarchical)

### 3. **Test Regex Patterns**

Make regex patterns specific enough to avoid false matches:
- ✅ `"gmail|outlook|mail"` - Specific
- ❌ `"mail"` - Too broad (matches "email", "mailbox", etc.)

### 4. **Document Category Purpose**

When creating categories, explain what they're for:
```
LLM: "I've created 'Work > Client Meetings' to track time spent in 
video calls with clients. This will help you analyze client engagement."
```

### 5. **Confirm Deletions**

Always confirm before deleting categories:
```
LLM: "Are you sure you want to delete 'Entertainment > Gaming'? 
This will remove it from ActivityWatch permanently."
```

---

## Troubleshooting

### Categories Not Loading

**Problem**: MCP server shows "No categories configured"

**Solutions**:
1. Check ActivityWatch server is running: `curl http://localhost:5600/api/0/info`
2. Check settings endpoint: `curl http://localhost:5600/api/0/settings`
3. Set `AW_CATEGORIES` environment variable as fallback

### Changes Not Appearing in Web UI

**Problem**: Category changes in MCP don't show in web UI

**Solutions**:
1. Refresh the web UI (hard refresh: Ctrl+Shift+R)
2. Check browser console for errors
3. Verify changes were saved: `curl http://localhost:5600/api/0/settings | jq '.classes'`

### Regex Not Matching

**Problem**: Category regex doesn't match expected activities

**Solutions**:
1. Test regex pattern: Use online regex tester
2. Check case sensitivity: Patterns are case-insensitive by default
3. View raw events to see exact app/title names: Use `aw_get_raw_events`

---

## Advanced Usage

### Bulk Category Import

You can create multiple categories at once by calling `aw_add_category` multiple times:

```javascript
// LLM can execute these sequentially
await addCategory(["Work", "Email"], "gmail|outlook|mail");
await addCategory(["Work", "Development"], "vscode|pycharm|intellij");
await addCategory(["Work", "Meetings"], "zoom|teams|meet");
```

### Category Templates

Common category templates for different use cases:

**Software Development**:
```json
[
  { "name": ["Development", "Coding"], "regex": "vscode|pycharm|intellij|sublime" },
  { "name": ["Development", "Terminal"], "regex": "terminal|iterm|cmd|powershell" },
  { "name": ["Development", "Documentation"], "regex": "notion|confluence|docs" }
]
```

**Content Creation**:
```json
[
  { "name": ["Content", "Writing"], "regex": "word|docs|notion|obsidian" },
  { "name": ["Content", "Design"], "regex": "figma|photoshop|illustrator|canva" },
  { "name": ["Content", "Video"], "regex": "premiere|davinci|final cut" }
]
```

---

## Integration with Other Tools

### Use with Daily Summary

Categories automatically appear in daily summaries:

```json
{
  "name": "aw_get_daily_summary",
  "arguments": {
    "date": "2025-10-10"
  }
}
```

Response includes:
```json
{
  "top_categories": [
    { "category_name": "Work > Development", "duration_hours": 4.5 },
    { "category_name": "Work > Email", "duration_hours": 1.2 }
  ]
}
```

### Use with Window Activity

Filter window activity by category (future feature).

---

## Summary

The category management tools allow LLMs to:

1. ✅ **Discover** what categories exist
2. ✅ **Create** new categories for better activity tracking
3. ✅ **Update** category patterns to improve matching
4. ✅ **Delete** unused categories
5. ✅ **Sync** all changes to ActivityWatch server

All changes are **persistent** and **immediately available** in the ActivityWatch web UI.

This enables LLMs to help users organize their activity data intelligently and provide better insights into how they spend their time.

