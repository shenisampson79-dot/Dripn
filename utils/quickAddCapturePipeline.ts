/**
 * Quick Add capture pipeline: padded YOLO/guide crop → compress → analyze tags.
 */

import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import { apiService } from '@/services/ApiService';
import { detectGarmentsOnDevice } from '@/services/onDeviceGarmentDetector';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import {
  QUICK_ADD_CAPTURE,
  addPadding,
  bboxFromTuple,
  bboxToTuple,
  paddingForBBox,
  paddingForCategory,
  selectBestDetection,
  type QuickAddBBox,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';

export type CapturePipelineResult = {
  imageUri: string;
  imageBase64?: string;
  cropped: boolean;
  categoryHint?: string;
  detectionConfidence?: number;
  analysis: any;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

export async function cropNormalizedRegion(
  imageUri: string,
  bbox: QuickAddBBox,
  opts?: { padding?: number; maxWidth?: number; compress?: number },
): Promise<{ uri: string; base64?: string } | null> {
  try {
    const pad = opts?.padding ?? paddingForBBox(bbox);
    const padded = addPadding(bbox, pad);
    let width = 0;
    let height = 0;
    try {
      const size = await getImageSize(imageUri);
      width = size.width;
      height = size.height;
    } catch {
      const meta = await ImageManipulator.manipulateAsync(imageUri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      width = meta.width || 1024;
      height = meta.height || 1024;
    }

    const originX = Math.max(0, Math.floor(padded.x * width));
    const originY = Math.max(0, Math.floor(padded.y * height));
    const cropW = Math.max(8, Math.min(width - originX, Math.floor(padded.width * width)));
    const cropH = Math.max(8, Math.min(height - originY, Math.floor(padded.height * height)));

    const cropped = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { crop: { originX, originY, width: cropW, height: cropH } },
        { resize: { width: opts?.maxWidth ?? 1280 } },
      ],
      {
        compress: opts?.compress ?? 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    return { uri: cropped.uri, base64: cropped.base64 || undefined };
  } catch {
    return null;
  }
}

async function resolveDetection(
  photoUri: string,
  detection?: QuickAddYoloDetection | null,
): Promise<QuickAddYoloDetection | null> {
  if (detection?.bbox) return detection;
  try {
    const onDevice = await detectGarmentsOnDevice(photoUri);
    if (!onDevice?.length) return null;
    const mapped: QuickAddYoloDetection[] = onDevice.map((d) => ({
      class: d.category || d.name || 'clothing',
      confidence: d.confidence,
      bbox: bboxFromTuple(d.bbox),
    }));
    return selectBestDetection(mapped);
  } catch {
    return null;
  }
}

/**
 * Crop (YOLO → guide fallback) → rembg + garment analyze in parallel.
 * Always prefers a subject-tight crop so rembg doesn't leave a tiny item on a huge canvas.
 */
export async function processQuickAddCapture(
  photoUri: string,
  detection?: QuickAddYoloDetection | null,
): Promise<CapturePipelineResult> {
  let workUri = photoUri;
  let cropped = false;
  let base64: string | undefined;

  const resolved = await resolveDetection(photoUri, detection);
  const cropBox: QuickAddBBox = resolved?.bbox || QUICK_ADD_CAPTURE.guide;
  const crop = await cropNormalizedRegion(photoUri, cropBox, {
    padding: resolved
      ? paddingForBBox(resolved.bbox, resolved.class)
      : paddingForCategory(undefined, QUICK_ADD_CAPTURE.guide),
  });
  if (crop?.uri) {
    workUri = crop.uri;
    base64 = crop.base64;
    cropped = true;
  }

  if (!base64) {
    const resized = await ImageManipulator.manipulateAsync(
      workUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    workUri = resized.uri;
    base64 = resized.base64 || (await convertImageToBase64(resized.uri));
  }

  const [analyzeOutcome, bgOutcome] = await Promise.allSettled([
    apiService.analyzeGarmentByUri(workUri),
    apiService.removeBackground(base64),
  ]);

  let finalUri = workUri;
  if (
    bgOutcome.status === 'fulfilled'
    && bgOutcome.value?.imageUrl
    && bgOutcome.value?.removed !== false
  ) {
    finalUri = bgOutcome.value.imageUrl;
  }

  let analysis: any = null;
  if (analyzeOutcome.status === 'fulfilled') {
    analysis = analyzeOutcome.value;
  } else {
    try {
      const extract = await apiService.extractClothing({ imageBase64: base64 });
      analysis = {
        clothingAnalysis: extract?.clothingAnalysis,
        suggestedName: extract?.analysis?.suggestedName,
        analysis: extract?.analysis,
      };
    } catch {
      analysis = null;
    }
  }

  if (resolved?.class && analysis) {
    analysis = {
      ...analysis,
      categoryHint: resolved.class,
      detectionConfidence: resolved.confidence,
    };
  }

  return {
    imageUri: finalUri,
    imageBase64: base64,
    cropped,
    categoryHint: resolved?.class,
    detectionConfidence: resolved?.confidence,
    analysis,
  };
}

/** Exported for digitize parity / tests. */
export function paddedBBoxTuple(
  bbox: [number, number, number, number],
  padding = 0.1,
): [number, number, number, number] {
  return bboxToTuple(addPadding(
    { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] },
    padding,
  ));
}
