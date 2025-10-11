# MCP Tool Description Best Practices - Implementation

Last updated: October 11, 2025

This document describes how the ActivityWatch MCP Server tool descriptions follow MCP development best practices to optimize LLM agent performance.

## Best Practices Applied

### 1. **Structured Description Format**

Each tool description follows a consistent structure:

```
Brief one-line summary

WHEN TO USE:
- Specific use cases and scenarios
- User question patterns that match this tool

WHEN NOT TO USE:
- Scenarios where other tools are better
- Explicit anti-patterns to avoid misuse

CAPABILITIES:
- What the tool can do
- Features and functionality
- Data processing performed

LIMITATIONS:
- What the tool cannot do
- Technical constraints
- Data availability requirements

RETURNS:
- Output structure and format
- Key fields in the response
- Format options available
```

### 2. **Clear Contextual Guidance**

**Problem**: LLMs may call inappropriate tools or miss better alternatives.

**Solution**: Each tool explicitly states:
- ✅ When to use it (positive guidance)
- ❌ When NOT to use it (negative guidance with alternatives)
- 🔄 Which tool to use instead for specific scenarios

**Example from `aw_get_window_activity`:**
```
WHEN NOT TO USE:
- For website/browser activity → use aw_get_web_activity instead
- For comprehensive period overview → use aw_get_period_summary instead
- For exact event timestamps → use aw_get_raw_events instead
```

### 3. **Explicit Capabilities and Limitations**

**Problem**: LLMs may hallucinate capabilities or make incorrect assumptions.

**Solution**: Clearly document what the tool CAN and CANNOT do.

**Example from `aw_get_web_activity`:**
```
CAPABILITIES:
- Automatically discovers and aggregates data from all browser tracking buckets
- Combines data across multiple browsers (Chrome, Firefox, Safari, etc.)
- Extracts and normalizes domain names from URLs
...

LIMITATIONS:
- Cannot see page CONTENT or what you read/typed
- Cannot determine if time was productive or not
- Only tracks active tab time (not background tabs)
```

### 4. **User Question Pattern Matching**

**Problem**: LLMs need to map natural language questions to appropriate tools.

**Solution**: Include example question patterns in "WHEN TO USE" sections.

**Examples:**
- `aw_get_window_activity`: "How long did I use VS Code?"
- `aw_get_web_activity`: "What websites did I visit most?"
- `aw_get_period_summary`: "What did I do yesterday?"

### 5. **Prerequisite and Dependency Information**

**Problem**: Tools may fail if prerequisites aren't met.

**Solution**: Document dependencies and suggest checking capabilities first.

**Example from `aw_get_window_activity`:**
```
WHEN NOT TO USE:
- If no window tracking data exists (check with aw_get_capabilities first)

LIMITATIONS:
- Requires window watcher (aw-watcher-window) to be installed and running
```

### 6. **Return Value Documentation**

**Problem**: LLMs need to know what data structure to expect.

**Solution**: Document return structure with field names and types.

**Example from `aw_get_period_summary`:**
```
RETURNS:
- period_type: The requested period (daily, weekly, monthly, etc.)
- period_start/period_end: Period boundaries (ISO 8601 timestamps)
- timezone: Timezone applied to calculations
- total_active_time_hours / total_afk_time_hours: Hours of active vs AFK time
- top_applications / top_websites: Top 5 items with duration and percentage
- top_categories: Optional when categories are configured
- hourly_breakdown / daily_breakdown / weekly_breakdown: Optional detail arrays
- insights: Auto-generated observations about the period
```

### 7. **Response Format Guidance**

**Problem**: LLMs may not know which response format to request.

**Solution**: Explain format options and recommend defaults.

**Example:**
```
Default response is human-readable summary. Use response_format='detailed' for structured data.
```

### 8. **Tool Hierarchy and Routing**

**Problem**: Multiple tools may seem applicable for the same query.

**Solution**: Establish clear hierarchy and routing logic.

**Tool Hierarchy:**
1. **Discovery**: `aw_get_capabilities` (always first)
2. **High-level**: `aw_get_period_summary` (comprehensive overview)
3. **Specific**: `aw_get_window_activity`, `aw_get_web_activity` (focused analysis)
4. **Low-level**: `aw_get_raw_events` (debugging/advanced)

### 9. **Error Prevention**

**Problem**: LLMs may call tools with invalid parameters or missing data.

**Solution**: Proactive guidance to prevent common errors.

**Examples:**
- "ALWAYS call this tool FIRST" (aw_get_capabilities)
- "Use aw_get_capabilities to discover available buckets" (aw_get_raw_events)
- "Check date ranges with aw_get_capabilities" (all time-based tools)

### 10. **Graceful Degradation Documentation**

**Problem**: LLMs may not know how tools behave with partial data.

