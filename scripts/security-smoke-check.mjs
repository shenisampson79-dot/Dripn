/**
 * Client security smoke checks.
 * Run: npm run security:smoke
 *
 * Asserts SecureStore token storage and bans hardcoded secrets / secret-looking
 * EXPO_PUBLIC_* names in Expo application source.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];
const SOURCE_DIRS = [
  'screens',
  'services',
  'components',
  'utils',
  'contexts',
  'hooks',
  'config',
];

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
    if (entry.name === 'node_modules') continue;
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
  'secureTokenStore uses expo-secure-store',
  /from ['"]expo-secure-store['"]/.test(storeSrc) &&
    /SecureStore\.getItemAsync/.test(storeSrc) &&
    /SecureStore\.setItemAsync/.test(storeSrc) &&
    /SecureStore\.deleteItemAsync/.test(storeSrc),
);
assert(
  'secureTokenStore performs one-time AsyncStorage migration',
  /AsyncStorage\.getItem/.test(storeSrc) &&
    /AsyncStorage\.removeItem/.test(storeSrc) &&
    /SecureStore\.setItemAsync/.test(storeSrc),
);

const apiSrc = read('services/ApiService.ts');
assert(
  'ApiService uses secureTokenStore for JWT',
  /getSecureToken|setSecureToken|USER_TOKEN_KEY/.test(apiSrc) &&
    /secureTokenStore/.test(apiSrc),
);
const adminSrc = read('contexts/AdminAuthContext.tsx');
assert(
  'AdminAuthContext uses SecureStore for admin token',
  /secureTokenStore/.test(adminSrc) && /setSecureToken|getSecureToken/.test(adminSrc),
);
const stylistSrc = read('contexts/StylistAuthContext.tsx');
assert(
  'StylistAuthContext uses SecureStore for stylist token',
  /secureTokenStore/.test(stylistSrc) && /setSecureToken|getSecureToken/.test(stylistSrc),
);
assert(
  'package.json depends on expo-secure-store',
  /"expo-secure-store"/.test(read('package.json')),
);

const appFiles = SOURCE_DIRS.flatMap((dir) => walkSourceFiles(path.join(root, dir)));

const rawTokenWrites = [];
const TOKEN_LITERAL = String.raw`['"\`]@?dripn_(?:admin_|stylist_)?token['"\`]`;
for (const file of appFiles) {
  if (path.relative(root, file).replace(/\\/g, '/') === 'utils/secureTokenStore.ts') continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  const tokenVariables = [...src.matchAll(new RegExp(
    String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*${TOKEN_LITERAL}`,
    'g',
  ))].map((match) => match[1]);
  const directWrite = new RegExp(
    String.raw`AsyncStorage\.setItem\s*\(\s*(?:${TOKEN_LITERAL}|(?:USER|ADMIN|STYLIST)_TOKEN_KEY(?:\.(?:legacy|secure))?)`,
  ).test(src);
  const variableWrite = tokenVariables.some((name) =>
    new RegExp(String.raw`AsyncStorage\.setItem\s*\(\s*${name}\b`).test(src),
  );
  if (directWrite || variableWrite) rawTokenWrites.push(rel);
}
assert(
  'no auth tokens are written directly to AsyncStorage',
  rawTokenWrites.length === 0,
  rawTokenWrites.join('; '),
);

// --- 2) Ban hardcoded secrets in app source ---
const SECRET_PATTERNS = [
  { name: 'sk- key', re: /\bsk-[A-Za-z0-9_-]{10,}/ },
  { name: 'Stripe live secret', re: /\bsk_live_[A-Za-z0-9_-]{10,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{20,}/ },
  { name: 'private key', re: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  {
    name: 'OPENAI_API_KEY string literal',
    re: /OPENAI_API_KEY\s*=\s*(['"`])[^'"`\r\n]+\1/,
  },
];

const secretHits = [];
for (const file of appFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(src)) secretHits.push(`${rel}: ${name}`);
  }
}
assert(
  'no hardcoded secrets in app source',
  secretHits.length === 0,
  secretHits.slice(0, 8).join('; '),
);

// --- 3) Ban secret-looking EXPO_PUBLIC_* names ---
const SERVER_ONLY_PUBLIC_NAME =
  /(?:SECRET|OPENAI|STRIPE_SECRET|SENDGRID|SERVICE_KEY|ELEVENLABS|PRIVATE_KEY|PASSWORD)/;

const badExpoHits = [];
for (const file of appFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) {
    const name = match[0];
    if (SERVER_ONLY_PUBLIC_NAME.test(name)) {
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
