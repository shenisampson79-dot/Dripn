/**
 * v1 Welcome: hide the App Language control.
 * Run: npx tsx utils/welcomeLanguageControl.v1.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_APP_UI_LANGUAGE_CODES,
  V1_APP_UI_LANGUAGE_OPTIONS,
  normalizeAppUiLanguage,
} from './appUiLanguage';
import { remainingMonthlyChatActions } from './freeChatMonthlyAllowance';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const welcomeSrc = read('screens/WelcomeScreen.tsx');

// 1. No App Language control on Welcome
assert.doesNotMatch(welcomeSrc, /LanguageEntryButton/);
assert.doesNotMatch(welcomeSrc, /LanguagePickerModal/);
assert.doesNotMatch(welcomeSrc, /languagePickerVisible/);
assert.doesNotMatch(welcomeSrc, /setLanguagePickerVisible/);
assert.doesNotMatch(welcomeSrc, /alsoSetStylistLanguage/);

// 2. No placeholder / English-only label occupying the old slot
assert.doesNotMatch(welcomeSrc, /English only/i);
assert.doesNotMatch(welcomeSrc, /nativeName/);

// 3. Tagline unchanged
assert.match(welcomeSrc, /t\('welcome\.tagline'\)/);
const enJson = JSON.parse(read('locales/en.json')) as Record<string, string>;
assert.equal(enJson['welcome.tagline'], 'style that moves with you');

// 4. Welcome CTA / layout structure unchanged
assert.match(welcomeSrc, /styles\.topBar/);
assert.match(welcomeSrc, /styles\.logoContainer/);
assert.match(welcomeSrc, /navigate\("TrustOnboarding"\)/);
assert.match(welcomeSrc, /t\('welcome\.getStyled'\)/);
assert.match(welcomeSrc, /navigate\("Auth", \{ mode: "login" \}\)/);
assert.match(welcomeSrc, /welcome\.featureWardrobeTitle/);
assert.match(welcomeSrc, /welcome\.featureTalkStylistTitle/);
assert.match(welcomeSrc, /welcome\.featureStopGuessingTitle/);
assert.match(welcomeSrc, /welcome\.featureLookGoodTitle/);

// 5. Settings still has app + stylist pickers
const settingsSrc = read('screens/SettingsScreen.tsx');
assert.match(settingsSrc, /LanguagePickerModal/);
assert.match(settingsSrc, /mode="app"/);
assert.match(settingsSrc, /mode="stylist"/);

// 6. Stylist multilingual controls unchanged
assert.match(read('screens/OnboardingScreen.tsx'), /STYLIST_LANGUAGES\.map/);
assert.match(read('components/LanguagePickerModal.tsx'), /STYLIST_LANGUAGES\.map/);
assert.match(read('screens/AuthScreen.tsx'), /LanguagePickerModal/);
assert.match(read('screens/OnboardingEntryScreen.tsx'), /LanguageEntryButton/);

// 7. English-only normalization unchanged
assert.equal(normalizeAppUiLanguage('fr'), 'en');
assert.equal(normalizeAppUiLanguage('ar'), 'en');
assert.equal(V1_APP_UI_LANGUAGE_OPTIONS.length, 1);
assert.equal(LEGACY_APP_UI_LANGUAGE_CODES.length, 18);

// 8. Translation bundles remain intact
const localeFiles = readdirSync(join(root, 'locales')).filter((f) => f.endsWith('.json'));
assert.equal(localeFiles.length, 19);
for (const code of ['en', 'es', 'fr', 'de', 'ar', 'zh']) {
  assert.equal(existsSync(join(root, 'locales', `${code}.json`)), true);
}

// Entitlement freeze (no accidental Guest/Free edits)
assert.equal(remainingMonthlyChatActions({ monthlyChatCount: 0, chatHardCap: 10 }).cap, 10);
assert.match(read('screens/GuestBrowseScreen.tsx'), /useState\(5\)/);

console.log('welcomeLanguageControl.v1: all passed');
