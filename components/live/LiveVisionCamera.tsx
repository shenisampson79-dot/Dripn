/**
 * VisionCamera (v5) Live preview + frame output (no photo capture).
 *
 * Frame acquisition uses useFrameOutput → throttled RGB buffers → JS via scheduleOnRN.
 * Requires react-native-vision-camera-worklets in the native binary (EAS rebuild).
 *
 * Do NOT pass usePreviewOutput() — Camera already owns preview.
 * Do NOT use usePhotoOutput / capturePhoto for Live sampling.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type CameraRef,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import type { LiveFrameSample } from '@/utils/liveFrameBuffer';

export type LiveVisionCameraHandle = {
  isReady: () => boolean;
};

type Props = {
  isActive: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
  /** Throttled frame samples (~3–4 FPS). Must return quickly; heavy work stays on JS. */
  onFrameSample?: (sample: LiveFrameSample) => void;
};

/** Min gap between delivered frames (ms). */
const FRAME_MIN_INTERVAL_MS = 280;

export const LiveVisionCamera = forwardRef<LiveVisionCameraHandle, Props>(function LiveVisionCamera(
  { isActive, onReady, onError, onFrameSample },
  ref,
) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const cameraRef = useRef<CameraRef>(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onFrameSampleRef = useRef(onFrameSample);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onFrameSampleRef.current = onFrameSample;

  const lastProcessedAt = useSharedValue(0);

  useEffect(() => {
    if (hasPermission) return;
    if (!canRequestPermission) {
      onErrorRef.current?.('Camera permission denied — enable it in Settings');
      return;
    }
    void requestPermission()
      .then((granted) => {
        if (!granted) {
          onErrorRef.current?.('Camera permission denied — enable it in Settings');
        }
      })
      .catch(() => {
        onErrorRef.current?.('Could not request camera permission');
      });
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    if (!device && hasPermission) {
      onErrorRef.current?.('No back camera available on this device');
    }
  }, [device, hasPermission]);

  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReadyRef.current?.();
  }, []);

  const deliverSample = useCallback((sample: LiveFrameSample) => {
    onFrameSampleRef.current?.(sample);
  }, []);

  const reportError = useCallback((message: string) => {
    readyRef.current = false;
    onErrorRef.current?.(message);
  }, []);

  const onFrame = useCallback((frame: Frame) => {
    'worklet';
    const now = performance.now();
    if (now - lastProcessedAt.value < FRAME_MIN_INTERVAL_MS) {
      frame.dispose();
      return;
    }
    if (!frame.hasPixelBuffer) {
      frame.dispose();
      return;
    }
    lastProcessedAt.value = now;
    try {
      const pixelBuffer = frame.getPixelBuffer();
      // Copy before dispose — GPU buffer is invalidated after dispose().
      const copy = pixelBuffer.slice(0);
      const sample: LiveFrameSample = {
        width: frame.width,
        height: frame.height,
        buffer: copy,
        pixelFormat: String(frame.pixelFormat || 'rgb'),
        bytesPerRow: frame.bytesPerRow || undefined,
      };
      scheduleOnRN(deliverSample, sample);
    } catch {
      // Drop malformed frames silently — next tick retries.
    } finally {
      frame.dispose();
    }
  }, [deliverSample, lastProcessedAt]);

  const frameOutput = useFrameOutput({
    // LiteRT / TFLite path prefers RGB conversion in the camera pipeline.
    pixelFormat: 'rgb',
    targetResolution: CommonResolutions.VGA_16_9,
    dropFramesWhileBusy: true,
    onFrame,
  });

  useImperativeHandle(ref, () => ({
    isReady: () => Boolean(readyRef.current && device && hasPermission),
  }), [device, hasPermission]);

  if (!device || !hasPermission) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[frameOutput]}
      isActive={isActive}
      onStarted={() => {
        markReady();
      }}
      onPreviewStarted={() => {
        markReady();
      }}
      onError={(e) => {
        reportError(e.message);
      }}
      onStopped={() => {
        readyRef.current = false;
      }}
    />
  );
});
