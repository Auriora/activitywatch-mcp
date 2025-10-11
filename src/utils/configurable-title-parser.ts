/**
 * Configurable Window Title Parser
 * 
 * Parses window titles based on user-defined rules in config/app-names.json
 */

export interface TitleParsingRule {
  name: string;
  description?: string;
  appPatterns: string[];
  titlePattern?: string;
  titlePatterns?: string[];
  captureGroups?: Record<string, number>;
  enrichmentType: 'terminal' | 'ide' | 'custom';
  fields?: Record<string, any>;
  computedFields?: Record<string, string>;
  matchType?: 'regex' | 'contains';
  priority?: number;
}

export interface TitleParsingConfig {
  localHostname: string;
  rules: TitleParsingRule[];
}

export interface ParsedTitleData {
  enrichmentType: 'terminal' | 'ide' | 'custom';
  data: Record<string, any>;
  ruleName: string;
}

let config: TitleParsingConfig = {
  localHostname: 'unknown',
  rules: []
};

/**
 * Set the title parsing configuration
 */
export function setTitleParsingConfig(newConfig: TitleParsingConfig): void {
  config = newConfig;
  // Sort rules by priority (lower number = higher priority)
  config.rules.sort((a, b) => (a.priority || 100) - (b.priority || 100));
}

/**
 * Get the current configuration
 */
export function getTitleParsingConfig(): TitleParsingConfig {
  return { ...config };
}

/**
 * Check if an app name matches a pattern
 * Supports wildcards with *
 */
function appMatchesPattern(app: string, pattern: string): boolean {
  const appLower = app.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  // Convert wildcard pattern to regex
  const regexPattern = patternLower
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
    .replace(/\*/g, '.*'); // Convert * to .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(appLower);
}

/**
 * Find matching rule for an app and title
 */
function findMatchingRule(app: string, title: string): TitleParsingRule | null {
  for (const rule of config.rules) {
    // Check if app matches any of the patterns
    const appMatches = rule.appPatterns.some(pattern => 
      appMatchesPattern(app, pattern)
    );
    
    if (!appMatches) continue;
    
    // Check if title matches
    const matchType = rule.matchType || 'regex';
    
    if (matchType === 'contains' && rule.titlePatterns) {
      // Check if title contains any of the patterns
      const titleMatches = rule.titlePatterns.some(pattern =>
        title.includes(pattern)
      );
      if (titleMatches) return rule;
    } else if (matchType === 'regex' && rule.titlePattern) {
      // Check if title matches regex
      try {
        const regex = new RegExp(rule.titlePattern);
        if (regex.test(title)) return rule;
      } catch (error) {
        console.error(`[TitleParser] Invalid regex in rule "${rule.name}":`, error);
      }
    }
  }
  
  return null;
}

/**
 * Extract data from title using a rule
 */
function extractData(title: string, app: string, rule: TitleParsingRule): Record<string, any> {
  const data: Record<string, any> = {};
  
  // Extract data from regex capture groups
  if (rule.titlePattern && rule.captureGroups) {
    try {
      const regex = new RegExp(rule.titlePattern);
      const match = title.match(regex);
      
      if (match) {
        for (const [fieldName, groupIndex] of Object.entries(rule.captureGroups)) {
          const value = match[groupIndex];
          if (value !== undefined) {
            data[fieldName] = value.trim();
          }
        }
      }
    } catch (error) {
      console.error(`[TitleParser] Error extracting data from rule "${rule.name}":`, error);
    }
  }
  
  // Add static fields
  if (rule.fields) {
    for (const [fieldName, value] of Object.entries(rule.fields)) {
      // Replace special values
      if (value === '$title') {
        data[fieldName] = title;
      } else if (value === '$app') {
        data[fieldName] = app;
      } else {
        data[fieldName] = value;
      }
    }
  }
  
  // Compute dynamic fields
  if (rule.computedFields) {
    for (const [fieldName, expression] of Object.entries(rule.computedFields)) {
      try {
        const computed = evaluateExpression(expression, data, config.localHostname);
        data[fieldName] = computed;
      } catch (error) {
        console.error(`[TitleParser] Error computing field "${fieldName}" in rule "${rule.name}":`, error);
      }
    }
  }
  
  return data;
}

/**
 * Evaluate a simple expression
 * Supports: field !== value, field === value, field
 */
function evaluateExpression(
  expression: string,
  data: Record<string, any>,
  localHostname: string
): any {
  // Replace variables
  let expr = expression;
  
  // Replace localHostname
  expr = expr.replace(/localHostname/g, `"${localHostname}"`);
  
  // Replace data fields
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    const replacement = typeof value === 'string' ? `"${value}"` : String(value);
    expr = expr.replace(regex, replacement);
  }
  
  // Simple evaluation for common patterns
  // !== comparison
  const notEqualsMatch = expr.match(/^"([^"]+)"\s*!==\s*"([^"]+)"$/);
  if (notEqualsMatch) {
    return notEqualsMatch[1] !== notEqualsMatch[2];
  }
  
  // === comparison
  const equalsMatch = expr.match(/^"([^"]+)"\s*===\s*"([^"]+)"$/);
  if (equalsMatch) {
    return equalsMatch[1] === equalsMatch[2];
  }
  
  // Boolean value
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  
  // Fallback: return the expression as-is
  return expr;
}

/**
 * Parse a window title using configured rules
 * 
 * @param app - Application name
 * @param title - Window title
 * @returns Parsed data or null if no rule matches
 */
export function parseTitle(app: string, title: string): ParsedTitleData | null {
  const rule = findMatchingRule(app, title);
  if (!rule) return null;
  
  const data = extractData(title, app, rule);
  
  return {
    enrichmentType: rule.enrichmentType,
    data,
    ruleName: rule.name,
  };
}

/**
 * Check if an app has any parsing rules defined
 */
export function hasParsingRules(app: string): boolean {
  return config.rules.some(rule =>
    rule.appPatterns.some(pattern => appMatchesPattern(app, pattern))
  );
}

/**
 * Get all rules that apply to an app
 */
export function getRulesForApp(app: string): TitleParsingRule[] {
  return config.rules.filter(rule =>
    rule.appPatterns.some(pattern => appMatchesPattern(app, pattern))
  );
}

/**
 * Validate a rule configuration
 */
export function validateRule(rule: TitleParsingRule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!rule.name) {
    errors.push('Rule must have a name');
  }
  
  if (!rule.appPatterns || rule.appPatterns.length === 0) {
    errors.push('Rule must have at least one app pattern');
  }
  
  if (!rule.enrichmentType) {
    errors.push('Rule must have an enrichmentType');
  }
  
  const matchType = rule.matchType || 'regex';
  
  if (matchType === 'regex' && !rule.titlePattern) {
    errors.push('Regex rules must have a titlePattern');
  }
  
  if (matchType === 'contains' && (!rule.titlePatterns || rule.titlePatterns.length === 0)) {
    errors.push('Contains rules must have titlePatterns');
  }
  
  if (rule.titlePattern) {
    try {
      new RegExp(rule.titlePattern);
    } catch (error) {
      errors.push(`Invalid regex pattern: ${error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

