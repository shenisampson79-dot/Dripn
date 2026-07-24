/**
 * On-device garment detector plugin boundary.
 *
 * Expo SDK 56 managed / current binary: no TFLite / Core ML YOLO package is
 * wired. This module always reports unavailable and returns null so the live
 * stylist uses cloud Vision sampling (OTA-safe).
 *
 * To enable later (requires new EAS native build + custom dev client):
 * 1. Add a maintained TFLite / Core ML / MediaPipe package compatible with RN 0.85.
 * 2. Set ON_DEVICE_YOLO_NATIVE = true after linking.
 * 3. Implement detectGarmentsOnDevice to return bbox detections.
 * 4. LiveStylistScreen already posts `detections` to /live-frame when present.
 */

import type { LiveTrackedItem } from '@/types/liveStylist';

/** Flip only after a native module is linked in an EAS build. */
export const ON_DEVICE_YOLO_NATIVE = false;

export type OnDeviceDetection = {
  name?: string;
  category: string;
  subcategory?: string;
  color?: string;
  confidence: number;
  bbox: [number, number, number, number];
  suggestion?: string;
  trackId?: string;
};

export function isOnDeviceYoloAvailable(): boolean {
  return ON_DEVICE_YOLO_NATIVE;
}

export function getOnDeviceYoloStatus(): {
  available: boolean;
  reason: string;
  requiresNativeRebuild: boolean;
} {
  if (ON_DEVICE_YOLO_NATIVE) {
    return {
      available: true,
      reason: 'Native YOLO plugin linked',
      requiresNativeRebuild: false,
    };
  }
  return {
    available: false,
    reason:
      'On-device YOLO is not linked in this binary. Live mode uses cloud Vision (~1 fps). A new EAS native build is required for YOLO.',
    requiresNativeRebuild: true,
  };
}

/**
 * Run on-device detection when the native plugin exists.
 * @returns detections or null to fall back to cloud Vision.
 */
export async function detectGarmentsOnDevice(
  _imageUri: string,
): Promise<OnDeviceDetection[] | null> {
  if (!isOnDeviceYoloAvailable()) return null;
  // Native path placeholder — implement when TFLite/Core ML plugin is added.
  return null;
}

/** Map on-device boxes into the live overlay item shape (client-side preview). */
export function detectionsToLiveItems(detections: OnDeviceDetection[]): LiveTrackedItem[] {
  return detections.map((d, i) => ({
    tempId: d.trackId || `yolo_${i}`,
    trackId: d.trackId || `yolo_${i}`,
    name: d.name || d.category,
    category: d.category,
    subcategory: d.subcategory || null,
    color: d.color || 'unknown',
    confidence: d.confidence,
    bbox: d.bbox,
    needsConfirm: d.confidence < 0.55,
    suggestion: d.suggestion || null,
    source: 'on_device_yolo',
  }));
}
