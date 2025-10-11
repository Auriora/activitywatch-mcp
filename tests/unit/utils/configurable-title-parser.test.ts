import { describe, it, expect, beforeEach } from 'vitest';

import {
  getRulesForApp,
  getTitleParsingConfig,
  setTitleParsingConfig,
  validateRule,
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
});
