/**
 * On-device care-label presence for Improve Recognition UI arming.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import type { QuickAddCaptureUi } from '@/utils/quickAddAutoCapture';
import {
  CARE_LABEL_PRESENCE,
  presenceToUi,
  scoreCareLabelRgba,
} from '@/utils/careLabelPresenceCore';

export {
  CARE_LABEL_PRESENCE,
  CARE_LABEL_ROI,
  presenceToUi,
  scoreCareLabelRgba,
} from '@/utils/careLabelPresenceCore';

export type CareLabelPresence = {
  score: number;
  meanLuma: number;
  contrast: number;
  brightRatio: number;
  ui: QuickAddCaptureUi;
  hint: string;
};

export async function assessCareLabelPresence(imageUri: string): Promise<CareLabelPresence> {
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: CARE_LABEL_PRESENCE.sampleWidth } }],
    { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
  );
  const res = await fetch(resized.uri);
  const buf = await res.arrayBuffer();
  const decoded = decodeJpeg(new Uint8Array(buf), { useTArray: true });
  const metrics = scoreCareLabelRgba(
    decoded.data as Uint8Array,
    decoded.width,
    decoded.height,
  );
  const { ui, hint } = presenceToUi(metrics.score);
  return { ...metrics, ui, hint };
}
