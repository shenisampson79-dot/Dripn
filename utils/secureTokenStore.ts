import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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

/** Short-lived refresh aid — never a general API bearer; store with JWT, not AsyncStorage. */
export const SESSION_BACKUP_KEY = {
  secure: 'dripn_session_backup',
  legacy: '@dripn_session_backup',
} as const;

export type TokenKeyPair = { secure: string; legacy: string };

async function assertSecureStoreAvailable(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error(
      'SecureStore is unavailable. Use a native Expo development or release build for authentication.',
    );
  }
}

/**
 * Read token: SecureStore first, then migrate from AsyncStorage legacy key.
 */
export async function getSecureToken(keys: TokenKeyPair): Promise<string | null> {
  await assertSecureStoreAvailable();
  const fromSecure = await SecureStore.getItemAsync(keys.secure);
  if (fromSecure) return fromSecure;

  // Migrate both the original @-prefixed key and any plaintext fallback written
  // by older builds. The plaintext copy is removed only after SecureStore writes.
  const [legacyAtKey, legacyFallbackKey] = await Promise.all([
    AsyncStorage.getItem(keys.legacy).catch(() => null),
    AsyncStorage.getItem(keys.secure).catch(() => null),
  ]);
  const legacy = legacyAtKey ?? legacyFallbackKey;
  if (legacy) {
    try {
      await SecureStore.setItemAsync(keys.secure, legacy);
      await Promise.all([
        AsyncStorage.removeItem(keys.legacy),
        AsyncStorage.removeItem(keys.secure),
      ]);
    } catch (err) {
      console.warn('[secureTokenStore] migration failed:', err);
    }
    return legacy;
  }

  return null;
}

export async function setSecureToken(keys: TokenKeyPair, token: string): Promise<void> {
  await assertSecureStoreAvailable();
  await SecureStore.setItemAsync(keys.secure, token);
  await Promise.all([
    AsyncStorage.removeItem(keys.legacy).catch(() => {}),
    AsyncStorage.removeItem(keys.secure).catch(() => {}),
  ]);
}

export async function clearSecureToken(keys: TokenKeyPair): Promise<void> {
  await assertSecureStoreAvailable();
  await Promise.all([
    SecureStore.deleteItemAsync(keys.secure),
    AsyncStorage.removeItem(keys.legacy).catch(() => {}),
    AsyncStorage.removeItem(keys.secure).catch(() => {}),
  ]);
}
