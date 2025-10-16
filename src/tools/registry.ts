import type { Tool } from '@modelcontextprotocol/sdk/types.js';

import type { BucketInfo, Capabilities } from '../types.js';
import { CapabilitiesService } from '../services/capabilities.js';
import { tools as allTools } from './definitions.js';

type BucketRequirement =
  | 'currentwindow'
  | 'web.tab.current'
  | 'app.editor.activity'
  | 'afkstatus'
  | 'aw-import-ical';

type Requirement = (capabilities: Capabilities) => boolean;

interface ToolRule {
  readonly check: Requirement;
  readonly requiresAnyOf?: readonly BucketRequirement[];
  readonly requiresAllOf?: readonly BucketRequirement[];
}

const TOOL_RULES: Record<string, ToolRule> = {
  aw_get_activity: {
    check: capabilities =>
      capabilities.has_window_tracking ||
      capabilities.has_browser_tracking ||
      capabilities.has_editor_tracking,
    requiresAnyOf: ['currentwindow', 'web.tab.current', 'app.editor.activity'],
  },
  aw_get_period_summary: {
    check: capabilities =>
      capabilities.has_window_tracking ||
      capabilities.has_browser_tracking ||
      capabilities.has_editor_tracking,
    requiresAnyOf: ['currentwindow', 'web.tab.current', 'app.editor.activity'],
  },
  aw_get_calendar_events: {
    check: capabilities => capabilities.has_calendar_events,
    requiresAnyOf: ['aw-import-ical'],
  },
  aw_get_meeting_context: {
    check: capabilities => capabilities.has_calendar_events,
    requiresAnyOf: ['aw-import-ical'],
  },
  aw_query_events: {
    check: capabilities =>
      capabilities.has_window_tracking ||
      capabilities.has_browser_tracking ||
      capabilities.has_editor_tracking ||
      capabilities.has_afk_detection ||
      capabilities.has_calendar_events,
    requiresAnyOf: [
      'currentwindow',
      'web.tab.current',
      'app.editor.activity',
      'afkstatus',
      'aw-import-ical',
    ],
  },
};

function matchesRequirement(bucket: BucketInfo, requirement: BucketRequirement): boolean {
  switch (requirement) {
    case 'currentwindow':
      return bucket.type === 'currentwindow' || bucket.type.includes('window');
    case 'web.tab.current':
      return bucket.type === 'web.tab.current' || bucket.type.includes('web');
    case 'app.editor.activity':
      return bucket.type === 'app.editor.activity' || bucket.type.includes('editor');
    case 'afkstatus':
      return bucket.type === 'afkstatus' || bucket.type.includes('afk');
    case 'aw-import-ical':
      return (
        bucket.type === 'aw-import-ical' ||
        bucket.type.includes('import-ical') ||
        bucket.type.includes('calendar') ||
        bucket.id.startsWith('aw-import-ical')
      );
  }
}

function bucketRequirementMet(
  buckets: readonly BucketInfo[],
  requirement: BucketRequirement
): boolean {
  return buckets.some(bucket => matchesRequirement(bucket, requirement));
}

function filterTools(capabilities: Capabilities): Tool[] {
  return allTools.filter(tool => {
    const rule = TOOL_RULES[tool.name];
    return rule ? rule.check(capabilities) : true;
  });
}

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }

  return true;
}

export interface ToolAvailability {
  readonly name: string;
  readonly enabled: boolean;
  readonly requires_any_of: readonly BucketRequirement[];
  readonly requires_all_of: readonly BucketRequirement[];
  readonly missing_bucket_types: readonly BucketRequirement[];
}

export function buildToolAvailability(
  capabilities: Capabilities,
  buckets: readonly BucketInfo[]
): ToolAvailability[] {
  return allTools.map(tool => {
    const rule = TOOL_RULES[tool.name];

    if (!rule) {
      return {
        name: tool.name,
        enabled: true,
        requires_any_of: [],
        requires_all_of: [],
        missing_bucket_types: [],
      };
    }

    const requiresAnyOf = [...(rule.requiresAnyOf ?? [])];
    const requiresAllOf = [...(rule.requiresAllOf ?? [])];

    const hasAnyOf = requiresAnyOf.length === 0 || requiresAnyOf.some(req => bucketRequirementMet(buckets, req));
    const missingAnyOf = hasAnyOf ? [] : requiresAnyOf;
    const missingAllOf = requiresAllOf.filter(req => !bucketRequirementMet(buckets, req));

    const missingBucketTypes = [...new Set([...missingAnyOf, ...missingAllOf])];

    return {
      name: tool.name,
      enabled: rule.check(capabilities),
      requires_any_of: requiresAnyOf,
      requires_all_of: requiresAllOf,
      missing_bucket_types: missingBucketTypes,
    };
  });
}

export class ToolRegistry {
  private currentTools: Tool[] = [];
  private currentToolNames = new Set<string>();
  private initialized = false;

  constructor(private readonly capabilitiesService: CapabilitiesService) {}

  async initialize(): Promise<{ tools: Tool[]; capabilities: Capabilities }> {
    const { tools, capabilities } = await this.refresh(true);
    return { tools, capabilities };
  }

  async refresh(force = false): Promise<{
    tools: Tool[];
    capabilities: Capabilities;
    changed: boolean;
  }> {
    if (force) {
      this.capabilitiesService.clearCache();
    }

    const capabilities = await this.capabilitiesService.detectCapabilities();
    const tools = filterTools(capabilities);
    const toolNames = new Set(tools.map(tool => tool.name));
    const changed = !this.initialized || !setEquals(this.currentToolNames, toolNames);

    this.currentTools = tools;
    this.currentToolNames = toolNames;
    this.initialized = true;

    return {
      tools,
      capabilities,
      changed,
    };
  }

  getTools(): Tool[] {
    return this.currentTools;
  }

  isEnabled(name: string): boolean {
    return this.currentToolNames.has(name);
  }

  getRule(name: string): ToolRule | undefined {
    return TOOL_RULES[name];
  }
}

