/**
 * Static release smoke checks for known regression patterns.
 * Run: node scripts/release-smoke-check.mjs
 *
 * This is a guardrail suite — not a full QA/security audit.
 * Add a check here whenever a live bug has a static signature we can detect.
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

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

/** Avoid undici fetch teardown crash on Windows (UV_HANDLE_CLOSING). */
function httpGetStatus(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timed out'));
    });
    req.on('error', reject);
  });
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
  exists('utils/stylistLanguage.ts'),
);
assert(
  'Settings exposes both App and Stylist language',
  /Stylist language|stylistLanguage|App language/i.test(read('screens/SettingsScreen.tsx')),
);

// 6) Cross-stack Subscription navigation (StylistTab has no Subscription screen)
assert(
  'navigateToSubscription helper exists',
  exists('utils/navigateToSubscription.ts'),
);
assert(
  'helper routes via ProfileTab',
  /ProfileTab/.test(read('utils/navigateToSubscription.ts')) &&
    /screen:\s*['"]Subscription['"]/.test(read('utils/navigateToSubscription.ts')),
);

const stylistCrossStackScreens = [
  'screens/StylistHubScreen.tsx',
  'screens/OutfitCalendarScreen.tsx',
  'screens/AIStylistScreen.tsx',
  'screens/StyleShuffleScreen.tsx',
  'screens/VisualSearchScreen.tsx',
];
for (const file of stylistCrossStackScreens) {
  const src = read(file);
  const badDirectNav =
    /\.navigate\(\s*['"]Subscription['"]/.test(src) ||
    /\.navigate\(\s*['"]Subscription['"]\s+as\s+any/.test(src);
  assert(
    `${file} does not navigate('Subscription') directly`,
    !badDirectNav,
    'Use navigateToSubscription() via ProfileTab instead',
  );
  assert(
    `${file} imports or uses navigateToSubscription helper`,
    /navigateToSubscription/.test(src),
  );
}

// 7) Opaque stylist headers use solid title options
assert(
  'screenOptions uses custom StackHeaderTitle',
  exists('navigation/screenOptions.tsx') &&
    /StackHeaderTitle/.test(read('navigation/screenOptions.tsx')),
);
assert(
  'UserStylistStack uses opaque child headers',
  /transparent:\s*false/.test(read('navigation/UserStylistStackNavigator.tsx')) &&
    /getSettingsChildScreenOptions/.test(read('navigation/UserStylistStackNavigator.tsx')),
);

// 8) Voice panel: playback in silent mode + no checkmark-while-listening
const voicePanel = read('components/PersonalStylistVoicePanel.tsx');
assert(
  'Voice panel enables playsInSilentMode for TTS',
  /playsInSilentMode:\s*true/.test(voicePanel),
);
assert(
  'Voice panel rejects Whisper hallucination phrases',
  /WHISPER_HALLUCINATION_RE|Thanks for watching/i.test(voicePanel),
);
assert(
  'Listening control is not a checkmark',
  !/listening' \? 'check'/.test(voicePanel) && /listening' \? 'square'/.test(voicePanel),
);

// 9) Production API health (non-auth smoke)
const apiBase = process.env.DRIPN_API_BASE || 'https://dripn-server.onrender.com';
try {
  const status = await httpGetStatus(`${apiBase}/api/health`);
  assert(`API health (${apiBase}/api/health) status ${status}`, status >= 200 && status < 300);
} catch (err) {
  assert('API health', false, String(err?.message || err));
}

console.log('\nRelease smoke check');
console.log('===================');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
