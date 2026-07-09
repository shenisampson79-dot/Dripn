/**
 * Extract English strings from git HEAD legal screens by walking both files in parallel.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function gitShow(file) {
  return execSync(`git show HEAD:${file}`, { cwd: ROOT, encoding: 'utf8' });
}

function extractKeysFromCurrent(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  return [...content.matchAll(/t\(['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\)/g)].map((m) => m[1]);
}

function extractStringsFromHead(content) {
  const strings = [];
  // String literals in JSX text nodes and props
  for (const m of content.matchAll(/>([^<>{}\n]+)</g)) {
    const t = m[1].trim();
    if (t && !t.startsWith('{') && t.length > 1) strings.push(t);
  }
  return strings;
}

function pairLegalScreens(tsxPath, prefix) {
  const keys = extractKeysFromCurrent(tsxPath);
  const head = gitShow(tsxPath);
  const strings = extractStringsFromHead(head);
  const map = {};
  // Skip title/header strings at start, align by count
  const headStrings = strings.filter((s) => s.length > 2);
  // Use ordered extraction from head file - get all quoted strings
  const quoted = [];
  for (const m of head.matchAll(/>([^<]+)</g)) {
    const t = m[1].trim();
    if (t && !t.includes('{') && t.length > 1) quoted.push(t);
  }
  // Also get strings from ThemedText content patterns
  const allStrings = [];
  const lines = head.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      const m = trimmed.match(/^["'](.+)["'],?$/);
      if (m && m[1].length > 2) allStrings.push(m[1]);
    } else if (
      trimmed.match(/^[A-Z0-9]/) &&
      !trimmed.includes('<') &&
      !trimmed.includes('style') &&
      trimmed.length > 3
    ) {
      allStrings.push(trimmed.replace(/,$/, ''));
    }
  }

  // Best approach: extract from diff which has clean pairs for most keys
  const diff = execSync(`git diff HEAD -- "${tsxPath}"`, { cwd: ROOT, encoding: 'utf8' });
  const diffMap = {};
  const removals = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      const text = line.slice(1).trim();
      const m = text.match(/^(.+)$/);
      if (
        m &&
        !text.startsWith('import') &&
        !text.startsWith('<') &&
        !text.startsWith('}') &&
        !text.includes('ThemedText') &&
        !text.includes('View') &&
        text.length > 2
      ) {
        // Extract pure text content
        const inner = text.match(/^(.+)$/);
        if (inner) {
          const cleaned = text
            .replace(/^["']|["'],?$/g, '')
            .replace(/^\{t\(/, '');
          if (cleaned.length > 2 && !cleaned.includes('style=')) removals.push(cleaned);
        }
      }
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const km = line.match(/t\(['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\)/);
      if (km && removals.length) diffMap[km[1]] = removals.pop();
    }
  }
  return diffMap;
}

// Extract full legal English from HEAD files using structured parsing
function extractLegalEnglish(tsxPath) {
  const head = gitShow(tsxPath);
  const map = {};
  const keys = extractKeysFromCurrent(tsxPath);

  // Parse HEAD file: collect text between ThemedText tags
  const texts = [];
  const re = /<ThemedText[^>]*>([^<{]+)<\/ThemedText>/g;
  let m;
  while ((m = re.exec(head))) {
    const t = m[1].trim();
    if (t) texts.push(t);
  }

  // Map keys to texts - keys appear in same order as texts in refactored file
  // texts in HEAD: title, dates, welcome x2, intro x2, then sections...
  if (keys.length <= texts.length) {
    keys.forEach((key, i) => {
      if (texts[i]) map[key] = texts[i];
    });
  }
  return map;
}

function main() {
  const terms = extractLegalEnglish('screens/TermsOfServiceScreen.tsx');
  const privacy = extractLegalEnglish('screens/PrivacyPolicyScreen.tsx');
  const combined = { ...terms, ...privacy };
  fs.writeFileSync(path.join(__dirname, 'legal-english-map.json'), JSON.stringify(combined, null, 2));
  console.log('Legal English:', Object.keys(combined).length);
}

if (require.main === module) main();

module.exports = { extractLegalEnglish };
