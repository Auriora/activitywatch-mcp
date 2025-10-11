# Category Auto-Reload Feature

## Overview

The MCP server now automatically reloads categories from the ActivityWatch server whenever the `aw_list_categories` tool is called. This ensures that the MCP always has the latest category data, even if categories were modified externally (e.g., through the ActivityWatch web UI or direct API calls).

## Changes Made

### 1. Added `reloadCategories()` Method

**File**: `src/services/category.ts`

Added a new method to the `CategoryService` class:

```typescript
/**
 * Reload categories from ActivityWatch server
 * This is useful when categories may have been modified externally
 */
async reloadCategories(): Promise<void> {
  logger.debug('Reloading categories from ActivityWatch server');
  await this.loadFromActivityWatch();
}
```

This method wraps the existing `loadFromActivityWatch()` method and provides a clear intent for on-demand reloading.

### 2. Updated `aw_list_categories` Tool

**File**: `src/index.ts`

Modified the `aw_list_categories` tool handler to reload categories before listing:

```typescript
case 'aw_list_categories': {
  logger.debug('Listing categories');

  // Reload categories from server to ensure we have the latest
  await categoryService.reloadCategories();

  const categories = categoryService.getCategories();
  // ... rest of the handler
}
```

### 3. Updated Tool Description

Updated the `aw_list_categories` tool description to document the auto-reload behavior:

```
CAPABILITIES:
- Automatically reloads categories from server to ensure latest data
- Lists all categories with their IDs, names, and rules
- Shows hierarchical category structure (e.g., "Work > Email")
- Displays regex patterns used for matching
- Returns categories from ActivityWatch server settings
```

## Benefits

### Before This Change
- Categories were loaded only once at MCP server startup
- If categories were modified externally, the MCP would have stale data
- Required restarting the MCP server to see updated categories

### After This Change
- Categories are reloaded every time `aw_list_categories` is called
- Always shows the latest category data from the server
- No need to restart the MCP server when categories change externally
- Seamless synchronization between web UI and MCP

## Use Cases

This feature is particularly useful when:

1. **Multiple Clients**: Using both the ActivityWatch web UI and the MCP simultaneously
2. **External Updates**: Categories are modified through direct API calls
3. **Debugging**: Testing category changes without restarting the MCP server
4. **Collaboration**: Multiple users/tools modifying categories on the same ActivityWatch instance

## Performance Considerations

- The reload operation makes an HTTP request to the ActivityWatch server
- This adds minimal latency (typically < 100ms on localhost)
- Only affects the `aw_list_categories` tool
- Other category operations (add/update/delete) already interact with the server, so no additional overhead

## Implementation Notes

### Why Only `aw_list_categories`?

We chose to reload only in the list operation because:

1. **Add/Update/Delete**: These operations already save to the server immediately, so they have the latest data
2. **List**: This is the primary read operation where stale data would be most noticeable
3. **Performance**: Reloading on every operation would be wasteful for write operations

### Future Enhancements

Potential improvements for the future:

1. **Caching with TTL**: Cache categories for a short period (e.g., 30 seconds) to reduce API calls
2. **Reload on All Operations**: Add optional reload to other operations if needed
3. **Change Detection**: Only reload if server data has changed (using ETags or timestamps)
4. **Background Refresh**: Periodically refresh categories in the background

## Testing

To verify the feature works:

1. Start the MCP server
2. Call `aw_list_categories` to see current categories
3. Modify categories through the web UI or API
4. Call `aw_list_categories` again - should show updated categories immediately
5. No server restart required!

## Related Files

- `src/services/category.ts` - Category service implementation
- `src/index.ts` - MCP tool handlers
- `docs/CATEGORY_MANAGEMENT.md` - Category management documentation
- `docs/ACTIVITYWATCH_INTEGRATION.md` - ActivityWatch integration details

