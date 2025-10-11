# Category Management with LLMs

Last updated: October 11, 2025

This guide explains how to use LLMs to manage ActivityWatch categories through the MCP server.

For conceptual background on categories and classification, see: ./categories.md

## Overview

The ActivityWatch MCP server provides full integration with ActivityWatch's native category system, allowing LLMs to:

- ✅ Read categories from ActivityWatch server
- ✅ Create new categories
- ✅ Update existing categories
- ✅ Delete categories
- ✅ Sync changes back to ActivityWatch server

All category changes are immediately saved to the ActivityWatch server and become available in the web UI.

---

## How It Works

### Category Storage

Categories are stored in ActivityWatch's server settings at `/api/0/settings/classes` (authoritative source). If server settings are unavailable, the MCP server falls back to the `AW_CATEGORIES` environment variable.

```json
{
  "classes": [
    {
      "id": 1,
      "name": ["Work", "Email"],
      "rule": { "type": "regex", "regex": "gmail|outlook|mail" }
    },
    {
      "id": 2,
      "name": ["Entertainment"],
      "rule": { "type": "regex", "regex": "youtube|netflix|spotify" }
    }
  ]
}
```

### Initialization

On startup, the MCP server:

1. Tries to load categories from ActivityWatch server (preferred)
2. Falls back to `AW_CATEGORIES` environment variable if server categories unavailable
3. Logs the source and count of loaded categories

### Synchronization

When you modify categories through the MCP tools:

1. Changes are made in memory (fast)
2. Immediately saved to ActivityWatch server (persistent)
3. Available in web UI (synchronized)

---

## Available Tools

Parameter definitions, return shapes, and examples are maintained in the Tools Reference: ../reference/tools.md

### 1. `aw_list_categories`

List all configured categories.

Parameters: None

Example Request:
```json
{ "name": "aw_list_categories" }
```

