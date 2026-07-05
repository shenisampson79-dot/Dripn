import AsyncStorage from '@react-native-async-storage/async-storage';

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
