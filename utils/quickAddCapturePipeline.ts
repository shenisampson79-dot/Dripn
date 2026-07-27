/**
 * Quick Add capture pipeline: padded YOLO crop → compress → analyze tags.
 */

import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import { apiService } from '@/services/ApiService';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import {
  addPadding,
  bboxToTuple,
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
    const padded = addPadding(bbox, opts?.padding ?? 0.1);
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
        { resize: { width: opts?.maxWidth ?? 1024 } },
      ],
      {
        compress: opts?.compress ?? 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    return { uri: cropped.uri, base64: cropped.base64 || undefined };
  } catch {
    return null;
  }
}

/**
 * Crop (optional) → rembg + garment analyze in parallel.
 */
export async function processQuickAddCapture(
  photoUri: string,
  detection?: QuickAddYoloDetection | null,
): Promise<CapturePipelineResult> {
  let workUri = photoUri;
  let cropped = false;
  let base64: string | undefined;

  if (detection?.bbox) {
    const crop = await cropNormalizedRegion(photoUri, detection.bbox);
    if (crop?.uri) {
      workUri = crop.uri;
      base64 = crop.base64;
      cropped = true;
    }
  }

  if (!base64) {
    const resized = await ImageManipulator.manipulateAsync(
      workUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
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

  if (detection?.class && analysis) {
    analysis = {
      ...analysis,
      categoryHint: detection.class,
      detectionConfidence: detection.confidence,
    };
  }

  return {
    imageUri: finalUri,
    imageBase64: base64,
    cropped,
    categoryHint: detection?.class,
    detectionConfidence: detection?.confidence,
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
