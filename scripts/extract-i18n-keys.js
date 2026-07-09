#!/usr/bin/env node
/**
 * Recursively scans screens/, components/, navigation/ for .tsx/.ts files
 * and extracts t('key'), t("key"), and t(`key`) patterns.
 * Outputs unique sorted keys to scripts/i18n-keys.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['screens', 'components', 'navigation'];
const OUTPUT_FILE = path.join(__dirname, 'i18n-keys.txt');

// Match t('key'), t("key"), t(`key`) — key must look like dotted identifiers
const T_CALL_REGEX = /\bt\s*\(\s*(['"`])([a-zA-Z][a-zA-Z0-9_.]*)\1/g;

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, files);
    } else if (/\.(tsx?|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  let match;
  while ((match = T_CALL_REGEX.exec(content)) !== null) {
    keys.add(match[2]);
  }
  return keys;
}

function main() {
  const allKeys = new Set();

  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(ROOT, dir);
    const files = walkDir(fullDir);
    for (const file of files) {
      for (const key of extractKeysFromFile(file)) {
        allKeys.add(key);
      }
    }
  }

  const sorted = [...allKeys].sort();
  fs.writeFileSync(OUTPUT_FILE, sorted.join('\n') + (sorted.length ? '\n' : ''), 'utf8');
  console.log(`Extracted ${sorted.length} unique i18n keys → ${OUTPUT_FILE}`);
}

main();
