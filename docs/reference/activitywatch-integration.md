# ActivityWatch Integration Status

Last updated: October 11, 2025

This document explains how the MCP server integrates with ActivityWatch's native features.

## Summary

| Feature | Integration Status | Details |
|---------|-------------------|----------|
| **AFK Tracking** | ✅ Fully Integrated | Server-side AFK filtering via query API |
| **Categories** | ✅ Fully Integrated | Server settings as primary storage, env var fallback |
| **Window Activity** | ✅ Fully Integrated | Uses ActivityWatch window tracking buckets |
| **Web Activity** | ✅ Fully Integrated | Uses ActivityWatch browser watcher buckets |

---

## AFK Tracking Integration

- AFK filtering is implemented across all tools using ActivityWatch's query API.
- Only "not-afk" periods are counted; active time only (no background/away time).
- Browser/editor data is only included when those windows were active (canonical events).
- Graceful degradation when AFK buckets are unavailable (falls back to unfiltered events).

For conceptual background and query structure, see: ../concepts/canonical-events.md

Services using AFK filtering:
- WindowActivityService, WebActivityService, EditorActivityService, DailySummaryService

---

## Category Integration

The MCP server is fully integrated with ActivityWatch's native category system.

- Primary storage: ActivityWatch server settings at `/api/0/settings/classes`
- Fallback storage: `AW_CATEGORIES` environment variable (used only if server settings unavailable)
- Categories sync immediately to the ActivityWatch web UI
- Same regex-based matching as ActivityWatch UI (case-insensitive)

Typical lifecycle:
1. Load categories from ActivityWatch settings on startup (preferred)
2. If unavailable, load from `AW_CATEGORIES` env var
3. On any change, write back to ActivityWatch settings (authoritative source)

For category concepts and organization guidance, see: ../concepts/categories.md

---

## MCP Tools for Category Management

The server exposes four tools for LLM-assisted category management:
- `aw_list_categories` — List existing categories
- `aw_add_category` — Create a new category
- `aw_update_category` — Update name/regex/color/score
- `aw_delete_category` — Permanently delete a category

Usage examples and parameter details are maintained in the Tools Reference: ../reference/tools.md

For workflows and best practices, see the guide: ../concepts/CATEGORY_MANAGEMENT.md

---

## Testing the Integration

- Start the server and observe logs for category load/save messages
- Use the tools above to add/update/delete categories, then verify in the ActivityWatch web UI
- Optional: Inspect settings via API (`/api/0/settings`) to confirm persistence

---

## Conclusion

- AFK tracking: Fully integrated using ActivityWatch's query API and canonical events model
- Categories: Fully integrated with ActivityWatch server settings as the source of truth (env var fallback)
- Window/Web/Editor activity: Fully integrated and AFK-filtered

For API usage, parameters, and return shapes, refer to: ../reference/tools.md
