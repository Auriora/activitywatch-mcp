# Documentation Guide

**Last updated:** October 11, 2025

## Structure Overview

This documentation is organized for different audiences and use cases:

```
docs/
├── index.md                     # 📋 Main documentation landing page
├── getting-started/
│   └── quickstart.md           # 🚀 5-minute setup guide
├── concepts/
│   ├── canonical-events.md     # 💡 How unified activity tracking works
│   ├── categories.md           # 🏷️  Activity classification system  
│   └── CATEGORY_MANAGEMENT.md  # 📖 Detailed category management guide
├── reference/
│   ├── tools.md               # 📚 Complete tool API reference
│   └── activitywatch-integration.md # 🔗 Integration compatibility
├── architecture/
│   └── implementation.md       # 🏗️  Technical implementation details
├── developer/
│   ├── best-practices.md       # ✨ MCP tool description best practices
│   └── logging-and-health.md   # 🔍 Operational monitoring features
├── updates/
│   ├── README.md               # 📝 What Was Implemented docs guide
│   ├── _TEMPLATE.md            # 🧱 Copy-paste skeleton for updates
│   └── index.md                # 🧭 Updates index
└── archive/                    # 📦 Historical documents (status updates, etc.)
```

## What Goes Where

### Getting Started
- **quickstart.md** - Installation, configuration, first usage
- Keep practical, step-by-step instructions
- Focus on "time to first success"

### Concepts  
- **canonical-events.md** - Core concept of unified activity tracking
- **categories.md** - How activity classification works
- **CATEGORY_MANAGEMENT.md** - Detailed category usage guide
- Explain the "why" and "how" of key features
- Link to reference docs for implementation details

### Reference
- **tools.md** - Complete API reference for all MCP tools
- **activitywatch-integration.md** - Integration compatibility matrix
- Authoritative parameter lists, return types, examples
- One source of truth for tool behavior

### Architecture
- **implementation.md** - Technical design decisions and architecture
- Service layer descriptions, data flow diagrams
- For developers extending or debugging the system

### Developer
- **best-practices.md** - MCP tool description patterns
- **logging-and-health.md** - Operational features
- For contributors and advanced users

### Updates
- Task-scoped "What Was Implemented" documents
- Use `_TEMPLATE.md` for new entries and add to `updates/index.md`
- Complement the root CHANGELOG with deeper, task-specific context

### Archive
- Status updates, implementation summaries, refactoring notes
- Historical documents that were useful during development
- Keep for reference but not part of main documentation

## Content Guidelines

### Writing Style
- **Be concise** - Prefer bullet points over long paragraphs
- **Be specific** - Include examples and exact parameter names
- **Cross-link** - Reference related concepts and tools
- **Update dates** - Add "Last updated:" to track freshness

### Avoiding Duplication
- **One home per concept** - Pick the best location and link elsewhere
- **Reference don't repeat** - Link to the Tools Reference rather than redefining parameters
- **Consolidate examples** - One good example is better than three scattered ones

### Maintenance
- **Update cross-links** when moving files
- **Check for broken links** periodically
- **Remove outdated status language** - No "Build successful" in concept docs
- **Keep implementation current** - Update when code changes

## Link Conventions

### Internal Links (examples)

Examples only; these paths are shown relative to nested docs and may not resolve from this file.

```
Tool Reference → ../reference/tools.md
Canonical Events → ../concepts/canonical-events.md
Tool Reference (aw_get_activity section) → ../reference/tools.md#aw_get_activity
```

### External Links  
```markdown
[ActivityWatch](https://activitywatch.net/)
[MCP Specification](https://modelcontextprotocol.io/)
```

### Code References
```markdown
See `src/services/unified-activity.ts` for implementation details.
```

## Documentation Workflow

### Adding New Features
1. **Update tools.md** if adding/changing MCP tools
2. **Add concept doc** for new major features
3. **Update integration matrix** if changing ActivityWatch integration
4. **Cross-link** from related documents

### Fixing Issues
1. **Check one source of truth** - Don't duplicate fixes
2. **Update cross-references** if changing structure
3. **Test examples** to ensure they work
4. **Update "Last updated" dates**

### Restructuring
1. **Move files** to new locations
2. **Update all cross-links** to new paths
3. **Add redirects** in old locations if needed
4. **Update README.md** references

## Common Patterns

### Tool Documentation
```markdown
## tool_name

**Brief description with when to use.**

### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|

### Returns
```typescript
interface ReturnType { ... }
```

### Example
```json
{ "parameter": "value" }
```
```

### Concept Documentation
```markdown
# Concept Name

## Overview
Brief explanation of what this is and why it matters.

## How It Works
Step-by-step explanation with examples.

## Integration
How this concept relates to tools and usage.

## References
- [Related Concept](concepts/canonical-events.md)
- [Tool Reference](reference/tools.md)
```

## Quality Checklist

Before committing documentation changes:

- [ ] **Accuracy** - Examples work and parameters are correct
- [ ] **Completeness** - All parameters and return values documented  
- [ ] **Clarity** - Can a new user follow the instructions?
- [ ] **Currency** - Reflects current implementation
- [ ] **Cross-links** - Internal references work
- [ ] **Consistency** - Follows established patterns
- [ ] **Conciseness** - No unnecessary duplication

## Migration Notes

This restructure (October 2025) consolidated:
- Multiple canonical events docs → single concept doc
- Parameter descriptions → tools reference
- Category feature docs → unified categories concept  
- Status/summary docs → archived (content merged to CHANGELOG)
- Implementation details → architecture section

**Benefits:**
- ✅ No duplication - one source of truth per concept
- ✅ Logical organization - concepts vs reference vs implementation
- ✅ Up-to-date content - removed outdated status language
- ✅ Better discoverability - clear hierarchy and navigation
