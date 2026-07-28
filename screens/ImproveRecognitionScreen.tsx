/**
 * Guided Improve recognition — front shot + care-label close-up (~10s).
 * Opt-in after Quick Add save. Never blocks the initial save.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { LuxuryColors, Spacing } from '@/constants/theme';
import { useWardrobe } from '@/contexts/WardrobeContext';
import type { WardrobeStackParamList } from '@/navigation/WardrobeStackNavigator';
import { apiService } from '@/services/ApiService';
import { convertImageToBase64 } from '@/services/VisionAnalysisService';
import {
  detectGarmentsOnDevice,
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import {
  QuickAddCaptureController,
  bboxFromTuple,
  type QuickAddCaptureUi,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';
import { processQuickAddCapture } from '@/utils/quickAddCapturePipeline';

const FRAME_SIZE = 280;
const LABEL_FRAME_W = 300;
const LABEL_FRAME_H = 180;
const SAMPLE_MS = 1100;
const SAMPLE_WIDTH = 640;

type ImproveStep = 'front' | 'label' | 'processing' | 'done';

type Props = {
  navigation: NativeStackNavigationProp<WardrobeStackParamList, 'ImproveRecognition'>;
  route: RouteProp<WardrobeStackParamList, 'ImproveRecognition'>;
};

function stripDataUri(b64: string): string {
  return String(b64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
}

function pickBrandSizeMaterial(analysis: any): {
  brand?: string;
  size?: string;
  material?: string;
  name?: string;
} {
  const main = analysis?.analysis?.mainItem || analysis?.clothingAnalysis || analysis?.analysis || analysis || {};
  const brand = main?.brand || analysis?.suggestedBrand || analysis?.brand;
  const size = main?.size || analysis?.size || main?.labelSize;
  const material = main?.material || analysis?.material || main?.fabric;
  const name = analysis?.suggestedName || analysis?.analysis?.suggestedName || main?.description;
  return {
    brand: brand ? String(brand).trim() : undefined,
    size: size ? String(size).trim() : undefined,
    material: material ? String(material).trim() : undefined,
    name: name ? String(name).trim() : undefined,
  };
}

export default function ImproveRecognitionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { updateItem, items } = useWardrobe();
  const itemId = String(route.params?.itemId || '');
  const itemName = route.params?.itemName || items.find((i) => String(i.id) === itemId)?.name;

  const [permission, requestPermission] = useCameraPermissions();
  const yoloStatus = useMemo(() => getOnDeviceYoloStatus(), []);
  const cameraRef = useRef<CameraView>(null);
  const controllerRef = useRef(new QuickAddCaptureController());
  const inFlightRef = useRef(false);
  const capturingRef = useRef(false);
  const stepRef = useRef<ImproveStep>('front');

  const [step, setStep] = useState<ImproveStep>('front');
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState('Show the front');
  const [frameUi, setFrameUi] = useState<QuickAddCaptureUi>('idle');
  const [flash, setFlash] = useState(false);
  const [frontBase64, setFrontBase64] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Improving recognition…');

  stepRef.current = step;

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (yoloStatus.available) void warmUpOnDeviceYolo();
  }, [yoloStatus.available]);

  useEffect(() => {
    if (!itemId) {
      Alert.alert('Missing item', 'Save the item first, then improve recognition.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [itemId, navigation]);

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const fireFlash = async () => {
    setFlash(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await new Promise((r) => setTimeout(r, 90));
    setFlash(false);
  };

  const finishSuccess = () => {
    setStep('done');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      'Perfect',
      'We’ll recognise this instantly next time.',
      [{ text: 'OK', onPress: () => navigation.popToTop() }],
    );
  };

  const submitImprove = async (opts: {
    frontB64: string;
    labelB64?: string | null;
    labelAnalysis?: any;
  }) => {
    setStep('processing');
    setStatusText('Saving recognition details…');
    const fromLabel = pickBrandSizeMaterial(opts.labelAnalysis);
    try {
      const result = await apiService.improveWardrobeRecognition(itemId, {
        frontImageBase64: stripDataUri(opts.frontB64),
        labelImageBase64: opts.labelB64 ? stripDataUri(opts.labelB64) : undefined,
        brand: fromLabel.brand,
        size: fromLabel.size,
        material: fromLabel.material,
        name: fromLabel.name,
      });

      const patch: Record<string, unknown> = {};
      if (fromLabel.brand) patch.brand = fromLabel.brand;
      if (fromLabel.size) patch.size = fromLabel.size;
      if (fromLabel.material) patch.material = fromLabel.material;
      if (result?.item?.imageUrl || result?.frontImageUrl) {
        const url = result.item?.processedImageUrl || result.item?.imageUrl || result.frontImageUrl;
        if (url) {
          patch.imageUri = url;
          patch.enhancedImageUri = url;
        }
      }
      if (Object.keys(patch).length) {
        await updateItem(itemId, patch as any);
      }
      finishSuccess();
    } catch (err) {
      console.warn('[ImproveRecognition] submit failed:', err);
      // Still mark locally so UX isn't a dead end offline
      try {
        await updateItem(itemId, {
          ...(fromLabel.brand ? { brand: fromLabel.brand } : {}),
          ...(fromLabel.size ? { size: fromLabel.size } : {}),
          ...(fromLabel.material ? { material: fromLabel.material } : {}),
        } as any);
      } catch {
        /* ignore */
      }
      Alert.alert(
        'Saved locally',
        'We couldn’t sync recognition to the server right now, but your photos were captured. Try again when online.',
        [{ text: 'OK', onPress: () => navigation.popToTop() }],
      );
    }
  };

  const handleFrontCapture = useCallback(async (uri: string, detection?: QuickAddYoloDetection | null) => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    controllerRef.current.reset();
    setStep('processing');
    setStatusText('Capturing the front…');
    try {
      await fireFlash();
      const pipeline = await processQuickAddCapture(uri, detection || null);
      const b64 = pipeline.imageBase64 || await convertImageToBase64(pipeline.imageUri);
      setFrontBase64(b64);
      setStep('label');
      setHint('Capture the label');
      setFrameUi('idle');
      controllerRef.current.reset();
    } catch (err) {
      console.warn('[ImproveRecognition] front failed:', err);
      Alert.alert('Couldn’t capture', 'Try again with better light.');
      setStep('front');
      setHint('Show the front');
    } finally {
      capturingRef.current = false;
    }
  }, []);

  const handleLabelCapture = useCallback(async (uri: string) => {
    if (capturingRef.current || !frontBase64) return;
    capturingRef.current = true;
    setStep('processing');
    setStatusText('Reading the care label…');
    try {
      await fireFlash();
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const labelB64 = compressed.base64 || await convertImageToBase64(compressed.uri);
      let analysis: any = null;
      try {
        analysis = await apiService.analyzeGarmentPhoto(stripDataUri(labelB64), { detailed: true });
      } catch (analyzeErr) {
        console.warn('[ImproveRecognition] label analyze failed:', analyzeErr);
      }
      await submitImprove({
        frontB64: frontBase64,
        labelB64,
        labelAnalysis: analysis,
      });
    } catch (err) {
      console.warn('[ImproveRecognition] label failed:', err);
      Alert.alert('Couldn’t capture label', 'Try a closer shot of the care tag.', [
        { text: 'Retry', onPress: () => { setStep('label'); setHint('Capture the label'); } },
        {
          text: 'Skip label',
          style: 'cancel',
          onPress: () => {
            void submitImprove({ frontB64: frontBase64, labelB64: null });
          },
        },
      ]);
      setStep('label');
    } finally {
      capturingRef.current = false;
    }
  }, [frontBase64]);

  const takePhoto = async () => {
    if (!cameraRef.current || capturingRef.current) return;
    try {
      const snap = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!snap?.uri) return;
      if (stepRef.current === 'front') {
        await handleFrontCapture(snap.uri);
      } else if (stepRef.current === 'label') {
        await handleLabelCapture(snap.uri);
      }
    } catch (err) {
      console.warn('[ImproveRecognition] shutter failed:', err);
    }
  };

  const sampleForAuto = useCallback(async () => {
    if (
      stepRef.current !== 'front'
      || !yoloStatus.available
      || !cameraRef.current
      || inFlightRef.current
      || capturingRef.current
    ) return;
    inFlightRef.current = true;
    try {
      const snap = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!snap?.uri || stepRef.current !== 'front') return;
      const small = await ImageManipulator.manipulateAsync(
        snap.uri,
        [{ resize: { width: SAMPLE_WIDTH } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
      );
      const onDevice = await detectGarmentsOnDevice(small.uri);
      if (stepRef.current !== 'front') return;
      const detections: QuickAddYoloDetection[] = (onDevice || []).map((d) => ({
        class: d.category || d.name || 'clothing',
        confidence: d.confidence,
        bbox: bboxFromTuple(d.bbox),
      }));
      const { best, eval: evaluation, trigger } = controllerRef.current.onFrame(detections);
      setHint(evaluation.hint === 'Center the item' ? 'Show the front' : evaluation.hint);
      setFrameUi(evaluation.ui);
      if (trigger && best) {
        await handleFrontCapture(small.uri, best);
      }
    } catch {
      /* ignore sample errors */
    } finally {
      inFlightRef.current = false;
    }
  }, [handleFrontCapture, yoloStatus.available]);

  useEffect(() => {
    if (step !== 'front' || !permission?.granted || !yoloStatus.available) return undefined;
    const id = setInterval(() => { void sampleForAuto(); }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [step, permission?.granted, yoloStatus.available, sampleForAuto]);

  if (step === 'processing' || step === 'done') {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={LuxuryColors.gold} />
        <ThemedText type="body" style={styles.processingText}>
          {statusText}
        </ThemedText>
      </View>
    );
  }

  const isLabel = step === 'label';
  const progressLabel = isLabel ? 'Step 2 of 2' : 'Step 1 of 2';
  const title = isLabel ? 'Capture the label' : 'Show the front';
  const subtitle = isLabel
    ? 'Care tag / size label · fill the frame'
    : 'Whole garment facing the camera · ~10 seconds';

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          mode="picture"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: '#111' }]}>
          <ThemedText type="body" style={{ color: '#FFF', marginBottom: Spacing.md }}>
            Camera permission needed
          </ThemedText>
          <Pressable onPress={() => void requestPermission()} style={styles.primaryBtn}>
            <ThemedText type="body" style={styles.primaryBtnText}>Allow camera</ThemedText>
          </Pressable>
          <Pressable onPress={openSettings} style={{ marginTop: Spacing.md }}>
            <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>Open Settings</ThemedText>
          </Pressable>
        </View>
      )}

      {flash ? <View style={styles.flashOverlay} pointerEvents="none" /> : null}

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={[styles.topFade, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="x" size={22} color="#FFF" />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <ThemedText type="caption" style={styles.progress}>{progressLabel}</ThemedText>
            <ThemedText type="body" style={styles.title}>{title}</ThemedText>
            <ThemedText type="caption" style={styles.subtitle}>
              {itemName ? `${itemName} · ${subtitle}` : subtitle}
            </ThemedText>
          </View>
          <Pressable onPress={() => setTorch((v) => !v)} hitSlop={10} style={styles.iconBtn}>
            <Feather name={torch ? 'zap' : 'zap-off'} size={20} color="#FFF" />
          </Pressable>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.overlayCenter,
          {
            top: insets.top + 72,
            bottom: Math.max(insets.bottom, 16) + 130,
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            isLabel ? styles.labelFrame : styles.frame,
            frameUi === 'ready' && styles.frameReady,
            frameUi === 'hold' && styles.frameHold,
          ]}
        />
        <ThemedText type="body" style={styles.hint}>{hint}</ThemedText>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {isLabel ? (
          <Pressable
            onPress={() => {
              if (!frontBase64) return;
              Alert.alert(
                'Skip label?',
                'Front photo alone still helps. Label makes brand & size more reliable.',
                [
                  { text: 'Keep going', style: 'cancel' },
                  {
                    text: 'Skip',
                    onPress: () => void submitImprove({ frontB64: frontBase64, labelB64: null }),
                  },
                ],
              );
            }}
            style={styles.sideBtn}
          >
            <ThemedText type="caption" style={{ color: '#FFF' }}>Skip</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.sideBtn} />
        )}
        <Pressable
          onPress={() => void takePhoto()}
          style={styles.captureOuter}
          accessibilityRole="button"
          accessibilityLabel="Capture"
        >
          <View style={styles.captureInner} />
        </Pressable>
        <View style={styles.sideBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  processingText: { color: '#FFF', marginTop: Spacing.lg, textAlign: 'center', paddingHorizontal: 24 },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    opacity: 0.85,
    zIndex: 20,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  topBar: {
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { color: LuxuryColors.gold, fontWeight: '600', marginBottom: 2 },
  title: { color: '#FFF', fontWeight: '700', fontSize: 17 },
  subtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 2, textAlign: 'center', paddingHorizontal: 8 },
  overlayCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  labelFrame: {
    width: LABEL_FRAME_W,
    height: LABEL_FRAME_H,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  frameHold: { borderColor: '#E0A84A' },
  frameReady: { borderColor: '#4CAF50' },
  hint: {
    color: '#FFF',
    marginTop: Spacing.md,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    zIndex: 5,
  },
  sideBtn: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  primaryBtn: {
    backgroundColor: LuxuryColors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: LuxuryColors.midnight, fontWeight: '700' },
});
