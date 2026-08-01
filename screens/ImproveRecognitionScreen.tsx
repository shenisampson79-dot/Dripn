/**
 * Guided Improve recognition — care-label close-up (~10s).
 * Reuses the Quick Add front photo when available (no re-shoot).
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
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import {
  detectGarmentsOnDeviceHybrid,
  SINGLE_ITEM_HYBRID_OPTS,
} from '@/utils/onDeviceHybridDetect';
import {
  QuickAddCaptureController,
  bboxFromTuple,
  type QuickAddCaptureUi,
  type QuickAddYoloDetection,
} from '@/utils/quickAddAutoCapture';
import { processQuickAddCapture } from '@/utils/quickAddCapturePipeline';
import { takeImproveRecognitionFrontHandoff } from '@/utils/improveRecognitionHandoff';
import { assessCareLabelPresence } from '@/utils/careLabelPresence';

const FRAME_SIZE = 280;
/** Care tags are usually tall — portrait guide matches real labels. */
const LABEL_FRAME_W = 200;
const LABEL_FRAME_H = 360;
const SAMPLE_MS = 1100;
const SAMPLE_WIDTH = 640;
const LABEL_SAMPLE_MS = 850;
/** Amber dwell samples before green countdown starts. */
const LABEL_AMBER_STREAK = 2;
/** Green countdown seconds before auto-capture. */
const LABEL_COUNTDOWN_SEC = 3;

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

/** Heuristic: did Vision actually see a care/size tag (not a random wall/floor)? */
function looksLikeCareLabel(analysis: any): { ok: boolean; reason: string; fields: ReturnType<typeof pickBrandSizeMaterial> } {
  const fields = pickBrandSizeMaterial(analysis);
  const hitCount = [fields.brand, fields.size, fields.material].filter(Boolean).length;
  if (hitCount >= 1) {
    return { ok: true, reason: 'metadata', fields };
  }
  const blob = JSON.stringify(analysis || {}).toLowerCase();
  const careSignals = (
    /\b(care|wash|bleach|iron|dry.?clean|do not|composition|cotton|polyester|viscose|elastane|nylon|made in|rn\s?\d|ca\s?\d|%\b)/.test(blob)
    || /\b(size|uk|eu|us)\s*[:=]?\s*\d{1,3}\b/.test(blob)
  );
  if (careSignals) {
    return { ok: true, reason: 'care_text', fields };
  }
  return { ok: false, reason: 'no_label_signals', fields };
}

type ImproveOutcome = 'full' | 'front_only' | 'label_unread';

