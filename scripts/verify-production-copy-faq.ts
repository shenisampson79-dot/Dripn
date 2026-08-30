/**
 * Launch P1 — production Help/FAQ + offline copy regressions (English defaults).
 * Run: npx tsx scripts/verify-production-copy-faq.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const enPath = resolve(root, 'locales/en.json');
const translationPath = resolve(root, 'services/TranslationService.ts');
const chatPath = resolve(root, 'screens/AIStylistScreen.tsx');

const en = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, string>;
const translationSrc = readFileSync(translationPath, 'utf8');
const chatSrc = readFileSync(chatPath, 'utf8');

const FAQ_KEYS = [
  'help.faq.a1.answer',
  'help.faq.a2.answer',
  'help.faq.g2.answer',
  'help.faq.g3.answer',
  'help.faq.ai3.answer',
  'help.faq.p4.answer',
  'help.faq.s2.answer',
  'help.faq.t5.answer',
  'help.faq.t6.answer',
  'help.faq.t6.question',
] as const;

const STALE_PATTERNS: RegExp[] = [
  /mobile data is fine/i,
  /Mobile data works/i,
  /Expo Go/i,
  /personalised lookbook/i,
  /personalized lookbook/i,
  /Apple ID, Google account/i,
  /cannot log in with Apple or Google/i,
  /signed into your Apple or Google account/i,
  /payment partner Stripe/i,
  /processed securely through Stripe/i,
  /text replies are unlimited/i,
];

const REQUIRED_SNIPPETS: Record<string, RegExp> = {
  'help.faq.a1.answer': /email address/i,
  'help.faq.g2.answer': /App Store/i,
  'help.faq.g3.answer': /style quiz/i,
  'help.faq.ai3.answer': /shared monthly AI allowance/i,
  'help.faq.p4.answer': /App Store/i,
  'help.faq.s2.answer': /Apple App Store/i,
  'help.faq.t6.question': /log in to my account/i,
};

console.log('=== verify-production-copy-faq ===\n');

for (const key of FAQ_KEYS) {
  const value = en[key];
  assert.ok(typeof value === 'string' && value.length > 10, `missing ${key}`);
  for (const pattern of STALE_PATTERNS) {
    assert.doesNotMatch(value, pattern, `${key} still matches stale pattern ${pattern}`);
  }
  const required = REQUIRED_SNIPPETS[key];
  if (required) {
    assert.match(value, required, `${key} missing required production copy`);
  }
}

for (const pattern of STALE_PATTERNS) {
  assert.doesNotMatch(chatSrc, pattern, `AIStylistScreen still matches stale pattern ${pattern}`);
}
assert.match(
  chatSrc,
  /check your connection and try again/i,
  'AIStylistScreen offline copy must mention checking connection',
);

const faqBlock = translationSrc.slice(
  translationSrc.indexOf('faq: {'),
  translationSrc.indexOf('faqSectionTitle'),
);
for (const pattern of STALE_PATTERNS) {
  assert.doesNotMatch(faqBlock, pattern, `TranslationService FAQ defaults still match ${pattern}`);
}
assert.match(
  faqBlock,
  /shared monthly AI allowance/i,
  'TranslationService ai3 default must use shared monthly AI allowance',
);

assert.match(
  translationSrc,
  /deleteAccountAppleBillingWarning/,
  'delete-account Apple subscription warning must remain',
);
assert.match(
  translationSrc,
  /cancel it in Settings → Apple ID → Subscriptions before deleting your account/,
  'delete-account Apple billing warning copy preserved',
);

console.log('All production copy FAQ checks passed.');
