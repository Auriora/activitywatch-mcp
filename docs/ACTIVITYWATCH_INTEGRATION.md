# ActivityWatch Integration Status

This document explains how the MCP server integrates with ActivityWatch's native features.

## Summary

| Feature | Integration Status | Details |
|---------|-------------------|----------|
| **AFK Tracking** | ✅ **Fully Integrated** | Uses ActivityWatch's native AFK buckets |
| **Categories** | ✅ **Fully Integrated** | Reads/writes to ActivityWatch's category storage |
| **Window Activity** | ✅ **Fully Integrated** | Uses ActivityWatch's window tracking buckets |
| **Web Activity** | ✅ **Fully Integrated** | Uses ActivityWatch's browser watcher buckets |

---

## AFK Tracking Integration

### Status: ✅ Fully Integrated with Query API

The MCP server uses ActivityWatch's **query API** to filter all activity data by AFK status:

- **Primary Use**: `QueryService` uses query API to fetch AFK-filtered events
- **Query Method**: Uses `filter_period_intersect` to only include "not-afk" periods
- **API Endpoint**: Uses `/api/0/query/` with query language
- **Data Source**: Reads from ActivityWatch's AFK buckets (e.g., `aw-watcher-afk_hostname`)
- **Fallback**: Gracefully degrades if AFK buckets are unavailable (returns all events)

**How It Works:**

1. **QueryService** builds queries that combine activity buckets with AFK buckets
2. Query uses `filter_keyvals` to get only "not-afk" events
3. Query uses `filter_period_intersect` to filter activity events by AFK periods
4. Server-side filtering ensures only active time is counted

**Example Query:**
```javascript
events = query_bucket("aw-watcher-window_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
events = filter_period_intersect(events, not_afk);
RETURN = events;
```

**Example AFK Event from ActivityWatch:**
```json
{
  "timestamp": "2025-10-10T10:00:00Z",
  "duration": 300,
  "data": {
    "status": "not-afk"  // or "afk"
  }
}
```

**Services Using AFK Filtering:**
- ✅ `WindowActivityService` - Only counts active window time
- ✅ `WebActivityService` - Only counts active browsing time
- ✅ `EditorActivityService` - Only counts active coding time
- ✅ `DailySummaryService` - Uses AFK-filtered data from all services

---

## Category Integration

### Status: ✅ Fully Integrated

The `CategoryService` is **fully integrated** with ActivityWatch's native category system, providing read and write access to server-stored categories.

### ActivityWatch's Native Category System

ActivityWatch stores categories in its **settings** on the server:

- **Storage Location**: Server settings at `/api/0/settings/classes`
- **Web UI Storage**: Also stored in browser localStorage (legacy)
- **Format**: JSON array of category objects
- **Access**: Via ActivityWatch web UI or settings API

**Example ActivityWatch Category:**
```json
{
  "id": 1,
  "name": ["Work", "Email"],
  "rule": {
    "type": "regex",
    "regex": "gmail|outlook|mail"
  },
  "data": {
    "color": "#4285F4",
    "score": 1
  }
}
```

### MCP Server's Category Implementation

The MCP server is **fully integrated** with ActivityWatch's category system:

- **Primary Storage**: ActivityWatch server settings at `/api/0/settings/classes`
- **Fallback Storage**: `AW_CATEGORIES` environment variable (if server unavailable)
- **Format**: JSON array (same structure as ActivityWatch)
- **Access**: Read on startup, write on every modification
- **Matching Logic**: Same regex-based matching as ActivityWatch web UI

**Integration Features:**

1. ✅ **Read from ActivityWatch**: Loads categories from server on startup
2. ✅ **Write to ActivityWatch**: Saves all changes back to server
3. ✅ **Sync with Web UI**: Changes appear immediately in web UI
4. ✅ **LLM Management**: LLMs can create, update, and delete categories
5. ✅ **Fallback Support**: Uses environment variable if server unavailable

### How It Works

The integration is implemented using a **hybrid approach**:

#### On Startup

