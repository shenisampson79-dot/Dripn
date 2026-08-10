/**
 * Lazily requires VisionCamera so old binaries (no native link) never evaluate
 * react-native-vision-camera until we know the module is linked and mounted.
 */
import React, { forwardRef } from 'react';
import type { LiveVisionCameraHandle } from './LiveVisionCamera';
import type { LiveFrameSample } from '@/utils/liveFrameBuffer';

type Props = {
  isActive: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
  onFrameSample?: (sample: LiveFrameSample) => void;
};

export const LiveVisionCameraGate = forwardRef<LiveVisionCameraHandle, Props>(function LiveVisionCameraGate(
  props,
  ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LiveVisionCamera } = require('./LiveVisionCamera') as typeof import('./LiveVisionCamera');
  return <LiveVisionCamera ref={ref} {...props} />;
});
