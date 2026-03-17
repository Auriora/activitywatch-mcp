# ActivityWatch MCP Server Documentation

**Last updated:** March 17, 2026

An MCP (Model Context Protocol) server that provides LLM agents with tools to query and analyze ActivityWatch time tracking data.

## Quick Navigation

### 🚀 Getting Started
- [**Quick Start Guide**](getting-started/quickstart.md) - Get up and running in 5 minutes

### 💡 Core Concepts
- [**Canonical Events**](concepts/canonical-events.md) - How unified activity tracking works
- [**Categories**](concepts/categories.md) - Classify activities with regex rules

### 📚 Reference
- [**Tools Reference**](reference/tools.md) - Complete tool documentation and parameters
- [**ActivityWatch Integration**](reference/activitywatch-integration.md) - How the MCP integrates with ActivityWatch

### 🏗️ Architecture
- [**Implementation Details**](architecture/implementation.md) - Technical architecture and design decisions

### ✅ Checklist
- [**Prioritized Implementation Checklist**](checklist/prioritized-implementation-checklist.md) - Remaining implementation work ordered by value

### 👩‍💻 Developer Guide
- [**Best Practices**](developer/best-practices.md) - MCP tool description best practices
- [**Logging & Health**](developer/logging-and-health.md) - Operational features and debugging

### 🗺️ Plans
- [**Active Plans**](plans/index.md) - Forward-looking multi-step initiatives
- [About Plans](plans/README.md) - How and when to draft planning documents

### 📝 Updates
- [**Latest Updates**](updates/index.md) - Task-scoped "What Was Implemented" documents
- [About Updates](updates/README.md) - How to write and organize updates

## What's This For?

This MCP server enables LLM agents (like Claude) to help users:
- **Analyze productivity** - "How much time did I spend coding today?"
- **Track habits** - "What websites do I visit most?"
- **Understand patterns** - "When am I most productive during the day?"
- **Manage categories** - "Create a category for my gaming activities"

## Who Should Use This?

- **End Users**: Anyone who wants LLM assistance with their ActivityWatch data
- **Developers**: Building MCP integrations or extending the functionality
- **Researchers**: Analyzing computer usage patterns with AI assistance

## Key Features

- ✅ **Unified Activity Data** - Combines window, browser, and editor activity
- ✅ **AFK Filtering** - Only counts active working time
- ✅ **Category Management** - LLM-assisted activity classification
- ✅ **Multi-Device Support** - Aggregates data across devices
- ✅ **Smart Defaults** - Minimal configuration required

## Architecture Overview

```
┌─────────────────────────────────────┐
│         MCP Tools Layer             │  ← LLM-friendly tool interfaces
├─────────────────────────────────────┤
│      Business Logic Services        │  ← Activity analysis & processing
├─────────────────────────────────────┤
│    ActivityWatch Client Layer       │  ← Query API integration
├─────────────────────────────────────┤
│      ActivityWatch Server           │  ← Data storage & collection
└─────────────────────────────────────┘
```

## Documentation Structure

- **Getting Started**: Installation and initial setup
- **Concepts**: Key ideas like canonical events and categories
- **Reference**: Tool APIs and integration details
- **Architecture**: Implementation and design decisions
- **Checklist**: Prioritized outstanding implementation work
- **Plans**: Living strategies and multi-phase roadmaps
- **Developer**: Contribution guidelines and operational docs
- **Updates**: Task-scoped implementation notes and logs

---

For questions or issues, see the [GitHub repository](https://github.com/auriora/activitywatch-mcp) or check the troubleshooting sections in each guide.
