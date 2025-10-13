# Window Title Parsing Analysis

This document analyzes window title patterns across different applications to identify extractable information.

## Patterns Identified

### 1. Terminal (kgx)

**Pattern**: `username@hostname: /current/directory`

**Examples**:
```
bcherrington@bruce-7490: ~/Projects/Docker
bcherrington@bruce-7490: ~/Projects/Docker/monitoring
bcherrington@bruce-7490: ~/Projects/Bruce-7490
Console
```

**Extractable Information**:
- **Username**: `bcherrington`
- **Hostname**: `bruce-7490` (remote) vs `bruce-5560` (local)
- **Directory**: `~/Projects/Docker`, `~/Projects/Docker/monitoring`
- **Is Remote**: `true` if hostname != local machine
- **Is SSH Session**: Can be inferred from hostname

**Use Cases**:
- Track time spent on different remote servers
- Identify which projects/directories you work in
- Distinguish local vs remote work
- Track SSH session patterns

---

### 2. JetBrains IDEs (WebStorm, PyCharm, etc.)

**Pattern**: `projectName – filename` or `projectName – path/to/filename`

**Examples**:
```
activitywatch-mcp – index.ts
activitywatch-mcp – docs/README.md
activitywatch-mcp – ~/Projects/Webstorm/activitywatch-mcp/dist/index.js
activitywatch-mcp
LICENSE
Confirm Exit
Accept All Changes?
Rename
Delete
New Agent Session
```

**Extractable Information**:
- **Project Name**: `activitywatch-mcp`
- **File Name**: `index.ts`, `README.md`
- **File Path**: `docs/README.md`, `~/Projects/Webstorm/activitywatch-mcp/dist/index.js`
- **Dialog Type**: `Confirm Exit`, `Accept All Changes?`, `Rename`, `Delete`
- **Special States**: `New Agent Session` (Augment/Copilot)

**Use Cases**:
- Track which files you work on most
- Identify project switching patterns
- Filter out dialog/modal time
- Track time in specific file types

---

### 3. Firefox

**Pattern**: `Page Title — Mozilla Firefox`

**Examples**:
```
ActivityWatch — Mozilla Firefox
API — Mozilla Firefox
Watchers — Mozilla Firefox
Product & Features - Augment Code — Mozilla Firefox
Pricing - Augment Code — Mozilla Firefox
Mozilla Firefox
```

**Extractable Information**:
- **Page Title**: `ActivityWatch`, `API`, `Watchers`
- **Site/Service**: Can be inferred from title
- **Browser State**: `Mozilla Firefox` (no page loaded)

**Use Cases**:
- Track which pages you visit (when browser watcher not available)
- Identify research topics from page titles
- Detect browser idle time

---

### 4. Google Chrome

**Pattern**: `Page Title - Site Name` or `Page Title`

**Examples**:
```
Agent Zero
MailHog (lan) - MailHog
ChatGPT - Test SMTP email
Console Home | Root | us-east-1
Versioning - Model Context Protocol - Google Chrome
Grafana (lan) - Import dashboard - Dashboards - Grafana
```

**Extractable Information**:
- **Page Title**: `Agent Zero`, `MailHog (lan)`
- **Site Name**: `MailHog`, `ChatGPT`, `Grafana`
- **Service Type**: Can be inferred (AWS Console, ChatGPT, etc.)

**Use Cases**:
- Track which services you use
- Identify work vs personal browsing
- Track time in specific tools (ChatGPT, AWS Console, etc.)

---

### 5. Portainer (Web App)

**Pattern**: `Portainer | Docker Desktop 7490 — Mozilla Firefox`

**Examples**:
```
Portainer | Docker Desktop 7490 — Mozilla Firefox
```

**Extractable Information**:
- **Application**: `Portainer`
- **Instance**: `Docker Desktop 7490`
- **Browser**: `Mozilla Firefox`

**Use Cases**:
- Track infrastructure management time
- Identify which Docker instances you manage

---

### 6. 1Password

**Pattern**: `Vault Name — Section — 1Password`

**Examples**:
```
Our family — All Items — 1Password
1Password
```

**Extractable Information**:
- **Vault**: `Our family`
- **Section**: `All Items`

**Use Cases**:
- Track password management time
- Identify security-related activities

---

### 7. Utility Applications

**Examples**:
```
galculator
Ulauncher - Application Launcher
flameshot
```

**Extractable Information**:
- **Application Type**: Calculator, Launcher, Screenshot tool
- **Purpose**: Utility/tool usage

**Use Cases**:
- Filter out utility time from productive work
- Track tool usage patterns

---

## Parsing Strategy - Avoiding Redundancy

### Important: Don't Duplicate Bucket Data!

**Browser Title Parsing**: ❌ **NOT IMPLEMENTED**
- Browser bucket already provides: `url`, `domain`, `title`
- Title parsing would be redundant
- **Decision**: Skip browser title parsing entirely

**IDE Title Parsing**: ⚠️ **PARTIAL IMPLEMENTATION**
- Editor bucket already provides: `file`, `project`, `language`, `git`
- Title parsing only useful for: detecting dialogs/modals
- **Decision**: Only parse IDE titles when editor bucket data is NOT available
- **Use case**: Filter out non-productive time (dialogs, commit windows, etc.)

**Terminal Title Parsing**: ✅ **FULL IMPLEMENTATION**
- No terminal bucket exists in ActivityWatch
- Provides completely unique information: `hostname`, `directory`, `isRemote`
- **Decision**: Always parse terminal titles
- **Use case**: Track remote work, SSH sessions, directory-based activity

