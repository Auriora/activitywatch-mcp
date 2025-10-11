/**
 * Configuration for browser and editor app names
 * 
 * These mappings are used to match window events with browser/editor buckets
 * when building canonical queries. The app names should match what the
 * window watcher reports for each application.
 * 
 * Users can customize these mappings to match their system's app names.
 */

/**
 * Browser app names for matching window events
 * 
 * Key: Browser type (used for bucket detection)
 * Value: Array of possible app names as reported by window watcher
 */
export const BROWSER_APP_NAMES: Record<string, string[]> = {
  chrome: [
    'Google Chrome',
    'chrome.exe',
    'Google-chrome',
    'google-chrome',
    'chrome',
  ],
  chromium: [
    'Chromium',
    'chromium-browser',
    'chromium',
  ],
  firefox: [
    'Firefox',
    'Firefox.exe',
    'firefox',
    'firefox.exe',
    'Firefox Developer Edition',
    'firefoxdeveloperedition',
    'Firefox-esr',
    'Firefox Beta',
    'Nightly',
    'org.mozilla.firefox',
  ],
  opera: [
    'opera.exe',
    'Opera',
  ],
  brave: [
    'brave.exe',
    'Brave',
    'brave-browser',
  ],
  edge: [
    'msedge.exe',
    'Microsoft Edge',
    'microsoft-edge',
  ],
  vivaldi: [
    'Vivaldi-stable',
    'Vivaldi-snapshot',
    'vivaldi.exe',
    'Vivaldi',
  ],
  safari: [
    'Safari',
  ],
};

/**
 * Editor app names for matching window events
 * 
 * Key: Editor type (used for bucket detection)
 * Value: Array of possible app names as reported by window watcher
 */
export const EDITOR_APP_NAMES: Record<string, string[]> = {
  // Visual Studio Code
  vscode: [
    'Code',
    'code.exe',
    'Visual Studio Code',
    'VSCode',
    'code',
  ],
  
  // Vim family
  vim: [
    'vim',
    'nvim',
    'gvim',
    'neovim',
  ],
  
  // Emacs
  emacs: [
    'emacs',
    'Emacs',
  ],
  
  // Sublime Text
  sublime: [
    'sublime_text',
    'Sublime Text',
    'subl',
  ],
  
  // Atom
  atom: [
    'atom',
    'Atom',
  ],
  
  // JetBrains IDEs
  intellij: [
    'idea',
    'IntelliJ IDEA',
    'jetbrains-idea',
  ],
  
  pycharm: [
    'pycharm',
    'PyCharm',
    'jetbrains-pycharm',
  ],
  
  webstorm: [
    'webstorm',
    'WebStorm',
    'jetbrains-webstorm',
  ],
  
  phpstorm: [
    'phpstorm',
    'PhpStorm',
    'jetbrains-phpstorm',
  ],
  
  goland: [
    'goland',
    'GoLand',
    'jetbrains-goland',
  ],
  
  rustrover: [
    'rustrover',
    'RustRover',
    'jetbrains-rustrover',
  ],
  
  clion: [
    'clion',
    'CLion',
    'jetbrains-clion',
  ],
  
  datagrip: [
    'datagrip',
    'DataGrip',
    'jetbrains-datagrip',
  ],
  
  dataspell: [
    'dataspell',
    'DataSpell',
    'jetbrains-dataspell',
  ],
  
  rider: [
    'rider',
    'Rider',
    'jetbrains-rider',
  ],
  
  // Other editors
  obsidian: [
    'obsidian',
    'Obsidian',
  ],
  
  notepadpp: [
    'notepad++.exe',
    'Notepad++',
  ],
  
  gedit: [
    'gedit',
    'Text Editor',
  ],
  
  kate: [
    'kate',
    'Kate',
  ],
  
  nano: [
    'nano',
  ],
};

/**
 * Get browser app names for a specific browser type
 */
export function getBrowserAppNames(browserType: string): string[] {
  return BROWSER_APP_NAMES[browserType.toLowerCase()] || [];
}

/**
 * Get editor app names for a specific editor type
 */
export function getEditorAppNames(editorType: string): string[] {
  return EDITOR_APP_NAMES[editorType.toLowerCase()] || [];
}

/**
 * Detect browser type from bucket ID
 */
export function detectBrowserType(bucketId: string): string | null {
  const lowerBucketId = bucketId.toLowerCase();

  if (lowerBucketId.includes('chrome') && !lowerBucketId.includes('chromium')) {
    return 'chrome';
  }
  if (lowerBucketId.includes('chromium')) {
    return 'chrome'; // Chromium uses same app names
  }
  if (lowerBucketId.includes('firefox')) {
    return 'firefox';
  }
  if (lowerBucketId.includes('opera')) {
    return 'opera';
  }
  if (lowerBucketId.includes('brave')) {
    return 'brave';
  }
  if (lowerBucketId.includes('edge')) {
    return 'edge';
  }
  if (lowerBucketId.includes('vivaldi')) {
    return 'vivaldi';
  }
  if (lowerBucketId.includes('safari')) {
    return 'safari';
  }

  return null;
}

/**
 * Detect editor type from bucket ID
 */
export function detectEditorType(bucketId: string): string | null {
  const lowerBucketId = bucketId.toLowerCase();

  if (lowerBucketId.includes('vscode') || lowerBucketId.includes('code')) {
    return 'vscode';
  }
  if (lowerBucketId.includes('vim')) {
    return 'vim';
  }
  if (lowerBucketId.includes('emacs')) {
    return 'emacs';
  }
  if (lowerBucketId.includes('sublime')) {
    return 'sublime';
  }
  if (lowerBucketId.includes('atom')) {
    return 'atom';
  }
  if (lowerBucketId.includes('intellij') || lowerBucketId.includes('idea')) {
    return 'intellij';
  }
  if (lowerBucketId.includes('pycharm')) {
    return 'pycharm';
  }
  if (lowerBucketId.includes('webstorm')) {
    return 'webstorm';
  }
  if (lowerBucketId.includes('phpstorm')) {
    return 'phpstorm';
  }
  if (lowerBucketId.includes('goland')) {
    return 'goland';
  }
  if (lowerBucketId.includes('rustrover')) {
    return 'rustrover';
  }
  if (lowerBucketId.includes('clion')) {
    return 'clion';
  }
  if (lowerBucketId.includes('datagrip')) {
    return 'datagrip';
  }
  if (lowerBucketId.includes('dataspell')) {
    return 'dataspell';
  }
  if (lowerBucketId.includes('rider')) {
    return 'rider';
  }
  if (lowerBucketId.includes('obsidian')) {
    return 'obsidian';
  }
  if (lowerBucketId.includes('notepad')) {
    return 'notepadpp';
  }
  if (lowerBucketId.includes('gedit')) {
    return 'gedit';
  }
  if (lowerBucketId.includes('kate')) {
    return 'kate';
  }
  if (lowerBucketId.includes('nano')) {
    return 'nano';
  }

  return null;
}

