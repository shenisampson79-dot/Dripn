#!/usr/bin/env node
/**
 * Retranslate locale keys that still equal English (interim placeholders).
 * Only processes keys listed in merge-new-i18n-keys NEW_KEYS / en-flat delta.
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');
const CONCURRENCY = 6;

const PREFIXES = [
  'navTitles.',
  'coldOpen.',
  'discover.',
  'fashionBlog.',
  'weeklyPlanner.',
  'cancelFlow.',
  'secondOpinion.',
  'voiceComment.',
  'shoppable.',
  'surpriseMe.',
  // Alert.alert i18n batch
  'wardrobe.',
  'aiStylist.',
  'askStylist.',
  'community.',
  'colorAnalysis.',
  'bodyScan.',
  'onboarding.',
  'fashionTherapy.',
  'gamification.',
  'wishlist.',
  'virtualTryOn.',
  'visualSearch.',
  'streetStyle.',
  'dreamOutfit.',
  'vip.',
  'videoCall.',
  'session.',
  'profile.',
  'sustainability.',
  'settings.',
  'styleShuffle.',
  'styleDna.',
  'mixMatch.',
  'priceCheck.',
  'styleShowdown.',
  'dfy.',
  'decideForMe.',
  'partner.',
  'socialStyle.',
  'messages.',
  'events.',
];

const ALERT_KEYS = (() => {
  try {
    return Object.keys(require('./alert-i18n-new-keys'));
  } catch {
    return [];
  }
})();

const EXTRA_KEYS = [
  'common.pleaseTryAgainRubyDidntGetYourMessage',
  'common.pleaseTryAgainRubyDidn',
  'common.youreNowSubscribedToDripnFashionUpdates',
  'common.youveBeenUnsubscribedFromTheNewsletter',
  'common.couldNotUpdateNewsletterSubscriptionPlea',
  'common.addAnEmailAddressToYourDripnAccountToRec',
  'common.connectToTheInternetToSubscribeToTheWeek',
  'common.pleaseAddAnEmailToYourAccountFirst',
  'common.subscribed',
  'common.unsubscribed',
  ...ALERT_KEYS.filter((k) => k.startsWith('common.')),
];

async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const enFlat = JSON.parse(fs.readFileSync(EN_FLAT, 'utf8'));
  // Prefer explicit alert key list; also cover prior gap-closure prefixes still interim
  const alertSet = new Set(ALERT_KEYS);
  const targetKeys = Object.keys(enFlat).filter(
    (k) =>
      alertSet.has(k) ||
      EXTRA_KEYS.includes(k) ||
      ['navTitles.', 'coldOpen.', 'discover.', 'fashionBlog.', 'weeklyPlanner.', 'cancelFlow.', 'secondOpinion.', 'voiceComment.', 'shoppable.', 'surpriseMe.'].some(
        (p) => k.startsWith(p)
      )
  );

  const langs = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .filter((l) => l !== 'en');
  const onlyLang = process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1];
  const list = onlyLang ? [onlyLang] : langs;

  for (const lang of list) {
    const outPath = path.join(LOCALES_DIR, `${lang}.json`);
    const locale = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const toFix = targetKeys.filter((k) => {
      const en = enFlat[k];
      const cur = locale[k];
      return !cur || cur === en;
    });
    console.log(`${lang}: ${toFix.length} English-interim keys to translate`);
    if (toFix.length === 0) continue;

    const entries = await mapConcurrent(toFix, async (key) => {
      const english = enFlat[key];
      if (!english || !english.trim() || /^[\d.,\s$€£¥%+\-]+$/.test(english)) {
        return [key, english];
      }
      // Keep brand tokens
      if (english === 'Dripn' || english === 'Ruby' || english === 'Max' || english === 'Ace' || english === 'Ivy') {
        return [key, english];
      }
      try {
        await sleep(35);
        const translated = await translateViaGoogle(english, lang);
        return [key, translated];
      } catch (err) {
        console.warn(`  ${lang} ${key}: ${err.message}`);
        return [key, english];
      }
    });

    for (const [key, value] of entries) {
      locale[key] = value;
    }
    fs.writeFileSync(outPath, JSON.stringify(locale, null, 2) + '\n');
    console.log(`  ${lang}: wrote ${entries.length} translations`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
