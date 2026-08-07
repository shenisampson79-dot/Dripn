import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStaffUser, type StaffUserLike } from '@/utils/staffAccess';

export const DEV_TESTING_MODE_KEY = '@dripn_dev_testing_mode';

export async function isDevTestingModeEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DEV_TESTING_MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDevTestingModeEnabled(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await AsyncStorage.setItem(DEV_TESTING_MODE_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(DEV_TESTING_MODE_KEY);
    }
  } catch (error) {
    console.warn('[devTesting] Failed to persist testing mode flag:', error);
  }
}

/**
 * When Testing Mode is on, unlock premium features for QA / staff / local dev.
 * Regular production users cannot unlock via Settings or a leftover AsyncStorage flag.
 */
export async function shouldApplyTestingUnlock(user?: StaffUserLike): Promise<boolean> {
  const allowed = Boolean(__DEV__) || isStaffUser(user);
  if (!allowed) return false;
  return isDevTestingModeEnabled().catch(() => false);
}
