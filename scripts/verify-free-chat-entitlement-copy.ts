/**
 * Prove Free Chat customer-facing copy is 10/month and no 10/day claim remains.
 * Does not change the server meter (10 UTC-month actions).
 *
 * Run: npx tsx scripts/verify-free-chat-entitlement-copy.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(__dirname, '..');

const PRODUCTION_DIRS = ['screens', 'services', 'contexts', 'locales', 'store'] as const;
const PRODUCTION_FILES = [
  'utils/tierMatrix.ts',
  'scripts/subscription-translations.js',
  'scripts/en-flat.json',
  'scripts/es-flat.json',
  'scripts/spanish-data.json',
];
const SKIP_NAME = /verify-free-chat-entitlement-copy|verify-home-subscription-copy/;

const DAILY_CHAT_CLAIMS = [
  'Basic AI chat (10/day)',
  '10/day)',
  '10 per day',
  '10/día',
  '10/jour',
  '10/Tag',
  '10/dag)',
  '10/gün',
  '10 al giorno',
  '10/dzień',
  '10/天',
  '10/日）',
  '10/일',
  '10 в день',
  '10/día',
  '10/päivä',
  '10/दिन',
  '10/يوم',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'backend-code') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|json)$/.test(extname(name))) acc.push(full);
  }
  return acc;
}

const files = [
  ...PRODUCTION_DIRS.flatMap((d) => walk(join(root, d))),
  ...PRODUCTION_FILES.map((f) => join(root, f)),
].filter((f) => !SKIP_NAME.test(f));

let scanned = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  scanned += 1;
  const rel = relative(root, file).replace(/\\/g, '/');
  if (rel === 'locales/en.json') {
    assert.ok(
      !Object.values(JSON.parse(src)).includes('Basic AI chat (10/day)'),
      'en.json must not claim Basic AI chat (10/day)',
    );
  }
  if (rel.endsWith('TranslationService.ts') || rel.endsWith('en-flat.json') || rel.endsWith('subscription-translations.js')) {
    assert.ok(src.includes('Basic AI chat (10/month)'), `${rel} must claim 10/month`);
  }
  if (src.includes('subscription.features.free.basicChat') || src.includes('basicChat:')) {
    for (const claim of DAILY_CHAT_CLAIMS) {
      assert.ok(!src.includes(claim), `${rel} still has Free Chat daily claim: ${claim}`);
    }
  }
}

assert.match(
  readFileSync(join(root, 'utils/tierMatrix.ts'), 'utf8'),
  /free: \{[\s\S]*?aiChatMessagesPerDay: 10,/,
);
assert.match(
  readFileSync(join(root, 'utils/tierMatrix.ts'), 'utf8'),
  /personal_stylist: \{[\s\S]*?aiChatMessagesPerDay: 'unlimited',/,
);

const translation = readFileSync(join(root, 'services/TranslationService.ts'), 'utf8');
assert.match(translation, /basicChat: 'Basic AI chat \(10\/month\)'/);
assert.ok(!translation.includes("basicChat: 'Basic AI chat (10/day)'"));

const stylistSrc = readFileSync(join(root, 'screens/AIStylistScreen.tsx'), 'utf8');
assert.match(stylistSrc, /remainingMonthlyChatActions/);
assert.match(stylistSrc, /canSendHardCappedChat/);
assert.ok(!stylistSrc.includes('STYLIST_DAILY_MESSAGES_KEY'));
assert.ok(!stylistSrc.includes('parsed.date === today'));
assert.ok(!stylistSrc.includes('messages remaining today'));
assert.ok(!stylistSrc.includes('message left today'));
assert.ok(!stylistSrc.includes('Daily limit reached - upgrade for more'));

const helperSrc = readFileSync(join(root, 'utils/freeChatMonthlyAllowance.ts'), 'utf8');
assert.match(helperSrc, /chatHardCap/);
assert.match(helperSrc, /monthlyChatCount/);

console.log(`verify-free-chat-entitlement-copy: ${scanned} files scanned, 10/month copy OK`);
