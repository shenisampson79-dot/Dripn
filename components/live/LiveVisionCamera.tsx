/**
 * VisionCamera (v5) Live preview + frame output (no photo capture).
 *
 * Ownership:
 *   Frame (callback) → convertFrameToImage (CPU copy) → Image
 *   scheduleOnRN transfers Image ownership to RN; then frame.dispose().
 *
 * Prove chain before analysis:
 *   FRAME_RECEIVED → IMAGE_CREATED → PIXELS_ON_JS → (JS) PIXELS_EXTRACTED
 *
 * Requires react-native-vision-camera-worklets in the native binary.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { Image } from 'react-native-nitro-image';
import {
  Camera,
  CommonResolutions,
  HybridFrameConverter,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type CameraRef,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

export type LiveVisionCameraHandle = {
  isReady: () => boolean;
};

type Props = {
  isActive: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
  /** Pipeline stage crumbs (FRAME_RECEIVED / IMAGE_CREATED / …). */
  onPipelineStage?: (stage: string, detail?: string) => void;
  /** Throttled frame images. Caller owns dispose after handoff. */
  onFrameSample?: (image: Image) => void;
};

/**
 * Start at 1 FPS until the RN pixel pipeline is proven.
 * Bump toward ~500ms only after PIXELS_EXTRACTED is consistently healthy.
 */
const FRAME_MIN_INTERVAL_MS = 1000;

export const LiveVisionCamera = forwardRef<LiveVisionCameraHandle, Props>(function LiveVisionCamera(
  { isActive, onReady, onError, onPipelineStage, onFrameSample },
  ref,
) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const cameraRef = useRef<CameraRef>(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPipelineStageRef = useRef(onPipelineStage);
  const onFrameSampleRef = useRef(onFrameSample);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onPipelineStageRef.current = onPipelineStage;
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
    // Device factory loads async after permission — don't fail on the first null tick.
    if (!hasPermission || device) return;
    const timer = setTimeout(() => {
      onErrorRef.current?.('No back camera available on this device');
    }, 4000);
    return () => clearTimeout(timer);
  }, [device, hasPermission]);

  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReadyRef.current?.();
  }, []);

  const reportStage = useCallback((stage: string, detail?: string) => {
    onPipelineStageRef.current?.(stage, detail);
  }, []);

  const deliverImage = useCallback((image: Image, meta: string) => {
    // Ownership: this RN callback now owns `image` (transferred via scheduleOnRN).
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    reportStage('PIXELS_ON_JS', `${w}x${h} via=${meta}`);
    if (!image || w < 16 || h < 16) {
      reportStage('PIXELS_ON_JS_INVALID', `${w}x${h}`);
      try { image?.dispose(); } catch { /* ignore */ }
      return;
    }
    const consumer = onFrameSampleRef.current;
    if (!consumer) {
      try { image.dispose(); } catch { /* ignore */ }
      return;
    }
    consumer(image);
  }, [reportStage]);

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
    lastProcessedAt.value = now;

    const w = frame.width;
    const h = frame.height;
    const fmt = String(frame.pixelFormat || '?');
    const orient = String(frame.orientation || '?');
    const ts = frame.timestamp;
    const hasBuf = Boolean(frame.hasPixelBuffer);
    const valid = Boolean(frame.isValid);

    scheduleOnRN(reportStage, 'FRAME_RECEIVED', `${w}x${h} fmt=${fmt} orient=${orient} ts=${ts} hasBuf=${hasBuf} valid=${valid}`);

    if (!valid || w < 16 || h < 16) {
      scheduleOnRN(reportStage, 'FRAME_RECEIVED_INVALID', `${w}x${h} valid=${valid}`);
      frame.dispose();
      return;
    }

    // Explicit ownership: only dispose Image here if transfer to RN failed.
    let image: Image | null = null;
    try {
      image = HybridFrameConverter.convertFrameToImage(frame);
      const iw = image.width;
      const ih = image.height;
      scheduleOnRN(reportStage, 'IMAGE_CREATED', `${iw}x${ih} fromFrame=${w}x${h}`);
      if (iw < 16 || ih < 16) {
        scheduleOnRN(reportStage, 'IMAGE_CREATED_INVALID', `${iw}x${ih}`);
        return;
      }
      scheduleOnRN(deliverImage, image, `${fmt}:${iw}x${ih}`);
      image = null; // ownership transferred to RN callback
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'convert_failed';
      scheduleOnRN(reportStage, 'IMAGE_CREATED_FAIL', msg);
    } finally {
      frame.dispose();
      if (image) {
        try {
          image.dispose();
        } catch {
          /* ignore */
        }
      }
    }
  }, [deliverImage, lastProcessedAt, reportStage]);

  const frameOutput = useFrameOutput({
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
