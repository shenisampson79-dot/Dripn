/**
 * Static release smoke checks for known regression patterns.
 * Run: node scripts/release-smoke-check.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(name, cond, detail = '') {
  if (cond) passes.push(name);
  else failures.push(detail ? `${name}: ${detail}` : name);
}

// 1) Opaque stack screens must opt out of double header padding
const opaqueScreens = [
  'screens/FashionBlogScreen.tsx',
  'screens/StyleRulesScreen.tsx',
  'screens/ColourInsightsScreen.tsx',
  'screens/WeatherOutfitScreen.tsx',
  'screens/OutfitCalendarScreen.tsx',
];
for (const file of opaqueScreens) {
  const src = read(file);
  assert(`${file} uses opaqueHeader`, /opaqueHeader/.test(src));
}

// 2) Shared voice credits provider wired into app tree
const app = read('App.tsx');
assert('App wraps VoiceCreditsProvider', /VoiceCreditsProvider/.test(app));
assert(
  'VoiceCreditsProvider wraps navigation',
  /VoiceCreditsProvider[\s\S]*NavigationContainerWithRef/.test(app),
);
assert(
  'useVoiceCredits exports Provider',
  /export function VoiceCreditsProvider/.test(read('hooks/useVoiceCredits.ts')),
);

// 3) Translation lookup hardened against blank labels
const translationCtx = read('contexts/TranslationContext.tsx');
assert(
  't() prefers flat key + blog/fashionBlog alias',
  /fashionBlog\.\$\{/.test(translationCtx) && /dict\[dottedKey\]/.test(translationCtx),
);

// 4) Critical fashion blog keys present in English locale
const en = JSON.parse(read('locales/en.json'));
const blogKeys = [
  'blog.title',
  'blog.subscribe',
  'fashionBlog.title',
  'fashionBlog.subscribe',
  'fashionBlog.subtitle',
  'fashionBlog.noArticlesYet',
];
for (const key of blogKeys) {
  assert(`en.json has ${key}`, typeof en[key] === 'string' && en[key].trim().length > 0, String(en[key]));
}

// 5) Stylist speak language resolved independently of UI language
assert(
  'stylistLanguage util exists',
  fs.existsSync(path.join(root, 'utils/stylistLanguage.ts')),
);
assert(
  'Settings exposes both App and Stylist language',
  /Stylist language|stylistLanguage|App language/i.test(read('screens/SettingsScreen.tsx')),
);

// 6) Production API health (non-auth smoke)
const apiBase = process.env.DRIPN_API_BASE || 'https://dripn-server.onrender.com';
try {
  const res = await fetch(`${apiBase}/api/health`);
  assert(`API health (${apiBase}/api/health) status ${res.status}`, res.ok);
} catch (err) {
  assert('API health', false, String(err?.message || err));
}

console.log('\nRelease smoke check');
console.log('===================');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
