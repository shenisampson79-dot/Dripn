/**
 * True only when this binary registered VisionCamera's Nitro CameraFactory.
 * Old TestFlight/store builds without the native module stay on Expo CameraView.
 * Do NOT require('react-native-vision-camera') here — its import creates CameraFactory
 * and would throw on unlinked binaries.
 */
let cached: boolean | null = null;

export function isVisionCameraLinked(): boolean {
  if (cached != null) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NitroModules } = require('react-native-nitro-modules') as {
      NitroModules?: { createHybridObject?: (name: string) => unknown };
    };
    if (typeof NitroModules?.createHybridObject !== 'function') {
      cached = false;
      return false;
    }
    const factory = NitroModules.createHybridObject('CameraFactory');
    cached = factory != null;
    return cached;
  } catch {
    cached = false;
    return false;
  }
}
