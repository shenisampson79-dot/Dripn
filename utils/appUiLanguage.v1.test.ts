/**
 * v1 English-only app UI language.
 * Run: npx tsx utils/appUiLanguage.v1.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_APP_UI_LANGUAGE_CODES,
  V1_APP_UI_LANGUAGE,
  V1_APP_UI_LANGUAGE_OPTIONS,
  applyV1I18nLayoutDirection,
  isV1SelectableAppUiLanguage,
  normalizeAppUiLanguage,
  persistedAppUiLanguageNeedsRewrite,
  selectableAppUiLanguages,
  v1AppUiDirection,
} from './appUiLanguage';
import { remainingMonthlyChatActions } from './freeChatMonthlyAllowance';
import { LOCAL_TRANSLATION_BUNDLES, UI_FULL_COVERAGE_LANGUAGES } from '../services/localeBundles';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'locales');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

// 1 + 4–7. Fresh / persisted codes all resolve to English; Arabic is LTR.
assert.equal(normalizeAppUiLanguage(undefined), 'en');
assert.equal(normalizeAppUiLanguage(null), 'en');
assert.equal(normalizeAppUiLanguage('en'), 'en');
assert.equal(normalizeAppUiLanguage('en-GB'), 'en');
assert.equal(normalizeAppUiLanguage('fr'), 'en');
assert.equal(normalizeAppUiLanguage('de'), 'en');
assert.equal(normalizeAppUiLanguage('ar'), 'en');
assert.equal(v1AppUiDirection(), 'ltr');
assert.equal(isV1SelectableAppUiLanguage('en'), true);
assert.equal(isV1SelectableAppUiLanguage('fr'), false);
assert.equal(isV1SelectableAppUiLanguage('ar'), false);

for (const code of LEGACY_APP_UI_LANGUAGE_CODES) {
  assert.equal(normalizeAppUiLanguage(code), 'en', `${code} must normalize to English`);
  assert.equal(persistedAppUiLanguageNeedsRewrite(code), true, `${code} persisted key must rewrite`);
  assert.equal(v1AppUiDirection(), 'ltr');
}
assert.equal(persistedAppUiLanguageNeedsRewrite('en'), false);
assert.equal(persistedAppUiLanguageNeedsRewrite(null), false);

const fakeRtl = {
  isRTL: true,
  allowRTL(allow: boolean) {
    this.allowed = allow;
  },
  forceRTL(force: boolean) {
    this.forced = force;
  },
  allowed: true,
  forced: true,
};
assert.equal(applyV1I18nLayoutDirection(fakeRtl), true);
assert.equal(fakeRtl.allowed, false);
assert.equal(fakeRtl.forced, false);

const fakeLtr = {
  isRTL: false,
  allowRTL(allow: boolean) {
    this.allowed = allow;
  },
  forceRTL(force: boolean) {
    this.forced = force;
  },
  allowed: true,
  forced: true,
};
assert.equal(applyV1I18nLayoutDirection(fakeLtr), false);
assert.equal(fakeLtr.allowed, false);
assert.equal(fakeLtr.forced, false);

// 2–3. Selectable app UI languages: English only, even if a 19-list is passed in.
const fakeNineteen = UI_FULL_COVERAGE_LANGUAGES.map((code) => ({
  code,
  name: code,
  nativeName: code,
  direction: (code === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
}));
const selectable = selectableAppUiLanguages(fakeNineteen);
assert.equal(selectable.length, 1);
assert.equal(selectable[0].code, V1_APP_UI_LANGUAGE);
assert.equal(selectable[0].nativeName, 'English');
assert.equal(selectable[0].direction, 'ltr');
assert.equal(V1_APP_UI_LANGUAGE_OPTIONS.length, 1);

assert.deepEqual(
  [...LEGACY_APP_UI_LANGUAGE_CODES].sort(),
  UI_FULL_COVERAGE_LANGUAGES.filter((c) => c !== 'en').slice().sort(),
);

const pickerSrc = read('components/LanguagePickerModal.tsx');
assert.match(pickerSrc, /selectableAppUiLanguages\(availableLanguages\)/);
assert.doesNotMatch(
  pickerSrc,
  /return availableLanguages\.length > 0/,
  'app picker must not fall back to the 19-language SUPPORTED_LANGUAGES list',
);

const settingsSrc = read('screens/SettingsScreen.tsx');
assert.match(settingsSrc, /selectableAppUiLanguages\(availableLanguages\)/);
assert.match(settingsSrc, /mode="app"/);
assert.match(settingsSrc, /mode="stylist"/);
assert.doesNotMatch(settingsSrc, /SUPPORTED_LANGUAGES\.map\(\(lang\) => \(\{/);

const welcomeSrc = read('screens/WelcomeScreen.tsx');
assert.match(welcomeSrc, /LanguagePickerModal/);
assert.match(welcomeSrc, /t\('welcome\.tagline'\)/);
assert.doesNotMatch(welcomeSrc, /alsoSetStylistLanguage[\s\S]*mode="stylist"/);

const authSrc = read('screens/AuthScreen.tsx');
assert.match(authSrc, /LanguagePickerModal/);
const onboardingEntrySrc = read('screens/OnboardingEntryScreen.tsx');
assert.match(onboardingEntrySrc, /LanguagePickerModal/);

const pickerCallers = ['screens/WelcomeScreen.tsx', 'screens/AuthScreen.tsx', 'screens/OnboardingEntryScreen.tsx', 'screens/SettingsScreen.tsx'];
for (const file of pickerCallers) {
  assert.match(read(file), /LanguagePickerModal/, `${file} is a customer-facing app-language surface`);
}

const allTsx = [
  'screens/WelcomeScreen.tsx',
  'screens/AuthScreen.tsx',
  'screens/OnboardingEntryScreen.tsx',
  'screens/SettingsScreen.tsx',
  'components/LanguagePickerModal.tsx',
];
for (const file of allTsx) {
  const src = read(file);
  if (file.endsWith('LanguagePickerModal.tsx')) continue;
  assert.match(src, /LanguagePickerModal/);
}

// No other screens mount an app-language picker.
const screensDir = join(root, 'screens');
const extraAppPickers: string[] = [];
for (const name of readdirSync(screensDir)) {
  if (!name.endsWith('.tsx')) continue;
  if (pickerCallers.some((p) => p.endsWith(name))) continue;
  const src = readFileSync(join(screensDir, name), 'utf8');
  if (src.includes('LanguagePickerModal') && src.includes('mode="app"')) {
    extraAppPickers.push(name);
  }
  if (src.includes('<LanguagePickerModal') && !src.includes('mode="stylist"') && name !== 'SettingsScreen.tsx') {
    // Welcome/Auth/OnboardingEntry default to app mode — already listed.
    if (!['WelcomeScreen.tsx', 'AuthScreen.tsx', 'OnboardingEntryScreen.tsx'].includes(name)) {
      extraAppPickers.push(name);
    }
  }
}
assert.deepEqual(extraAppPickers, [], `unexpected app language pickers: ${extraAppPickers.join(', ')}`);

// 8. English tagline
const enJson = JSON.parse(read('locales/en.json')) as Record<string, string>;
assert.equal(enJson['welcome.tagline'], 'style that moves with you');
assert.match(read('services/TranslationService.ts'), /tagline: 'style that moves with you'/);

// 9. Guest trial remains 5
const guestSrc = read('screens/GuestBrowseScreen.tsx');
assert.match(guestSrc, /useState\(5\)/);
assert.match(guestSrc, /messagesRemaining \?\? 5/);
assert.match(guestSrc, /\{messagesRemaining \?\? 5\} messages left/);

// 10. Registered Free remains 10 Chat actions/month
assert.match(read('utils/tierMatrix.ts'), /aiChatMessagesPerDay: 10,/);
{
  const r = remainingMonthlyChatActions({ monthlyChatCount: 0, chatHardCap: 10 });
  assert.equal(r.cap, 10);
  assert.equal(r.remaining, 10);
}

// 11–12. All 19 locale files remain; none deleted
const localeFiles = readdirSync(localesDir).filter((f) => f.endsWith('.json')).sort();
assert.deepEqual(
  localeFiles,
  ['ar.json', 'da.json', 'de.json', 'en.json', 'es.json', 'fi.json', 'fr.json', 'hi.json', 'it.json', 'ja.json', 'ko.json', 'nl.json', 'no.json', 'pl.json', 'pt.json', 'ru.json', 'sv.json', 'tr.json', 'zh.json'],
);
for (const code of UI_FULL_COVERAGE_LANGUAGES) {
  assert.equal(existsSync(join(localesDir, `${code}.json`)), true, `locales/${code}.json must remain`);
  assert.equal(typeof LOCAL_TRANSLATION_BUNDLES[code], 'object');
}
assert.equal(Object.keys(LOCAL_TRANSLATION_BUNDLES).length, 19);

// 13–14. Chat / Voice / stylist speak lists unchanged by this slice
const stylistSrc = read('services/PersonalStylistService.ts');
assert.match(stylistSrc, /export const STYLIST_LANGUAGES = \[/);
const stylistLangMatch = stylistSrc.match(/export const STYLIST_LANGUAGES = \[([\s\S]*?)\] as const;/);
assert.ok(stylistLangMatch);
const stylistLangCount = (stylistLangMatch[1].match(/'/g) || []).length / 2;
assert.equal(stylistLangCount, 14);
assert.match(stylistSrc, /'French'/);
assert.match(stylistSrc, /'Arabic'/);
assert.doesNotMatch(read('screens/AIStylistScreen.tsx'), /appUiLanguage/);
assert.doesNotMatch(read('services/OpenAITTSService.ts'), /appUiLanguage/);
assert.doesNotMatch(read('utils/stylistLanguage.ts'), /normalizeAppUiLanguage/);
assert.match(read('screens/OnboardingScreen.tsx'), /STYLIST_LANGUAGES\.map/);
assert.match(
  read('screens/OnboardingScreen.tsx'),
  /separate from the app language/,
);

const translationServiceSrc = read('services/TranslationService.ts');
assert.match(translationServiceSrc, /V1_APP_UI_LANGUAGE_OPTIONS/);
assert.match(translationServiceSrc, /Do not POST \/api\/language/);
assert.match(translationServiceSrc, /applyEnglishUiBundle/);
assert.doesNotMatch(translationServiceSrc, /LOCAL_LANGUAGE_META\.map/);

const translationContextSrc = read('contexts/TranslationContext.tsx');
assert.match(translationContextSrc, /applyV1I18nLayoutDirection/);
assert.match(translationContextSrc, /const isRTL = false/);
assert.doesNotMatch(translationContextSrc, /persistLanguagePreference\(langCode\)/);

// 15. Server client bindings for chat/voice guest entitlements untouched in this slice
assert.match(guestSrc, /useState\(5\)/);
assert.doesNotMatch(read('utils/stylistLanguage.ts'), /normalizeAppUiLanguage/);

console.log('appUiLanguage.v1: all passed');
