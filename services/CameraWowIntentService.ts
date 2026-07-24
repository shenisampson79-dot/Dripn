import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = '@dripn_pending_camera_wow';

/**
 * Marks that the user chose the camera-first “get outfits now” onboarding path.
 * Cleared after Stylist Hub / Wardrobe opens Scan Wardrobe once.
 */
export async function markPendingCameraWow(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, '1');
  } catch {
    // non-fatal
  }
}

export async function consumePendingCameraWow(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PENDING_KEY);
    if (value !== '1') return false;
    await AsyncStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}
