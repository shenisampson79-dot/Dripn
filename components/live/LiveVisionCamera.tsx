/**
 * VisionCamera (v5) preview + photo sample for Live Stylist.
 * Uses photoOutput.capturePhoto — not Expo takePictureAsync.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  usePreviewOutput,
  type CameraRef,
} from 'react-native-vision-camera';

export type LiveVisionCameraHandle = {
  takeSampleAsync: () => Promise<{ uri: string } | null>;
  isReady: () => boolean;
};

type Props = {
  isActive: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export const LiveVisionCamera = forwardRef<LiveVisionCameraHandle, Props>(function LiveVisionCamera(
  { isActive, onReady, onError },
  ref,
) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const previewOutput = usePreviewOutput();
  const photoOutput = usePhotoOutput({
    qualityPrioritization: 'speed',
    quality: 0.55,
  });
  const outputs = useMemo(() => [previewOutput, photoOutput], [previewOutput, photoOutput]);
  const cameraRef = useRef<CameraRef>(null);
  const readyRef = useRef(false);
  const capturingRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission().catch(() => {});
    }
  }, [hasPermission, requestPermission]);

  useImperativeHandle(ref, () => ({
    isReady: () => Boolean(readyRef.current && device && hasPermission),
    takeSampleAsync: async () => {
      if (!readyRef.current || !isActive || capturingRef.current) return null;
      capturingRef.current = true;
      try {
        const photo = await photoOutput.capturePhoto({}, {});
        const path = await photo.saveToTemporaryFileAsync();
        photo.dispose();
        if (!path) return null;
        return { uri: toFileUri(path) };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'vision capture failed';
        onError?.(msg);
        return null;
      } finally {
        capturingRef.current = false;
      }
    },
  }), [device, hasPermission, isActive, onError, photoOutput]);

  if (!device || !hasPermission) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={outputs}
      isActive={isActive}
      onStarted={() => {
        readyRef.current = true;
        onReady?.();
      }}
      onPreviewStarted={() => {
        readyRef.current = true;
        onReady?.();
      }}
      onError={(e) => {
        readyRef.current = false;
        onError?.(e.message);
      }}
      onStopped={() => {
        readyRef.current = false;
      }}
    />
  );
});
