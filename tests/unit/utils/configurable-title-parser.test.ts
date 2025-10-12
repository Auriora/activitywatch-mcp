import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  getRulesForApp,
  getTitleParsingConfig,
  setTitleParsingConfig,
  validateRule,
  parseTitle,
  hasParsingRules,
} from '../../../src/utils/configurable-title-parser.js';
import type { TitleParsingConfig, TitleParsingRule } from '../../../src/utils/configurable-title-parser.js';

const sampleRule: TitleParsingRule = {
  name: 'Terminal Regex',
  appPatterns: ['Terminal'],
  titlePattern: '^user@host: (.+)$',
  captureGroups: { directory: 1 },
  enrichmentType: 'terminal',
};

const sampleConfig: TitleParsingConfig = {
  localHostname: 'host',
  rules: [sampleRule],
};

describe('configurable title parser helpers', () => {
  beforeEach(() => {
    setTitleParsingConfig(sampleConfig);
  });

  it('returns a copy of the current configuration', () => {
    const config = getTitleParsingConfig();
    expect(config).toEqual(sampleConfig);
    expect(config).not.toBe(sampleConfig); // defensive copy
  });

  it('returns matching rules for an app', () => {
    const rules = getRulesForApp('Terminal');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.name).toBe('Terminal Regex');
  });

  it('validates rules and reports configuration issues', () => {
    const validResult = validateRule(sampleRule);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidRule: TitleParsingRule = {
      name: '',
      appPatterns: [],
      enrichmentType: 'ide',
    };

    const invalidResult = validateRule(invalidRule);
    expect(invalidResult.valid).toBe(false);
   expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it('parses titles with capture groups, static fields, and computed expressions', () => {
    setTitleParsingConfig({
      localHostname: 'devbox',
      rules: [
        {
          name: 'IDE Session',
          appPatterns: ['VS Code'],
          titlePattern: '^(.+) — (.+)$',
          captureGroups: { workspace: 1, file: 2 },
          enrichmentType: 'ide',
          fields: {
            raw: '$title',
            appName: '$app',
            fixed: 'static',
          },
          computedFields: {
            isLocal: 'workspace === "devbox"',
            mismatch: 'workspace !== file',
          },
        },
      ],
    });

    const result = parseTitle('VS Code', 'devbox — src/index.ts');
    expect(result).toEqual({
      enrichmentType: 'ide',
      ruleName: 'IDE Session',
      data: {
        workspace: 'devbox',
        file: 'src/index.ts',
        raw: 'devbox — src/index.ts',
        appName: 'VS Code',
        fixed: 'static',
        isLocal: true,
        mismatch: true,
      },
    });
  });

  it('matches contains-based rules and reports availability', () => {
    setTitleParsingConfig({
      localHostname: 'devbox',
      rules: [
        {
          name: 'Browser focus',
          appPatterns: ['Chrome*'],
          matchType: 'contains',
          titlePatterns: ['Stack Overflow'],
          enrichmentType: 'custom',
        },
      ],
    });

    expect(hasParsingRules('Chromium')).toBe(false);
    expect(hasParsingRules('Chrome Canary')).toBe(true);

    const parsed = parseTitle('Chrome Canary', 'Today I learned - Stack Overflow');
    expect(parsed?.ruleName).toBe('Browser focus');
  });

  it('handles invalid regex definitions gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    setTitleParsingConfig({
      localHostname: 'devbox',
      rules: [
        {
          name: 'Broken rule',
          appPatterns: ['Notes'],
          titlePattern: '(',
          enrichmentType: 'custom',
        },
      ],
    });

    expect(parseTitle('Notes', 'Daily note')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TitleParser] Invalid regex in rule "Broken rule":'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('returns null when no rule matches an app/title combination', () => {
    setTitleParsingConfig({
      localHostname: 'devbox',
      rules: [
        {
          name: 'Terminal Regex',
          appPatterns: ['Terminal'],
          titlePattern: '^user@host: (.+)$',
          captureGroups: { directory: 1 },
          enrichmentType: 'terminal',
        },
      ],
    });

    expect(parseTitle('Mail', 'Inbox')).toBeNull();
  });
});