**Solution**: Document fallback behavior.

**Example from `aw_get_period_summary`:**
```
CAPABILITIES:
- Works even if some data sources are missing (gracefully degrades)
```

## Comparison: Before vs After

### Before (Basic Description)
```
Retrieves application window activity for a time period. Use this to answer questions about:
- Which applications were used and for how long
- What the user was working on during specific times
- Application switching patterns and focus time

This automatically finds the correct window watcher bucket and aggregates data across multiple devices if needed.

Returns human-readable summaries by default. For detailed analysis, use response_format='detailed'.
```

**Issues:**
- No guidance on when NOT to use
- No explicit limitations
- No prerequisite information
- No alternative tool suggestions

### After (Enhanced Description)
```
Analyzes application and window usage over a time period.

WHEN TO USE:
- User asks about time spent in specific applications (e.g., "How long did I use VS Code?")
- Questions about which apps were used during a time period
- Productivity analysis focused on application usage
- Comparing application usage across time periods
- Identifying most-used applications

WHEN NOT TO USE:
- For website/browser activity → use aw_get_web_activity instead
- For comprehensive period overview → use aw_get_period_summary instead
- For exact event timestamps → use aw_get_raw_events instead
- If no window tracking data exists (check with aw_get_capabilities first)

CAPABILITIES:
- Automatically discovers and aggregates data from all window tracking buckets
- Combines data across multiple devices if available
- Filters out system applications (Finder, Dock, etc.) by default
- Normalizes application names (e.g., "Code" → "VS Code")
- Removes very short events (< 5 seconds by default) to filter noise
- Groups by application name or window title
- Calculates total time, percentages, and rankings

LIMITATIONS:
- Cannot see WHAT you did in the application (no content access)
- Cannot determine quality or productivity of work
- Only shows active window time (not background processes)
- Requires window watcher (aw-watcher-window) to be installed and running
- Time periods limited to available data (check date ranges with aw_get_capabilities)

RETURNS:
- total_time_seconds: Total active time in the period
- applications: Array of {name, duration_seconds, duration_hours, percentage, window_titles?}
- time_range: {start, end} timestamps of analyzed period

Default response is human-readable summary. Use response_format='detailed' for structured data.
```

**Improvements:**
- ✅ Clear usage scenarios with examples
- ✅ Explicit anti-patterns with alternatives
- ✅ Comprehensive capability list
- ✅ Honest limitation documentation
- ✅ Prerequisite checking guidance
- ✅ Detailed return structure
- ✅ Response format recommendations

## Impact on LLM Performance

### Expected Improvements

1. **Reduced Tool Selection Errors**
   - LLMs will choose the right tool more often
   - Fewer calls to inappropriate tools
   - Better understanding of tool hierarchy

2. **Better Error Prevention**
   - LLMs will check capabilities first
   - Fewer calls with missing prerequisites
   - Better parameter selection

3. **Improved User Experience**
   - More accurate responses to user queries
   - Fewer failed tool calls
   - Better explanations when tools can't help

4. **Reduced Token Usage**
   - Fewer retry attempts
   - More efficient tool selection
   - Less back-and-forth with error handling

5. **Better Expectation Management**
   - LLMs can explain limitations to users
   - More realistic promises about what's possible
   - Clearer communication about data availability

## Testing Recommendations

To validate these improvements, test with:

1. **Ambiguous Queries**
   - "Show me my activity" → Should route to aw_get_period_summary
   - "What did I work on?" → Should route to aw_get_window_activity

2. **Edge Cases**
   - No data available → Should call aw_get_capabilities first
   - Missing browser data → Should gracefully explain limitation

3. **Tool Selection**
   - Website questions → Should use aw_get_web_activity, not aw_get_window_activity
   - Overview questions → Should use aw_get_period_summary, not multiple specific tools

4. **Error Recovery**
   - Failed tool call → Should suggest checking capabilities
   - Invalid time period → Should explain available date ranges

## Maintenance

When adding new tools:

1. Follow the structured format (WHEN TO USE, WHEN NOT TO USE, CAPABILITIES, LIMITATIONS, RETURNS)
2. Include example user questions in WHEN TO USE
3. Explicitly state which other tools are better for specific scenarios
4. Document all prerequisites and dependencies
5. Be honest about limitations
6. Provide clear return value documentation
7. Recommend default parameter values

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [Anthropic's Guide to Writing Effective Tools](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Best Practices for Tool Descriptions](https://modelcontextprotocol.io/docs/concepts/tools)

## Conclusion

These enhanced tool descriptions follow MCP best practices to:
- Guide LLMs to the right tool for each query
- Prevent common errors and misuse
- Set accurate expectations about capabilities
- Improve overall user experience

The structured format makes it easy for LLMs to quickly understand when and how to use each tool, leading to more accurate and efficient interactions.
