/**
 * Auth token storage via expo-secure-store (Keychain / Keystore) when the native
 * module is linked in the dev client / release build.
 * Fallback: AsyncStorage (same key names) when SecureStore is unavailable —
 * e.g. web, or a dev client built before expo-secure-store was added.
 * Rebuild dev client (`npx expo run:ios` or EAS dev build) for Keychain storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/** SecureStore allows only [A-Za-z0-9._-]; legacy keys used '@'. */
export const USER_TOKEN_KEY = {
  secure: 'dripn_token',
  legacy: '@dripn_token',
} as const;

export const ADMIN_TOKEN_KEY = {
  secure: 'dripn_admin_token',
  legacy: '@dripn_admin_token',
} as const;

export const STYLIST_TOKEN_KEY = {
  secure: 'dripn_stylist_token',
  legacy: '@dripn_stylist_token',
} as const;

export type TokenKeyPair = { secure: string; legacy: string };

/** Native ExpoSecureStore requires options on every call (Swift/Kotlin arity). */
type ExpoSecureStoreNative = {
  getValueWithKeyAsync: (key: string, options: object) => Promise<string | null>;
  setValueWithKeyAsync: (value: string, key: string, options: object) => Promise<void>;
  deleteValueWithKeyAsync: (key: string, options: object) => Promise<void>;
};

const EMPTY_OPTIONS: object = {};

let nativeSecureStore: ExpoSecureStoreNative | null | undefined;
let fallbackWarned = false;

function getNativeSecureStore(): ExpoSecureStoreNative | null {
  if (Platform.OS === 'web') return null;
  if (nativeSecureStore !== undefined) return nativeSecureStore;
  try {
    nativeSecureStore = requireOptionalNativeModule<ExpoSecureStoreNative>('ExpoSecureStore');
    if (!nativeSecureStore?.getValueWithKeyAsync) {
      nativeSecureStore = null;
    }
  } catch {
    nativeSecureStore = null;
  }
  if (!nativeSecureStore && !fallbackWarned) {
    fallbackWarned = true;
    console.warn(
      '[secureTokenStore] ExpoSecureStore native module not found — using AsyncStorage. ' +
        'Rebuild dev client (`npx expo run:ios` or EAS dev build) for SecureStore.',
    );
  }
  return nativeSecureStore;
}

function useSecureStore(): boolean {
  return getNativeSecureStore() !== null;
}

async function secureGet(key: string): Promise<string | null> {
  const native = getNativeSecureStore();
  if (!native) return null;
  try {
    return await native.getValueWithKeyAsync(key, EMPTY_OPTIONS);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  const native = getNativeSecureStore();
  if (!native) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  // Must pass options — native setValueWithKeyAsync(value, key, options) expects 3 args
  await native.setValueWithKeyAsync(value, key, EMPTY_OPTIONS);
}

async function secureDelete(key: string): Promise<void> {
  const native = getNativeSecureStore();
  if (!native) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await native.deleteValueWithKeyAsync(key, EMPTY_OPTIONS);
  } catch {
    // Key may not exist
  }
}

/**
 * Read token: SecureStore first, then migrate from AsyncStorage legacy key.
 */
export async function getSecureToken(keys: TokenKeyPair): Promise<string | null> {
  const fromSecure = await secureGet(keys.secure);
  if (fromSecure) return fromSecure;

  // AsyncStorage fallback (web or dev client without native SecureStore)
  if (!useSecureStore()) {
    const fallbackVal = await AsyncStorage.getItem(keys.secure).catch(() => null);
    if (fallbackVal) return fallbackVal;
  }

  const legacy = await AsyncStorage.getItem(keys.legacy).catch(() => null);
  if (legacy) {
    try {
      await secureSet(keys.secure, legacy);
      await AsyncStorage.removeItem(keys.legacy);
    } catch (err) {
      console.warn('[secureTokenStore] migration failed:', err);
    }
    return legacy;
  }

  return null;
}

export async function setSecureToken(keys: TokenKeyPair, token: string): Promise<void> {
  await secureSet(keys.secure, token);
  // Ensure legacy plaintext copy is gone
  await AsyncStorage.removeItem(keys.legacy).catch(() => {});
}

export async function clearSecureToken(keys: TokenKeyPair): Promise<void> {
  await secureDelete(keys.secure);
  await AsyncStorage.removeItem(keys.legacy).catch(() => {});
  if (!useSecureStore()) {
    await AsyncStorage.removeItem(keys.secure).catch(() => {});
  }
}
