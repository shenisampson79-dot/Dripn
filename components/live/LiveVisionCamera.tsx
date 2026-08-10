/**
 * VisionCamera (v5) preview + photo sample for Live Stylist.
 *
 * IMPORTANT: `<Camera />` already creates its own PreviewOutput internally.
 * Do NOT pass another usePreviewOutput() in `outputs` — a second preview
 * breaks the session and leaves a black screen.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
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
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  // Photo only — Camera wraps its own preview output.
  const photoOutput = usePhotoOutput({
    qualityPrioritization: 'speed',
    quality: 0.55,
  });
  const cameraRef = useRef<CameraRef>(null);
  const readyRef = useRef(false);
  const capturingRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

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

  const markReady = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReadyRef.current?.();
  };

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
        onErrorRef.current?.(msg);
        return null;
      } finally {
        capturingRef.current = false;
      }
    },
  }), [device, hasPermission, isActive, photoOutput]);

  if (!device || !hasPermission) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[photoOutput]}
      isActive={isActive}
      onStarted={() => {
        markReady();
      }}
      onPreviewStarted={() => {
        markReady();
      }}
      onError={(e) => {
        readyRef.current = false;
        onErrorRef.current?.(e.message);
      }}
      onStopped={() => {
        readyRef.current = false;
      }}
    />
  );
});
