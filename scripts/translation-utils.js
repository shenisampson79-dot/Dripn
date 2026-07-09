/**
 * Parse git diff of i18n-refactored screens to recover original English strings.
 * Maps t('key') lines to their removed hardcoded English counterparts.
 */
const fs = require('fs');
const path = require('path');

function parseGitDiff(diffText) {
  const map = {};
  const lines = diffText.split('\n');
  const removedQueue = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.slice(1).trim();
      // Skip structural/import lines
      if (
        content &&
        !content.startsWith('import ') &&
        !content.startsWith('export ') &&
        !content.startsWith('const ') &&
        !content.startsWith('function ') &&
        !content.startsWith('return ') &&
        !content.startsWith('<') &&
        !content.startsWith('>') &&
        !content.startsWith('}') &&
        !content.startsWith('{') &&
        !content.includes('useTranslations') &&
        !content.includes('useLayoutEffect') &&
        !content.includes('navigation.setOptions')
      ) {
        // Extract string literal content from JSX/text
        const strMatch = content.match(/^["'](.+)["'],?$/);
        const jsxMatch = content.match(/^(.{10,})$/);
        if (strMatch) removedQueue.push(strMatch[1]);
        else if (
          jsxMatch &&
          !content.includes('style=') &&
          !content.includes('type=') &&
          !content.includes('name=') &&
          !content.includes('onPress') &&
          !content.includes('ThemedText') &&
          !content.includes('View') &&
          !content.includes('Feather') &&
          !content.includes('Button') &&
          !content.includes('Card') &&
          !content.includes('Pressable') &&
          !content.includes('Alert.') &&
          !content.includes('//') &&
          content.length > 3
        ) {
          removedQueue.push(content.replace(/,$/, ''));
        }
      }
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      const keyMatches = [...content.matchAll(/t\(['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\)/g)];
      if (keyMatches.length === 1 && removedQueue.length > 0) {
        const key = keyMatches[0][1];
        // Take the most recent meaningful removed text
        const text = removedQueue.pop();
        if (text && text.length > 1 && !text.startsWith('{')) {
          map[key] = text;
        }
      } else if (keyMatches.length > 0) {
        // Multiple keys on one line - clear queue
        removedQueue.length = 0;
      }
    }
  }
  return map;
}

function extractFallbacksFromSource() {
  const ROOT = path.resolve(__dirname, '..');
  const dirs = ['screens', 'components', 'navigation'];
  const re = /\bt\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\s*\)\s*\|\|\s*(['"`])([\s\S]*?)\2/g;
  const fallbacks = {};
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        const c = fs.readFileSync(p, 'utf8');
        let m;
        while ((m = re.exec(c))) fallbacks[m[1]] = m[3];
      }
    }
  }
  dirs.forEach((d) => walk(path.join(ROOT, d)));
  return fallbacks;
}

function flattenDefaults() {
  const ts = fs.readFileSync(path.join(__dirname, '../services/TranslationService.ts'), 'utf8');
  const match = ts.match(/const DEFAULT_TRANSLATIONS[^=]*=\s*(\{[\s\S]*?\n\});\s*\nconst LOCAL_TRANSLATIONS/);
  if (!match) return {};
  const obj = eval('(' + match[1] + ')');
  function flatten(o, prefix = '') {
    const result = {};
    for (const key in o) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof o[key] === 'string') result[fullKey] = o[key];
      else if (o[key] && typeof o[key] === 'object' && !Array.isArray(o[key]))
        Object.assign(result, flatten(o[key], fullKey));
    }
    return result;
  }
  return flatten(obj);
}

function extractExistingSpanish() {
  const ts = fs.readFileSync(path.join(__dirname, '../services/TranslationService.ts'), 'utf8');
  const esBlock = ts.match(/es:\s*\{([\s\S]*?)\n  \},\n  fr:/);
  if (!esBlock) return {};
  const result = {};
  const re = /'((?:\\'|[^'])*)':\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(esBlock[1]))) {
    result[m[1].replace(/\\'/g, "'")] = m[2].replace(/\\'/g, "'");
  }
  return result;
}

function humanizeKey(key) {
  const last = key.split('.').pop();
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function flatToNested(flat) {
  const result = {};
  for (const key of Object.keys(flat).sort()) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = current[parts[i]] || {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = flat[key];
  }
  return result;
}

function nestedToFlat(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'string') result[fullKey] = obj[key];
    else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]))
      Object.assign(result, nestedToFlat(obj[key], fullKey));
  }
  return result;
}

module.exports = {
  parseGitDiff,
  extractFallbacksFromSource,
  flattenDefaults,
  extractExistingSpanish,
  humanizeKey,
  flatToNested,
  nestedToFlat,
};

// CLI: extract git english map
if (require.main === module) {
  const diffPath = path.join(__dirname, 'git-i18n-diff.txt');
  const gitMap = fs.existsSync(diffPath) ? parseGitDiff(fs.readFileSync(diffPath, 'utf8')) : {};
  const fallbacks = extractFallbacksFromSource();
  const defaults = flattenDefaults();
  console.log('Git diff English:', Object.keys(gitMap).length);
  console.log('Fallbacks:', Object.keys(fallbacks).length);
  console.log('Defaults flat:', Object.keys(defaults).length);
  fs.writeFileSync(path.join(__dirname, 'git-english-map.json'), JSON.stringify(gitMap, null, 2));
}
