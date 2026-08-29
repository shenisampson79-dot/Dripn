/**
 * Post-cert cleanup Task 5: Home welcome + subscription tier bullet copy.
 *
 * Run: npx tsx scripts/verify-home-subscription-copy.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TIER_MATRIX } from '../utils/tierMatrix';

const root = resolve(__dirname, '..');
const enPath = resolve(root, 'locales/en.json');
const welcomePath = resolve(root, 'screens/WelcomeScreen.tsx');
const subscriptionPath = resolve(root, 'screens/SubscriptionScreen.tsx');
const tierMatrixPath = resolve(root, 'utils/tierMatrix.ts');

const en = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, string>;
const welcomeSrc = readFileSync(welcomePath, 'utf8');
const subscriptionSrc = readFileSync(subscriptionPath, 'utf8');
const tierMatrixSrc = readFileSync(tierMatrixPath, 'utf8');

const HOME_TITLES = [
  'Your wardrobe, styled smarter',
  'A stylist you can talk to',
  'Feel confident in what you wear',
  'Make easier shopping decisions',
] as const;

const HOME_BODIES = [
  'Get outfit ideas built around the clothes you actually own.',
  'Ask what to wear, what works together, or how to improve an outfit.',
  "Get a second opinion when you're unsure about an outfit or how to style it.",
  "When you can't decide what to buy, Dripn helps you choose what works for you.",
] as const;

const OLD_HOME = [
  'Stop guessing what to wear',
  'Just talk to your stylist',
  'Look good every day',
  'Make your wardrobe work',
  'Get the right outfit — instantly.',
  'Natural voice chat. Like having someone there with you.',
  'No stress. No second-guessing.',
  'Everything organised. Everything usable.',
] as const;

const SUBSCRIPTION: Record<'free' | 'personal_stylist' | 'stylist_unlimited', readonly string[]> = {
  free: [
    'Try Dripn with your own wardrobe',
    'Get personalised outfit advice',
    'Check outfits before you head out',
    'Explore smarter ways to style what you own',
  ],
  personal_stylist: [
    'More conversations with your personal stylist',
    'Personalised advice built around your wardrobe',
    'Outfit help for everyday plans and special occasions',
    "Voice styling when you'd rather talk than type",
  ],
  stylist_unlimited: [
    'Our highest styling allowance',
    'More room for ongoing styling conversations',
    'More Live Stylist and voice usage',
    'Built for people who want Dripn as their everyday stylist',
  ],
};

const OLD_SUBSCRIPTION = [
  '1 stylist decision per day',
  'Compare 2 shopping options',
  'Up to 15 wardrobe items',
  'Basic AI chat (10/day)',
  'Get instant outfit decisions (no overthinking)',
  'Everything in Personal Stylist',
  'Talk to your stylist by voice, anytime',
] as const;

const translationServicePath = resolve(root, 'services/TranslationService.ts');
const translationServiceSrc = readFileSync(translationServicePath, 'utf8');

// --- Home (WelcomeScreen + en.json) ---
assert.ok(
  welcomeSrc.includes("welcome.featureStopGuessingTitle"),
  'WelcomeScreen must use welcome.featureStopGuessingTitle',
);
for (let i = 0; i < HOME_TITLES.length; i++) {
  const key = [
    'welcome.featureStopGuessingTitle',
    'welcome.featureTalkStylistTitle',
    'welcome.featureLookGoodTitle',
    'welcome.featureWardrobeTitle',
  ][i];
  assert.equal(en[key], HOME_TITLES[i], `Home title missing or wrong: ${HOME_TITLES[i]}`);
  assert.ok(translationServiceSrc.includes(HOME_TITLES[i]), `DEFAULT_TRANSLATIONS missing title: ${HOME_TITLES[i]}`);
}
for (let i = 0; i < HOME_BODIES.length; i++) {
  const key = [
    'welcome.featureStopGuessingDesc',
    'welcome.featureTalkStylistDesc',
    'welcome.featureLookGoodDesc',
    'welcome.featureWardrobeDesc',
  ][i];
  assert.equal(en[key], HOME_BODIES[i], `Home body missing or wrong: ${HOME_BODIES[i]}`);
}
for (const old of OLD_HOME) {
  assert.ok(!Object.values(en).includes(old), `old Home copy must be gone from en.json: ${old}`);
  assert.ok(!translationServiceSrc.includes(old), `old Home copy must be gone from DEFAULT_TRANSLATIONS: ${old}`);
}
assert.ok(!welcomeSrc.includes('Stop guessing what to wear'), 'old Home title must not be hardcoded');

// No QSC mention in welcome keys
for (const key of Object.keys(en).filter((k) => k.startsWith('welcome.feature'))) {
  assert.ok(!/qsc|quick sanity/i.test(en[key]), `${key} must not mention QSC`);
}

// --- Subscription (SubscriptionScreen + en.json) ---
for (const tier of Object.keys(SUBSCRIPTION) as Array<keyof typeof SUBSCRIPTION>) {
  for (const bullet of SUBSCRIPTION[tier]) {
    assert.ok(
      subscriptionSrc.includes(bullet) || Object.values(en).includes(bullet),
      `subscription bullet must appear in source or locale: ${bullet}`,
    );
  }
}
for (const old of OLD_SUBSCRIPTION) {
  assert.ok(!subscriptionSrc.includes(old), `old subscription bullet in SubscriptionScreen: ${old}`);
}
assert.ok(!subscriptionSrc.includes('plan.footerLine'), 'tier marketing footnotes must not render');
assert.ok(!subscriptionSrc.includes('planFooterLine'), 'tier footnote style removed');
assert.ok(!subscriptionSrc.includes('For people who are done guessing'), 'Stylist Pro footnote removed');
assert.ok(!subscriptionSrc.includes('Perfect if you want to look better'), 'Personal Stylist footnote removed');

const freeKeys = [
  'subscription.features.free.tryWardrobe',
  'subscription.features.free.personalisedAdvice',
  'subscription.features.free.checkOutfits',
  'subscription.features.free.exploreStyling',
];
for (const key of freeKeys) {
  assert.equal(en[key], SUBSCRIPTION.free[freeKeys.indexOf(key)], key);
}

// --- Entitlement constants unchanged (copy-only task) ---
assert.equal(TIER_MATRIX.free.wardrobeItemsLimit, 15);
assert.equal(TIER_MATRIX.free.decisionsPerDay, 1);
assert.equal(TIER_MATRIX.free.aiChatMessagesPerDay, 10);
assert.equal(TIER_MATRIX.free.voiceCommentsPerMonth, 0);
assert.equal(TIER_MATRIX.personal_stylist.voiceCommentsPerMonth, 20);
assert.equal(TIER_MATRIX.stylist_unlimited.voiceCommentsPerMonth, 100);
assert.equal(TIER_MATRIX.personal_stylist.hasWardrobeAwareDecisions, true);
assert.equal(TIER_MATRIX.free.hasWardrobeAwareDecisions, false);
assert.equal(TIER_MATRIX.personal_stylist.monthlyPriceUsd, 9.99);
assert.equal(TIER_MATRIX.stylist_unlimited.monthlyPriceUsd, 19.99);
assert.match(tierMatrixSrc, /decisionsPerDay: 1,/);
assert.match(tierMatrixSrc, /monthlyPriceUsd: 9\.99,/);
assert.match(tierMatrixSrc, /monthlyPriceUsd: 19\.99,/);

// No behavioral/product files touched beyond copy surfaces
assert.ok(!subscriptionSrc.includes('monthlyPriceUsd'), 'SubscriptionScreen must not embed price constants');
assert.ok(welcomeSrc.includes('WelcomeScreen'), 'WelcomeScreen file intact');

console.log('verify-home-subscription-copy: all passed');
