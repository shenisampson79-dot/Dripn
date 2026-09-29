/**
 * Run: npx tsx utils/thirdPartyAiConsent.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THIRD_PARTY_AI_CONSENT_COPY,
  THIRD_PARTY_AI_CONSENT_GRANTED,
  THIRD_PARTY_AI_CONSENT_KEY,
  ensureThirdPartyAiConsent,
  grantThirdPartyAiConsent,
  hasGrantedThirdPartyAiConsent,
  hasGrantedThirdPartyAiConsentSync,
  registerThirdPartyAiConsentPresenter,
  resetThirdPartyAiConsentForTests,
  setThirdPartyAiConsentStorageForTests,
  withdrawThirdPartyAiConsent,
} from './thirdPartyAiConsent';

function createMemoryStore(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem: async (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: async (key: string) => {
      map.delete(key);
    },
  };
}

async function withFreshConsent<T>(fn: () => Promise<T>): Promise<T> {
  resetThirdPartyAiConsentForTests();
  try {
    return await fn();
  } finally {
    resetThirdPartyAiConsentForTests();
  }
}

function assertMethodGated(source: string, method: string, promptFalse = false) {
  const idx = source.indexOf(`async ${method}`);
  assert.ok(idx >= 0, `${method} exists`);
  const nextMethod = source.slice(idx + 1).search(/\n  async /);
  const body = nextMethod >= 0 ? source.slice(idx, idx + 1 + nextMethod) : source.slice(idx);
  const needle = promptFalse
    ? 'await this.requireThirdPartyAiConsent({ prompt: false })'
    : 'await this.requireThirdPartyAiConsent()';
  assert.ok(body.includes(needle), `${method} calls ${needle} before transmitting`);
  const requireAt = body.indexOf(needle);
  const requestAt = body.search(/this\.request<|\.request\(/);
  const wakeAt = body.search(/this\.wakeBackend/);
  assert.ok(requireAt >= 0, `${method} includes consent require`);
  if (wakeAt >= 0) {
    assert.ok(requireAt < wakeAt, `${method} requires consent before wakeBackend`);
  }
  if (requestAt >= 0) {
    assert.ok(requireAt < requestAt, `${method} requires consent before this.request`);
  }
}

async function main() {
  await withFreshConsent(async () => {
    const store = createMemoryStore();
    setThirdPartyAiConsentStorageForTests(store);
    let presenterCalls = 0;
    registerThirdPartyAiConsentPresenter(async () => {
      presenterCalls += 1;
      return false;
    });

    const allowed = await ensureThirdPartyAiConsent();
    assert.equal(allowed, false, 'decline is not consent');
    assert.equal(presenterCalls, 1, 'missing grant shows the gate');
    assert.equal(store.map.has(THIRD_PARTY_AI_CONSENT_KEY), false, 'decline does not persist grant');
    assert.equal(await hasGrantedThirdPartyAiConsent(), false);
    assert.equal(hasGrantedThirdPartyAiConsentSync(), false);

    const allowedAgain = await ensureThirdPartyAiConsent();
    assert.equal(allowedAgain, false, 'later action may prompt again after decline');
    assert.equal(presenterCalls, 2, 'decline does not suppress later prompts');
  });

  await withFreshConsent(async () => {
    const store = createMemoryStore();
    setThirdPartyAiConsentStorageForTests(store);
    let presenterCalls = 0;
    registerThirdPartyAiConsentPresenter(async () => {
      presenterCalls += 1;
      return true;
    });

    const allowed = await ensureThirdPartyAiConsent();
    assert.equal(allowed, true);
    assert.equal(store.map.get(THIRD_PARTY_AI_CONSENT_KEY), THIRD_PARTY_AI_CONSENT_GRANTED);
    assert.equal(await hasGrantedThirdPartyAiConsent(), true);

    const allowedAgain = await ensureThirdPartyAiConsent();
    assert.equal(allowedAgain, true);
    assert.equal(presenterCalls, 1, 'affirmative consent is not re-prompted');
  });

  await withFreshConsent(async () => {
    const store = createMemoryStore({
      [THIRD_PARTY_AI_CONSENT_KEY]: THIRD_PARTY_AI_CONSENT_GRANTED,
    });
    setThirdPartyAiConsentStorageForTests(store);
    let presenterCalls = 0;
    registerThirdPartyAiConsentPresenter(async () => {
      presenterCalls += 1;
      return true;
    });

    assert.equal(await hasGrantedThirdPartyAiConsent(), true);
    await withdrawThirdPartyAiConsent();
    assert.equal(store.map.has(THIRD_PARTY_AI_CONSENT_KEY), false, 'withdrawal clears persisted grant');
    assert.equal(await hasGrantedThirdPartyAiConsent(), false);
    assert.equal(hasGrantedThirdPartyAiConsentSync(), false);

    const allowed = await ensureThirdPartyAiConsent();
    assert.equal(allowed, true, 'withdrawal allows a later grant');
    assert.equal(presenterCalls, 1, 'withdrawal re-opens the gate on next AI action');
  });

  await withFreshConsent(async () => {
    const store = createMemoryStore();
    setThirdPartyAiConsentStorageForTests(store);
    await grantThirdPartyAiConsent();
    assert.equal(store.map.get(THIRD_PARTY_AI_CONSENT_KEY), THIRD_PARTY_AI_CONSENT_GRANTED);
  });

  assert.equal(THIRD_PARTY_AI_CONSENT_COPY.title, 'AI Data Sharing');
  assert.equal(THIRD_PARTY_AI_CONSENT_COPY.allow, 'Allow AI Processing');
  assert.equal(THIRD_PARTY_AI_CONSENT_COPY.deny, "Don't Allow");
  assert.match(THIRD_PARTY_AI_CONSENT_COPY.intro, /third-party AI providers/);
  assert.ok(THIRD_PARTY_AI_CONSENT_COPY.providers.some((line) => line.startsWith('OpenAI')));
  assert.ok(THIRD_PARTY_AI_CONSENT_COPY.providers.some((line) => line.startsWith('ElevenLabs')));
  assert.ok(THIRD_PARTY_AI_CONSENT_COPY.providers.some((line) => line.startsWith('Replicate')));

  const apiSource = readFileSync('services/ApiService.ts', 'utf8');
  const liveSource = readFileSync('screens/LiveStylistScreen.tsx', 'utf8');
  const ttsSource = readFileSync('services/OpenAITTSService.ts', 'utf8');
  const settingsSource = readFileSync('screens/SettingsScreen.tsx', 'utf8');
  const privacyEn = readFileSync('locales/en.json', 'utf8');

  for (const method of [
    'getAIAdvice',
    'analyzeGarmentPhoto',
    'analyzeGarmentBatchResilient',
    'analyzeOutfitPhoto',
    'extractClothing',
    'scanWardrobe',
    'sendStylistMessage',
    'sendWardrobeOutfitFromChat',
    'sendMultiDayOutfitsFromChat',
    'enrichShopSuggestions',
    'submitDecisionCheck',
    'sendVoiceChatMessage',
    'removeBackground',
    'transcribeAudio',
    'voiceChat',
    'synthesizeSpeech',
    'processVoiceMessage',
    'createVoiceResponse',
    'extractFromUrl',
    'extractFromScreenshot',
    'generateOutfitImage',
    'getShopOutfit',
    'guestChat',
    'guestOutfitSuggestion',
    'guestGenerateOutfitImage',
  ]) {
    assertMethodGated(apiSource, method);
  }
  assertMethodGated(apiSource, 'liveScanFrame', true);

  assert.ok(liveSource.includes('const aiAllowed = await ensureThirdPartyAiConsent();'));
  assert.ok(liveSource.includes('if (!hasGrantedThirdPartyAiConsentSync())'));
  assert.ok(!/liveScanFrame[\s\S]{0,80}ensureThirdPartyAiConsent/.test(liveSource));
  assert.ok(ttsSource.includes('const aiAllowed = await ensureThirdPartyAiConsent();'));
  assert.ok(ttsSource.includes('/api/ai/voice-preview'));
  assert.ok(
    ttsSource.indexOf('ensureThirdPartyAiConsent') < ttsSource.indexOf('/api/ai/voice-preview'),
    'voice preview POST cannot run before consent',
  );
  assert.ok(settingsSource.includes('withdrawThirdPartyAiConsent'));
  assert.ok(settingsSource.includes("t('settings.aiDataSharing')"));
  assert.ok(privacyEn.includes('OpenAI'));
  assert.ok(privacyEn.includes('ElevenLabs'));
  assert.ok(privacyEn.includes('Replicate'));
  assert.ok(!privacyEn.includes('You can disable AI suggestions in your Settings at any time.'));

  console.log('thirdPartyAiConsent tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