1. **Try to load from ActivityWatch server** first:
   ```typescript
   const settings = await this.client.getSettings();
   if (settings.classes && Array.isArray(settings.classes)) {
     this.setCategories(settings.classes);
     logger.info(`Loaded ${settings.classes.length} categories from ActivityWatch server`);
     return;
   }
   ```

2. **Fall back to environment variable** if server unavailable:
   ```typescript
   const envCategories = process.env.AW_CATEGORIES;
   if (envCategories) {
     const categories = JSON.parse(envCategories);
     this.setCategories(categories);
     logger.info(`Loaded ${categories.length} categories from environment variable`);
   }
   ```

#### On Category Modification

Every time a category is added, updated, or deleted:

```typescript
async saveToActivityWatch(): Promise<void> {
  await this.client.updateSettings('classes', this.categories);
  logger.info(`Saved ${this.categories.length} categories to ActivityWatch server`);
}
```

This ensures changes are **immediately persisted** to the server.

### Benefits of This Approach

**Pros:**
- ✅ Uses ActivityWatch as the authoritative source
- ✅ Categories stay in sync with web UI
- ✅ LLMs can manage categories programmatically
- ✅ Graceful fallback if server unavailable
- ✅ Single source of truth
- ✅ Changes are immediately persistent

**Cons:**
- ⚠️ Requires ActivityWatch server to be running
- ⚠️ Requires write permissions to settings endpoint
- ⚠️ Could overwrite categories if multiple clients modify simultaneously

---

## MCP Tools for Category Management

The MCP server provides 4 tools for LLM-assisted category management:

### 1. `aw_list_categories`
Lists all configured categories with their IDs, names, and regex patterns.

### 2. `aw_add_category`
Creates a new category with a hierarchical name and regex pattern.

**Example**:
```json
{
  "name": "aw_add_category",
  "arguments": {
    "name": ["Work", "Meetings"],
    "regex": "zoom|teams|meet|webex"
  }
}
```

### 3. `aw_update_category`
Updates an existing category's name or regex pattern.

**Example**:
```json
{
  "name": "aw_update_category",
  "arguments": {
    "id": 5,
    "regex": "zoom|teams|meet|webex|slack"
  }
}
```

### 4. `aw_delete_category`
Permanently deletes a category from ActivityWatch.

**Example**:
```json
{
  "name": "aw_delete_category",
  "arguments": {
    "id": 5
  }
}
```

See `docs/CATEGORY_MANAGEMENT.md` for detailed usage examples and best practices.

---

## Testing the Integration

### 1. Verify Categories Load from ActivityWatch

Start the MCP server and check logs:
```bash
npm run build && node dist/index.js
```

Look for:
```
[INFO] Loading categories...
[INFO] Loaded 5 categories from ActivityWatch server
```

### 2. Test Category Management via MCP

Use an LLM to:
1. List categories: `aw_list_categories`
2. Add a category: `aw_add_category`
3. Verify in web UI: Open ActivityWatch web UI and check settings

### 3. Verify Sync with Web UI

1. **Create category via MCP**:
   ```json
   {
     "name": "aw_add_category",
     "arguments": {
       "name": ["Test"],
       "regex": "test"
     }
   }
   ```

2. **Check ActivityWatch settings**:
   ```bash
   curl http://localhost:5600/api/0/settings | jq '.classes'
   ```

3. **Verify in web UI**: Refresh ActivityWatch web UI and check categories

### 4. Test Fallback Behavior

1. **Stop ActivityWatch server**
2. **Set environment variable**:
   ```bash
   export AW_CATEGORIES='[{"id":1,"name":["Test"],"rule":{"type":"regex","regex":"test"}}]'
   ```
3. **Start MCP server** - should load from environment variable

---

## Conclusion

- **AFK tracking**: ✅ Fully integrated with ActivityWatch
- **Categories**: ✅ **Fully integrated** with read/write access
- **Window Activity**: ✅ Fully integrated with ActivityWatch
- **Web Activity**: ✅ Fully integrated with ActivityWatch

The MCP server now provides **complete integration** with ActivityWatch's category system, enabling LLMs to help users organize and analyze their activity data intelligently.