Example Response:
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Work > Email",
      "name_array": ["Work", "Email"],
      "rule": { "type": "regex", "regex": "gmail|outlook|mail" }
    },
    {
      "id": 2,
      "name": "Entertainment",
      "name_array": ["Entertainment"],
      "rule": { "type": "regex", "regex": "youtube|netflix|spotify" }
    }
  ],
  "total_count": 2
}
```

---

### 2. `aw_add_category`

Create a new category.

Parameters:
- `name` (string[]): Hierarchical category name
- `regex` (string): Regular expression pattern to match activities
- `color` (string, optional): Hex color code (e.g., "#FF5733")
- `score` (number, optional): Productivity score (positive/negative)

Example Request:
```json
{
  "name": "aw_add_category",
  "arguments": {
    "name": ["Work", "Meetings"],
    "regex": "zoom|teams|meet|webex"
  }
}
```

Example Response:
```json
{
  "success": true,
  "category": {
    "id": 3,
    "name": "Work > Meetings",
    "name_array": ["Work", "Meetings"],
    "rule": { "type": "regex", "regex": "zoom|teams|meet|webex" }
  },
  "message": "Category \"Work > Meetings\" created successfully"
}
```

Regex Tips:
- Use `|` for OR: "gmail|outlook|mail" matches any of these
- Case-insensitive by default
- Matches app names, window titles, and URLs
- Use `.*` for wildcards: ".*python.*" matches anything containing "python"

---

### 3. `aw_update_category`

Update an existing category's name or regex pattern.

Parameters:
- `id` (number): Category ID to update
- `name` (string[], optional): New hierarchical name
- `regex` (string, optional): New regex pattern
- `color` (string, optional): New hex color code
- `score` (number, optional): New productivity score

Example Request (update regex only):
```json
{
  "name": "aw_update_category",
  "arguments": { "id": 3, "regex": "zoom|teams|meet|webex|slack" }
}
```

Example Request (update both name and regex):
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

Example Response:
```json
{
  "success": true,
  "category": {
    "id": 3,
    "name": "Work > Communication",
    "name_array": ["Work", "Communication"],
    "rule": { "type": "regex", "regex": "zoom|teams|meet|webex|slack|email" }
  },
  "message": "Category 3 updated successfully"
}
```

---

### 4. `aw_delete_category`

Delete a category permanently.

Parameters:
- `id` (number): Category ID to delete

Example Request:
```json
{ "name": "aw_delete_category", "arguments": { "id": 3 } }
```

Example Response:
```json
{ "success": true, "message": "Category \"Work > Meetings\" (id: 3) deleted successfully" }
```

⚠️ Warning: This permanently removes the category from ActivityWatch. Historical data is not affected, but future classification won't use this category.

---

## LLM Usage Examples

### Example 1: Discover Existing Categories

User: "What categories do I have configured?"

LLM Action:
```json
{ "name": "aw_list_categories" }
```

LLM Response: "You have 5 categories configured:
1. Work > Email (matches gmail, outlook, mail)
2. Work > Development (matches vscode, pycharm, intellij)
3. Entertainment (matches youtube, netflix, spotify)
4. Social Media (matches twitter, facebook, instagram)
5. Uncategorized (default)"

---

### Example 2: Add a New Category

User: "Create a category for my gaming activities."

LLM Action:
```json
{
  "name": "aw_add_category",
  "arguments": { "name": ["Entertainment", "Gaming"], "regex": "steam|epic|gog|game" }
}
```

LLM Response: "I've created a new category 'Entertainment > Gaming' that will match Steam, Epic Games, GOG, and other gaming-related activities. The category has been saved to your ActivityWatch server."

---

### Example 3: Update Category Pattern

User: "Add Thunderbird to the email category."

LLM Actions:
1) List categories to find the email category ID
```json
{
  "name": "aw_list_categories"
}
```

2) Update the regex pattern
```json
{
  "name": "aw_update_category",
  "arguments": {
    "id": 1,
    "regex": "gmail|outlook|mail|thunderbird"
  }
}
```

LLM Response: "I've updated your 'Work > Email' category to include Thunderbird. The pattern now matches: gmail, outlook, mail, and thunderbird."

---

### Example 4: Reorganize Categories

User: "Split my 'Work' category into 'Work' and 'Personal Projects'."

LLM Actions:
1) List current categories
2) Create new "Personal Projects" category
3) Update existing "Work" category to be more specific
4) Provide guidance on which activities to recategorize

---

## Best Practices

1. Always list categories first to avoid duplicates
2. Use hierarchical names (e.g., ["Work", "Email"]) for better insights
3. Make regex patterns specific to reduce false matches
4. Document category purpose to clarify intent
5. Confirm deletions before proceeding

---

## Troubleshooting

- "No categories configured": Ensure ActivityWatch server is running and `/api/0/settings` is reachable; optionally set `AW_CATEGORIES` env var as fallback
- Changes not appearing in Web UI: Hard refresh and verify settings via API (`/api/0/settings`)
- Regex not matching: Test the pattern; view raw events with `aw_get_raw_events` for exact titles/app names

---

## Advanced Usage

### Bulk Category Import

You can create multiple categories at once by calling `aw_add_category` multiple times.

### Category Templates

Provide LLMs with common templates (development, content creation, etc.).

---

## Integration with Other Tools

### Daily Summary

Categories automatically appear in daily summaries when configured:

```json
{
  "name": "aw_get_daily_summary",
  "arguments": { "date": "2025-10-10" }
}
```

Response includes (example):
```json
{
  "top_categories": [
    { "category_name": "Work > Development", "duration_hours": 4.5, "percentage": 45.0, "event_count": 120 },
    { "category_name": "Work > Email", "duration_hours": 1.2, "percentage": 12.0, "event_count": 60 }
  ]
}
```

### Window Activity

Filter window activity by category (future feature).

---

## Summary

The category management tools allow LLMs to:

1. Discover what categories exist
2. Create new categories for better activity tracking
3. Update category patterns to improve matching
4. Delete unused categories
5. Sync all changes to ActivityWatch server

All changes are persistent and immediately available in the ActivityWatch web UI.

This enables LLMs to help users organize their activity data intelligently and provide better insights into how they spend their time.