---

## Proposed Parsing Strategy

### 1. Terminal Title Parser (IMPLEMENTED)

```typescript
// @ts-nocheck
interface TerminalInfo {
  username: string;
  hostname: string;
  directory: string;
  isRemote: boolean;
  isSSH: boolean;
}

function parseTerminalTitle(title: string, localHostname: string): TerminalInfo | null {
  // Pattern: username@hostname: /directory
  const match = title.match(/^([^@]+)@([^:]+):\s*(.+)$/);
  if (!match) return null;
  
  const [, username, hostname, directory] = match;
  return {
    username,
    hostname,
    directory,
    isRemote: hostname !== localHostname,
    isSSH: hostname !== localHostname,
  };
}
```

### 2. IDE Title Parser (PARTIAL - Dialog Detection Only)

**Note**: Only used when editor bucket data is NOT available. Primarily for detecting dialogs/modals.

```typescript
// @ts-nocheck
interface IDEInfo {
  isDialog: boolean;
  dialogType?: string;
  project?: string;  // Fallback only
  file?: string;      // Fallback only
}

function parseIDETitle(title: string): IDEInfo {
  // Dialog patterns - these are NOT productive coding time
  const dialogPatterns = [
    'Confirm Exit', 'Accept All Changes?', 'Rename', 'Delete',
    'New Agent Session', 'Move', 'Tip of the Day', 'Commit:', 'Push', 'Pull'
  ];

  if (dialogPatterns.some(pattern => title.includes(pattern))) {
    return {
      isDialog: true,
      dialogType: title,
    };
  }

  // Pattern: project – file (fallback when no editor bucket)
  const match = title.match(/^([^–]+)\s*–\s*(.+)$/);
  if (!match) {
    return { isDialog: false, project: title };
  }

  const [, project, file] = match;
  return {
    isDialog: false,
    project: project.trim(),
    file: file.trim(),
  };
}
```

### 3. Browser Title Parser - ❌ NOT IMPLEMENTED

**Reason**: Browser bucket already provides superior data (`url`, `domain`, `title`).

Title parsing would be redundant and less accurate than the browser watcher extension data.

## Implementation Plan

### Phase 1: Terminal Parsing (High Priority)

**Why**: Provides immediate value for tracking remote work

**Implementation**:
1. Add `parseTerminalTitle()` function to a new `src/utils/title-parser.ts`
2. Update `UnifiedActivityService` to parse terminal titles
3. Add fields to enriched events:
   ```typescript
   terminal?: {
     hostname: string;
     directory: string;
     isRemote: boolean;
   }
   ```
4. Update grouping to support grouping by hostname

**Benefits**:
- See time spent on each remote machine
- Track which directories you work in
- Distinguish local vs remote work

### Phase 2: IDE Parsing (Medium Priority)

**Why**: Helps filter out dialog time and track file-level activity

**Implementation**:
1. Add `parseIDETitle()` function
2. Filter out dialog events (or mark them separately)
3. Extract project and file information
4. Enhance editor enrichment with title-parsed data

**Benefits**:
- More accurate time tracking (exclude dialogs)
- Better file-level insights
- Project switching patterns

### Phase 3: Browser Parsing (Low Priority)

**Why**: Browser watcher already provides better data

**Implementation**:
1. Add `parseBrowserTitle()` function
2. Use as fallback when browser watcher data unavailable
3. Extract page titles for basic insights

**Benefits**:
- Fallback for when browser extension not installed
- Additional context from page titles

## Configuration

Add to `config/app-names.json`:

```json
{
  "parsing": {
    "localHostname": "bruce-5560",
    "terminalApps": ["kgx", "gnome-terminal", "konsole", "Terminal", "iTerm2"],
    "ideApps": ["jetbrains-webstorm", "jetbrains-pycharm", "Code", "Visual Studio Code"],
    "dialogPatterns": [
      "Confirm Exit",
      "Accept All Changes?",
      "Rename",
      "Delete",
      "Move",
      "Tip of the Day",
      "New Agent Session"
    ]
  }
}
```

## Example Output

### Before Parsing:
```json
{
  "app": "kgx",
  "title": "bcherrington@bruce-7490: ~/Projects/Docker",
  "duration_hours": 0.91
}
```

### After Parsing:
```json
{
  "app": "kgx",
  "title": "bcherrington@bruce-7490: ~/Projects/Docker",
  "duration_hours": 0.91,
  "terminal": {
    "username": "bcherrington",
    "hostname": "bruce-7490",
    "directory": "~/Projects/Docker",
    "isRemote": true,
    "isSSH": true
  }
}
```

## New Query Capabilities

With title parsing, users could query:

1. **Remote Work Analysis**:
   - "Show me time spent on remote machines"
   - "Which remote servers do I use most?"
   - "Time spent on bruce-7490 vs bruce-5560"

2. **Directory Analysis**:
   - "Time spent in ~/Projects/Docker"
   - "Which project directories do I work in most?"

3. **File-Level Analysis**:
   - "Time spent editing index.ts"
   - "Which files do I edit most in WebStorm?"

4. **Work Pattern Analysis**:
   - "Local vs remote work distribution"
   - "SSH session patterns"
   - "Project switching frequency"

## Next Steps

1. Implement terminal title parsing (Phase 1)
2. Add configuration for local hostname
3. Update UnifiedActivityService to use parser
4. Add new grouping options (by hostname, by directory)
5. Update tool descriptions to mention new capabilities
6. Add tests for title parsing
7. Document new query capabilities
