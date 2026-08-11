/**
 * Lazily requires VisionCamera so old binaries (no native link) never evaluate
 * react-native-vision-camera until we know the module is linked and mounted.
 */
import React, { forwardRef } from 'react';
import type { Image } from 'react-native-nitro-image';
import type { LiveVisionCameraHandle } from './LiveVisionCamera';

type Props = {
  isActive: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPipelineStage?: (stage: string, detail?: string) => void;
  onFrameSample?: (image: Image) => void;
};

export const LiveVisionCameraGate = forwardRef<LiveVisionCameraHandle, Props>(function LiveVisionCameraGate(
  props,
  ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LiveVisionCamera } = require('./LiveVisionCamera') as typeof import('./LiveVisionCamera');
  return <LiveVisionCamera ref={ref} {...props} />;
});
