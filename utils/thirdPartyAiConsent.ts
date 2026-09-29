/**
 * Apple 5.1.1 / 5.1.2 third-party AI sharing consent.
 * Affirmative grant is required before client requests that Dripn forwards
 * to OpenAI, ElevenLabs, or Replicate.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THIRD_PARTY_AI_CONSENT_KEY = '@dripn_third_party_ai_consent';
export const THIRD_PARTY_AI_CONSENT_GRANTED = 'granted';

export const THIRD_PARTY_AI_CONSENT_COPY = {
  title: 'AI Data Sharing',
  intro:
    "To provide Dripn's AI styling features, information you choose to share may be sent to third-party AI providers for processing.",
  depending: 'Depending on the feature, this may include:',
  categories: [
    'messages and styling requests',
    'outfit and wardrobe photos',
    'style preferences, wardrobe context and related information',
    'voice/audio when using voice features',
  ],
  providersHeading: 'AI providers:',
  providers: [
    'OpenAI — styling responses, image analysis and speech transcription',
    'ElevenLabs — spoken stylist responses',
    'Replicate — image processing used by applicable styling and wardrobe features',
  ],
  footer:
    'Your data is sent only when needed to provide the AI feature you choose to use.',
  allow: 'Allow AI Processing',
  deny: "Don't Allow",
} as const;

export class ThirdPartyAiConsentDeniedError extends Error {
  readonly code = 'THIRD_PARTY_AI_CONSENT_REQUIRED';

  constructor() {
    super('Allow AI processing to use this feature.');
    this.name = 'ThirdPartyAiConsentDeniedError';
  }
}

export function isThirdPartyAiConsentDeniedError(error: unknown): boolean {
  if (error instanceof ThirdPartyAiConsentDeniedError) return true;
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const name = (error as { name?: unknown }).name;
  return code === 'THIRD_PARTY_AI_CONSENT_REQUIRED' || name === 'ThirdPartyAiConsentDeniedError';
}

type ConsentStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storage: ConsentStorage = AsyncStorage;
let memoryGranted = false;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let promptInFlight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

type ConsentPresenter = () => Promise<boolean>;
let presenter: ConsentPresenter | null = null;

export function setThirdPartyAiConsentStorageForTests(next: ConsentStorage | null): void {
  storage = next || AsyncStorage;
}

function emitConsentChange(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeThirdPartyAiConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerThirdPartyAiConsentPresenter(next: ConsentPresenter | null): void {
  presenter = next;
}

export function hasGrantedThirdPartyAiConsentSync(): boolean {
  return memoryGranted;
}

async function persistGranted(granted: boolean): Promise<void> {
  if (granted) {
    await storage.setItem(THIRD_PARTY_AI_CONSENT_KEY, THIRD_PARTY_AI_CONSENT_GRANTED);
  } else {
    await storage.removeItem(THIRD_PARTY_AI_CONSENT_KEY);
  }
  memoryGranted = granted;
  hydrated = true;
  emitConsentChange();
}

export async function hydrateThirdPartyAiConsent(): Promise<boolean> {
  if (hydrated) return memoryGranted;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const stored = await storage.getItem(THIRD_PARTY_AI_CONSENT_KEY);
      memoryGranted = stored === THIRD_PARTY_AI_CONSENT_GRANTED;
    } catch {
      memoryGranted = false;
    }
    hydrated = true;
    return memoryGranted;
  })();
  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export async function hasGrantedThirdPartyAiConsent(): Promise<boolean> {
  return hydrateThirdPartyAiConsent();
}

export async function grantThirdPartyAiConsent(): Promise<void> {
  await persistGranted(true);
}

export async function withdrawThirdPartyAiConsent(): Promise<void> {
  await persistGranted(false);
}

/**
 * User-facing gate. Shows the consent UI only when grant is missing.
 * After "Don't Allow", later intentional actions may prompt again.
 */
export async function ensureThirdPartyAiConsent(): Promise<boolean> {
  if (await hasGrantedThirdPartyAiConsent()) return true;
  if (promptInFlight) return promptInFlight;

  promptInFlight = (async () => {
    if (!presenter) return false;
    const allowed = await presenter();
    if (allowed) {
      await grantThirdPartyAiConsent();
      return true;
    }
    return false;
  })();

  try {
    return await promptInFlight;
  } finally {
    promptInFlight = null;
  }
}

export function resetThirdPartyAiConsentForTests(): void {
  memoryGranted = false;
  hydrated = false;
  hydratePromise = null;
  promptInFlight = null;
  presenter = null;
  storage = AsyncStorage;
  listeners.clear();
}
