/**
 * Simple regex secret scan for CI.
 * Run: npm run security:scan-secrets
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'web-build',
  '.git',
  'backend-code', // server snapshot; secrets there are env refs
  'assets',
  'ios',
  'android',
]);

const SKIP_FILES = new Set([
  'scan-secrets.mjs',
  'security-smoke-check.mjs',
  'package-lock.json',
  'yarn.lock',
]);

/** Patterns that strongly indicate a real secret was committed. */
const PATTERNS = [
  { name: 'Stripe live secret', re: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe test secret', re: /sk_test_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI-style key literal', re: /(['"`])sk-[A-Za-z0-9_-]{20,}\1/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'Hardcoded OPENAI_API_KEY assignment',
    re: /OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/,
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|env|md|yml|yaml|txt)$/i.test(entry.name)) {
      if (!SKIP_FILES.has(entry.name)) out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  // Skip example/env templates that intentionally show placeholders
  if (/\.env\.example$/i.test(rel) || /example\.env$/i.test(rel)) continue;
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  // Skip binary-ish / huge files
  if (src.length > 2_000_000) continue;

  for (const { name, re } of PATTERNS) {
    if (re.test(src)) {
      hits.push(`${rel}: ${name}`);
    }
  }
}

console.log('\nSecret scan');
console.log('===========');
if (hits.length === 0) {
  console.log('  PASS  no high-confidence secrets found');
  process.exit(0);
}
for (const h of hits) console.log(`  FAIL  ${h}`);
console.log(`\n${hits.length} finding(s)`);
process.exit(1);
