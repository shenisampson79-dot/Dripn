/**
 * Client security smoke checks.
 * Run: npm run security:smoke
 *
 * Asserts SecureStore token storage, bans hardcoded secrets / secret-looking
 * EXPO_PUBLIC_* names, then runs release regression smoke checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function assert(name, cond, detail = '') {
  if (cond) passes.push(name);
  else failures.push(detail ? `${name}: ${detail}` : name);
}

function walkSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'web-build' || entry.name === '.git') continue;
    // backend-code is a server snapshot — exclude from client secret gates
    if (entry.name === 'backend-code') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// --- 1) SecureStore required for auth tokens ---
assert(
  'secureTokenStore helper exists',
  exists('utils/secureTokenStore.ts'),
);
const storeSrc = exists('utils/secureTokenStore.ts') ? read('utils/secureTokenStore.ts') : '';
assert(
  'secureTokenStore uses expo-secure-store with fallback',
  /expo-secure-store|ExpoSecureStore/.test(storeSrc) &&
    /requireOptionalNativeModule/.test(storeSrc),
);
assert(
  'secureTokenStore migrates from AsyncStorage',
  /AsyncStorage\.getItem/.test(storeSrc) &&
    /AsyncStorage\.removeItem/.test(storeSrc) &&
    /secureSet/.test(storeSrc),
);

const apiSrc = read('services/ApiService.ts');
assert(
  'ApiService uses secureTokenStore for JWT',
  /getSecureToken|setSecureToken|USER_TOKEN_KEY/.test(apiSrc) &&
    /secureTokenStore/.test(apiSrc),
);
assert(
  'ApiService does not store JWT via AsyncStorage.setItem(TOKEN',
  !/AsyncStorage\.setItem\(\s*TOKEN_KEY/.test(apiSrc) &&
    !/AsyncStorage\.setItem\(\s*['"]@dripn_token['"]/.test(apiSrc),
);

const adminSrc = read('contexts/AdminAuthContext.tsx');
assert(
  'AdminAuthContext uses SecureStore for admin token',
  /secureTokenStore/.test(adminSrc) && /setSecureToken|getSecureToken/.test(adminSrc),
);
assert(
  'AdminAuthContext does not AsyncStorage.setItem admin token',
  !/AsyncStorage\.setItem\(\s*ADMIN_TOKEN_KEY/.test(adminSrc) &&
    !/AsyncStorage\.setItem\(\s*['"]@dripn_admin_token['"]/.test(adminSrc),
);

const stylistSrc = read('contexts/StylistAuthContext.tsx');
assert(
  'StylistAuthContext uses SecureStore for stylist token',
  /secureTokenStore/.test(stylistSrc) && /setSecureToken|getSecureToken/.test(stylistSrc),
);
assert(
  'StylistAuthContext does not AsyncStorage.setItem stylist token',
  !/AsyncStorage\.setItem\(\s*STYLIST_TOKEN_KEY/.test(stylistSrc) &&
    !/AsyncStorage\.setItem\(\s*['"]@dripn_stylist_token['"]/.test(stylistSrc),
);

assert(
  'package.json depends on expo-secure-store',
  /"expo-secure-store"/.test(read('package.json')),
);

// --- 2) Ban hardcoded sk- / OPENAI_API_KEY = '...' in app source ---
const SKIP_SECRET_SCAN_DIRS = new Set(['scripts', 'backend-code', 'node_modules', 'web-build', '.git']);
const appFiles = walkSourceFiles(root).filter((f) => {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const top = rel.split('/')[0];
  return !SKIP_SECRET_SCAN_DIRS.has(top);
});

const HARDCODED_SK = /(['"`])sk-[A-Za-z0-9_-]{10,}\1/;
const HARDCODED_OPENAI =
  /OPENAI_API_KEY\s*=\s*(['"`])[^'"`]+\1/;

for (const file of appFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  if (HARDCODED_SK.test(src)) {
    assert(`no hardcoded sk- in ${rel}`, false, 'Remove embedded OpenAI/Stripe-style keys');
  }
  if (HARDCODED_OPENAI.test(src)) {
    assert(`no hardcoded OPENAI_API_KEY literal in ${rel}`, false);
  }
}
assert('no hardcoded sk-/OPENAI literals in app source', true);

// --- 3) Ban secret-looking EXPO_PUBLIC_* names ---
const BAD_EXPO_PUBLIC =
  /EXPO_PUBLIC_(?:[A-Z0-9_]*_?(?:SECRET|PRIVATE_KEY|PASSWORD|JWT_SECRET|OPENAI|STRIPE_SECRET|ELEVENLABS)[A-Z0-9_]*)\b/;
const ALLOWED_PUBLIC_KEYS = new Set([
  // RevenueCat public SDK key is intended for the client
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
]);

const badExpoHits = [];
for (const file of appFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) {
    const name = match[0];
    if (ALLOWED_PUBLIC_KEYS.has(name)) continue;
    if (BAD_EXPO_PUBLIC.test(name)) {
      badExpoHits.push(`${rel}: ${name}`);
    }
  }
}
assert(
  'no secret-looking EXPO_PUBLIC_* in app source',
  badExpoHits.length === 0,
  badExpoHits.slice(0, 8).join('; '),
);

assert(
  'docs/security/README.md exists',
  exists('docs/security/README.md'),
);

console.log('\nSecurity smoke check');
console.log('====================');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed (security)`);

if (failures.length) {
  process.exit(1);
}

// --- 4) Include release regression smoke ---
console.log('\nRunning release-smoke-check.mjs…\n');
const release = spawnSync(process.execPath, [path.join(root, 'scripts/release-smoke-check.mjs')], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
});
if (release.stdout) process.stdout.write(release.stdout);
if (release.stderr) process.stderr.write(release.stderr);
if (release.error) {
  console.error(release.error);
  process.exit(1);
}
process.exit(release.status === null ? 1 : release.status);