export default function ImproveRecognitionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { updateItem, items } = useWardrobe();
  const itemId = String(route.params?.itemId || '');
  const itemName = route.params?.itemName || items.find((i) => String(i.id) === itemId)?.name;
  const handoff = useMemo(() => takeImproveRecognitionFrontHandoff(), []);
  const seededFrontB64 = handoff.base64
    || (route.params?.frontImageBase64 ? stripDataUri(route.params.frontImageBase64) : null);
  const seededFrontUri = handoff.uri || route.params?.frontImageUri || null;
  const hasSeededFront = !!(seededFrontB64 || seededFrontUri);

  const [permission, requestPermission] = useCameraPermissions();
  const yoloStatus = useMemo(() => getOnDeviceYoloStatus(), []);
  const cameraRef = useRef<CameraView>(null);
  const controllerRef = useRef(new QuickAddCaptureController());
  const inFlightRef = useRef(false);
  const capturingRef = useRef(false);
  const seedStartedRef = useRef(false);
  const labelInFlightRef = useRef(false);
  const labelAmberStreakRef = useRef(0);
  const labelCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const labelCountdownActiveRef = useRef(false);
  const takePhotoRef = useRef<() => Promise<void>>(async () => {});
  const stepRef = useRef<ImproveStep>(hasSeededFront ? 'processing' : 'front');

  const [step, setStep] = useState<ImproveStep>(hasSeededFront ? 'processing' : 'front');
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState(
    hasSeededFront
      ? 'Preparing care-label capture…'
      : 'Centre the garment in the box — it can fill the screen',
  );
  const [frameUi, setFrameUi] = useState<QuickAddCaptureUi>('idle');
  const [flash, setFlash] = useState(false);
  const [frontBase64, setFrontBase64] = useState<string | null>(seededFrontB64);
  const [statusText, setStatusText] = useState(
    hasSeededFront ? 'Preparing care-label capture…' : 'Improving recognition…',
  );
  const [labelCountdown, setLabelCountdown] = useState<number | null>(null);

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
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    }
  }, [itemId, navigation]);

  // Reuse the Quick Add front photo — jump straight to the care label.
  useEffect(() => {
    if (seedStartedRef.current || !hasSeededFront) return;
    seedStartedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        let b64 = seededFrontB64;
        if (!b64 && seededFrontUri) {
          b64 = stripDataUri(await convertImageToBase64(seededFrontUri));
        }
        if (!b64) throw new Error('missing front image');
        if (!cancelled) {
          setFrontBase64(b64);
          setStep('label');
          setHint('Fill the tall box with the care label');
          setFrameUi('idle');
          labelAmberStreakRef.current = 0;
          setLabelCountdown(null);
          setStatusText('Improving recognition…');
        }
      } catch (err) {
        console.warn('[ImproveRecognition] seed front failed:', err);
        if (!cancelled) {
          setStep('front');
          setHint('Centre the garment in the box — it can fill the screen');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hasSeededFront, seededFrontB64, seededFrontUri]);

  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const fireFlash = async () => {
    setFlash(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await new Promise((r) => setTimeout(r, 90));
    setFlash(false);
  };

  const finishSuccess = (outcome: ImproveOutcome) => {
    setStep('done');
    Haptics.notificationAsync(
      outcome === 'full'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    const copy =
      outcome === 'full'
        ? {
            title: 'Recognition improved',
            body: 'We saved a visual fingerprint of the front and details from the care label (brand/size/fabric when readable). Next time you scan a similar photo, we can match this item faster.',
          }
        : outcome === 'front_only'
          ? {
              title: 'Front fingerprint saved',
              body: 'We saved a visual fingerprint from the front photo only. Without a clear care label we can’t confirm brand/size — you can run Improve again later for that.',
            }
          : {
              title: 'Front saved — label unclear',
              body: 'We kept the front fingerprint, but couldn’t read brand/size from that photo. Try Improve again with a sharper close-up of the care tag.',
            };
    Alert.alert(copy.title, copy.body, [{ text: 'OK', onPress: () => navigation.popToTop() }]);
  };

  const submitImprove = async (opts: {
    frontB64: string;
    labelB64?: string | null;
    labelAnalysis?: any;
    outcome: ImproveOutcome;
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
      finishSuccess(opts.outcome);
    } catch (err) {
      console.warn('[ImproveRecognition] submit failed:', err);
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
        'We couldn’t sync to the server right now. Your front photo fingerprint may still be incomplete until you’re online.',
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
      setHint('Centre the care label in the box');
      setFrameUi('idle');
      controllerRef.current.reset();
    } catch (err) {
      console.warn('[ImproveRecognition] front failed:', err);
      Alert.alert('Couldn’t capture', 'Try again with better light.');
      setStep('front');
      setHint('Centre the garment in the box — it can fill the screen');
    } finally {
      capturingRef.current = false;
    }
  }, []);

  const handleLabelCapture = useCallback(async (uri: string) => {
    if (capturingRef.current) return;
    if (!frontBase64) {
      Alert.alert('Still preparing', 'One moment — then tap capture again.');
      return;
    }
    capturingRef.current = true;
    labelCountdownActiveRef.current = false;
    if (labelCountdownTimerRef.current) {
      clearInterval(labelCountdownTimerRef.current);
      labelCountdownTimerRef.current = null;
    }
    setLabelCountdown(null);
    setStep('processing');
    setStatusText('Checking this is a care label…');
    setFrameUi('ready');
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

      const check = looksLikeCareLabel(analysis);
      if (!check.ok) {
        capturingRef.current = false;
        setStep('label');
        setFrameUi('idle');
        labelAmberStreakRef.current = 0;
        setHint('Fill the tall box with the care label');
        Alert.alert(
          'Not a care label',
          'We couldn’t see brand, size, or care text in that photo. Point at the garment’s care/size tag inside the tall box until the frame turns green.',
          [
            { text: 'Try again' },
            {
              text: 'Skip label',
              style: 'cancel',
              onPress: () => {
                void submitImprove({
                  frontB64: frontBase64,
                  labelB64: null,
                  outcome: 'front_only',
                });
              },
            },
          ],
        );
        return;
      }

      await submitImprove({
        frontB64: frontBase64,
        labelB64,
        labelAnalysis: analysis,
        outcome: 'full',
      });
    } catch (err) {
      console.warn('[ImproveRecognition] label failed:', err);
      Alert.alert('Couldn’t capture label', 'Try a closer, sharper shot of the care tag.', [
        {
          text: 'Retry',
          onPress: () => {
            setStep('label');
            setHint('Fill the tall box with the care label · then tap capture');
          },
        },
        {
          text: 'Skip label',
          style: 'cancel',
          onPress: () => {
            void submitImprove({
              frontB64: frontBase64,
              labelB64: null,
              outcome: 'front_only',
            });
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
  takePhotoRef.current = takePhoto;

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
      const onDevice = await detectGarmentsOnDeviceHybrid(small.uri, {
        ...SINGLE_ITEM_HYBRID_OPTS,
      });
      if (stepRef.current !== 'front') return;
      const detections: QuickAddYoloDetection[] = (onDevice || []).map((d) => ({
        class: d.category || d.name || 'clothing',
        confidence: d.confidence,
        bbox: bboxFromTuple(d.bbox),
      }));
      const { best, eval: evaluation, armed } = controllerRef.current.onFrame(detections);
      setHint(evaluation.hint);
      setFrameUi(evaluation.ui);
      if (armed && best) {
        controllerRef.current.markCaptured();
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

  const clearLabelCountdown = useCallback(() => {
    if (labelCountdownTimerRef.current) {
      clearInterval(labelCountdownTimerRef.current);
      labelCountdownTimerRef.current = null;
    }
    labelCountdownActiveRef.current = false;
    setLabelCountdown(null);
  }, []);

  const startLabelCountdown = useCallback(() => {
    if (labelCountdownActiveRef.current || capturingRef.current) return;
    labelCountdownActiveRef.current = true;
    let n = LABEL_COUNTDOWN_SEC;
    setFrameUi('ready');
    setLabelCountdown(n);
    setHint(`Hold still — capturing in ${n}…`);
    Haptics.selectionAsync().catch(() => {});
    labelCountdownTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (labelCountdownTimerRef.current) {
          clearInterval(labelCountdownTimerRef.current);
          labelCountdownTimerRef.current = null;
        }
        labelCountdownActiveRef.current = false;
        setLabelCountdown(null);
        setHint('Capturing care label…');
        void takePhotoRef.current();
        return;
      }
      setLabelCountdown(n);
      setFrameUi('ready');
      setHint(`Hold still — capturing in ${n}…`);
      Haptics.selectionAsync().catch(() => {});
    }, 1000);
  }, []);

  const sampleLabelPresence = useCallback(async () => {
    if (
      stepRef.current !== 'label'
      || !cameraRef.current
      || !frontBase64
      || labelInFlightRef.current
      || capturingRef.current
    ) return;

    if (labelCountdownActiveRef.current) {
      labelInFlightRef.current = true;
      try {
        const snap = await cameraRef.current.takePictureAsync({
          quality: 0.35,
          shutterSound: false,
          skipProcessing: Platform.OS === 'android',
        });
        if (!snap?.uri || stepRef.current !== 'label') return;
        const presence = await assessCareLabelPresence(snap.uri);
        if (presence.ui === 'idle') {
          clearLabelCountdown();
          labelAmberStreakRef.current = 0;
          setFrameUi('idle');
          setHint('Fill the tall box with the care label');
        }
      } catch {
        /* ignore */
      } finally {
        labelInFlightRef.current = false;
      }
      return;
    }

    labelInFlightRef.current = true;
    try {
      const snap = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!snap?.uri || stepRef.current !== 'label') return;
      const presence = await assessCareLabelPresence(snap.uri);
      if (stepRef.current !== 'label' || capturingRef.current || labelCountdownActiveRef.current) return;

      if (presence.ui === 'idle') {
        labelAmberStreakRef.current = 0;
        setFrameUi('idle');
        setHint('Fill the tall box with the care label');
        return;
      }

      // Amber first so the user can prepare, even if presence score is already "ready".
      labelAmberStreakRef.current += 1;
      setFrameUi('hold');
      if (labelAmberStreakRef.current < LABEL_AMBER_STREAK) {
        setHint('Label spotted — hold steady…');
        return;
      }
      setHint('Ready — starting countdown…');
      startLabelCountdown();
    } catch {
      /* ignore sample errors */
    } finally {
      labelInFlightRef.current = false;
    }
  }, [clearLabelCountdown, frontBase64, startLabelCountdown]);

  useEffect(() => {
    if (step !== 'label' || !permission?.granted || !frontBase64) return undefined;
    labelAmberStreakRef.current = 0;
    clearLabelCountdown();
    const id = setInterval(() => { void sampleLabelPresence(); }, LABEL_SAMPLE_MS);
    return () => {
      clearInterval(id);
      clearLabelCountdown();
    };
  }, [step, permission?.granted, frontBase64, sampleLabelPresence, clearLabelCountdown]);

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
  const progressLabel = isLabel
    ? (hasSeededFront ? 'Step 1 of 1' : 'Step 2 of 2')
    : 'Step 1 of 2';
  const title = isLabel ? 'Capture the care label' : 'Show the front';
  const subtitle = isLabel
    ? 'Amber to prepare · green countdown · then capture'
    : 'Centre the garment in the box — it can fill the screen';

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
          <Pressable onPress={() => navigation.popToTop()} hitSlop={10} style={styles.iconBtn}>
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
        >
          {labelCountdown != null ? (
            <ThemedText type="h2" style={styles.countdownText}>{labelCountdown}</ThemedText>
          ) : null}
        </View>
        <ThemedText type="body" style={styles.hint}>{hint}</ThemedText>
        {isLabel ? (
          <ThemedText type="caption" style={styles.hintSub}>
            Amber prepare → green 3·2·1 → capture (or tap shutter)
          </ThemedText>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {isLabel ? (
          <Pressable
            onPress={() => {
              if (!frontBase64) return;
              Alert.alert(
                'Skip label?',
                'We’ll still save a visual fingerprint from the front photo. Brand/size from the care tag will be skipped.',
                [
                  { text: 'Keep going', style: 'cancel' },
                  {
                    text: 'Skip',
                    onPress: () => void submitImprove({
                      frontB64: frontBase64,
                      labelB64: null,
                      outcome: 'front_only',
                    }),
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
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameHold: { borderColor: '#E0A84A' },
  frameReady: { borderColor: '#4CAF50' },
  countdownText: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 8,
  },
  hint: {
    color: '#FFF',
    marginTop: Spacing.md,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  hintSub: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    textAlign: 'center',
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
