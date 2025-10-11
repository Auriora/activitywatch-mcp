/**
 * Window Title Parsing Utilities
 * 
 * Extracts structured information from window titles across different applications.
 */

/**
 * Terminal information extracted from window title
 */
export interface TerminalInfo {
  username: string;
  hostname: string;
  directory: string;
  isRemote: boolean;
  isSSH: boolean;
}

/**
 * IDE information extracted from window title
 *
 * NOTE: Only used when editor bucket data is NOT available.
 * Primary purpose is to detect dialogs/modals that should be
 * filtered out from productive coding time.
 */
export interface IDEInfo {
  isDialog: boolean;
  dialogType?: string;
  project?: string;  // Fallback when no editor bucket
  file?: string;      // Fallback when no editor bucket
}

/**
 * Browser information extracted from window title
 *
 * NOTE: This is NOT used in the current implementation because
 * the browser bucket provides superior data (url, domain, title).
 * Kept for potential future use cases.
 */
export interface BrowserInfo {
  pageTitle: string;
  siteName?: string;
  browser: string;
}

/**
 * Configuration for title parsing
 */
export interface TitleParserConfig {
  localHostname: string;
  terminalApps: string[];
  ideApps: string[];
  dialogPatterns: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TitleParserConfig = {
  localHostname: 'unknown',
  terminalApps: ['kgx', 'gnome-terminal', 'konsole', 'Terminal', 'iTerm2', 'Alacritty', 'kitty'],
  ideApps: [
    'jetbrains-webstorm', 'jetbrains-pycharm', 'jetbrains-idea', 'jetbrains-goland',
    'jetbrains-rider', 'jetbrains-clion', 'jetbrains-phpstorm', 'jetbrains-rubymine',
    'Code', 'Visual Studio Code', 'VSCode', 'code'
  ],
  dialogPatterns: [
    'Confirm Exit',
    'Accept All Changes?',
    'Rename',
    'Delete',
    'Move',
    'Tip of the Day',
    'New Agent Session',
    'Commit:',
    'Push',
    'Pull',
    'Merge',
    'Rebase'
  ]
};

let config: TitleParserConfig = { ...DEFAULT_CONFIG };

/**
 * Set the configuration for title parsing
 */
export function setTitleParserConfig(newConfig: Partial<TitleParserConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get the current configuration
 */
export function getTitleParserConfig(): TitleParserConfig {
  return { ...config };
}

/**
 * Parse terminal window title to extract hostname, directory, etc.
 * 
 * Supports patterns like:
 * - "username@hostname: /directory"
 * - "username@hostname:~/directory"
 * - "Console" (generic terminal)
 * 
 * @param title - Window title
 * @param localHostname - Local machine hostname (defaults to config)
 * @returns Parsed terminal info or null if not a terminal title
 */
export function parseTerminalTitle(
  title: string,
  localHostname?: string
): TerminalInfo | null {
  const hostname = localHostname || config.localHostname;
  
  // Pattern: username@hostname: /directory or username@hostname:~/directory
  const match = title.match(/^([^@]+)@([^:]+):\s*(.+)$/);
  
  if (!match) {
    // Not a terminal title with hostname
    return null;
  }
  
  const [, username, parsedHostname, directory] = match;
  
  return {
    username: username.trim(),
    hostname: parsedHostname.trim(),
    directory: directory.trim(),
    isRemote: parsedHostname.trim() !== hostname,
    isSSH: parsedHostname.trim() !== hostname,
  };
}

/**
 * Parse JetBrains IDE window title to detect dialogs and extract basic info.
 *
 * NOTE: Only used when editor bucket data is NOT available.
 * Primary purpose is dialog detection for filtering non-productive time.
 *
 * Supports patterns like:
 * - "Confirm Exit" (dialog) → isDialog: true
 * - "projectName – filename" → project and file as fallback
 * - "projectName" → project as fallback
 *
 * @param title - Window title
 * @returns Parsed IDE info with dialog detection
 */
export function parseIDETitle(title: string): IDEInfo {
  // Check if it's a dialog - these are NOT productive coding time
  const isDialog = config.dialogPatterns.some(pattern =>
    title.includes(pattern)
  );

  if (isDialog) {
    return {
      isDialog: true,
      dialogType: title,
    };
  }

  // Pattern: project – file (using en-dash –)
  // This is a fallback when editor bucket data is not available
  const match = title.match(/^([^–]+)\s*–\s*(.+)$/);

  if (!match) {
    // Just project name or unknown format
    return {
      isDialog: false,
      project: title.trim(),
    };
  }

  const [, project, file] = match;

  return {
    isDialog: false,
    project: project.trim(),
    file: file.trim(),
  };
}

/**
 * Parse browser window title to extract page title and site name
 * 
 * Supports patterns like:
 * - "Page Title — Mozilla Firefox"
 * - "Page Title - Site Name - Google Chrome"
 * - "Page Title"
 * 
 * @param title - Window title
 * @param app - Application name
 * @returns Parsed browser info
 */
export function parseBrowserTitle(title: string, app: string): BrowserInfo {
  const appLower = app.toLowerCase();
  
  // Firefox pattern: "Page Title — Mozilla Firefox"
  if (appLower.includes('firefox')) {
    const match = title.match(/^(.+?)\s*—\s*Mozilla Firefox$/);
    return {
      pageTitle: match ? match[1].trim() : title,
      browser: 'firefox',
    };
  }
  
  // Chrome pattern: "Page Title - Site Name - Google Chrome"
  if (appLower.includes('chrome') || appLower.includes('chromium')) {
    // Remove " - Google Chrome" or " - Chromium" suffix
    const cleanTitle = title
      .replace(/\s*-\s*Google Chrome$/, '')
      .replace(/\s*-\s*Chromium$/, '');
    
    const parts = cleanTitle.split(' - ');
    
    return {
      pageTitle: parts[0].trim(),
      siteName: parts.length > 1 ? parts[parts.length - 1].trim() : undefined,
      browser: appLower.includes('chrome') ? 'chrome' : 'chromium',
    };
  }
  
  // Safari pattern: "Page Title — Safari"
  if (appLower.includes('safari')) {
    const match = title.match(/^(.+?)\s*—\s*Safari$/);
    return {
      pageTitle: match ? match[1].trim() : title,
      browser: 'safari',
    };
  }
  
  // Edge pattern: "Page Title - Microsoft Edge"
  if (appLower.includes('edge')) {
    const match = title.match(/^(.+?)\s*-\s*Microsoft Edge$/);
    return {
      pageTitle: match ? match[1].trim() : title,
      browser: 'edge',
    };
  }
  
  // Generic fallback
  return {
    pageTitle: title,
    browser: app,
  };
}

/**
 * Check if an app is a terminal application
 */
export function isTerminalApp(app: string): boolean {
  const appLower = app.toLowerCase();
  return config.terminalApps.some(termApp => 
    appLower.includes(termApp.toLowerCase())
  );
}

/**
 * Check if an app is an IDE application
 */
export function isIDEApp(app: string): boolean {
  const appLower = app.toLowerCase();
  return config.ideApps.some(ideApp => 
    appLower.includes(ideApp.toLowerCase())
  );
}

/**
 * Check if a title represents a dialog/modal
 */
export function isDialogTitle(title: string): boolean {
  return config.dialogPatterns.some(pattern => 
    title.includes(pattern)
  );
}

