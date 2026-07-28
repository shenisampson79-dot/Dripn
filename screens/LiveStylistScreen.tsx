/**
 * Live Stylist — continuous camera sampling (~1 fps) + AR overlays.
 * Uses expo-camera. Prefers on-device YOLO TFLite when the native module is linked
 * (EAS binary); otherwise posts the JPEG to cloud Vision. OTA alone cannot add TFLite.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { LiveArOverlay } from '@/components/live/LiveArOverlay';
import { FallbackShopSection, type FallbackMissingItem } from '@/components/stylist/FallbackShopSection';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { apiService } from '@/services/ApiService';
import {
  detectGarmentsOnDevice,
  getOnDeviceYoloStatus,
  warmUpOnDeviceYolo,
} from '@/services/onDeviceGarmentDetector';
import type { LiveFeedback, LiveFrameResponse, LiveTrackedItem } from '@/types/liveStylist';
import { framesLikelySame, hashBase64Frame, stripBase64Prefix } from '@/utils/liveFrameHash';

const SAMPLE_INTERVAL_MS = 1100;
const FRAME_WIDTH = 640;

type LiveParams = {
  occasionType?: string;
};

type NavParamList = {
  LiveStylist: LiveParams | undefined;
  ScanWardrobe: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<NavParamList, 'LiveStylist'>;
  route: RouteProp<NavParamList, 'LiveStylist'>;
};

export default function LiveStylistScreen({ navigation, route }: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const occasionType = route.params?.occasionType || 'casual_day';
  const yoloStatus = getOnDeviceYoloStatus();

  const [isLive, setIsLive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [layout, setLayout] = useState({ width: Dimensions.get('window').width, height: 480 });
  const [items, setItems] = useState<LiveTrackedItem[]>([]);
  const [feedback, setFeedback] = useState<LiveFeedback | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Cloud vision');
  const [selected, setSelected] = useState<LiveTrackedItem | null>(null);
  const [shopHints, setShopHints] = useState<FallbackMissingItem[]>([]);
  const [statusNote, setStatusNote] = useState('Tap Start for live styling');

  const lastHashRef = useRef<string | null>(null);
  const previousItemsRef = useRef<LiveTrackedItem[]>([]);
  const previousFeedbackRef = useRef<LiveFeedback | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const lastCoachShownAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    void warmUpOnDeviceYolo();
    return () => {
      mountedRef.current = false;
      setIsLive(false);
    };
  }, []);

  const applyResponse = useCallback((res: LiveFrameResponse) => {
    if (!mountedRef.current) return;
    if (res.items?.length) {
      previousItemsRef.current = res.items;
      setItems(res.items);
    }

    const next = res.feedback;
    if (!next) return;

    const holdMs = next.ui?.holdMs ?? 1000;
    const withinHold = Date.now() - lastCoachShownAtRef.current < holdMs;
    const serverStable = Boolean(next.ui?.stable);
    const hadFeedback = Boolean(previousFeedbackRef.current);
    const scoreJump = Math.abs((previousFeedbackRef.current?.score || 0) - (next.score || 0)) >= 8;

    if (res.feedbackChanged || !hadFeedback) {
      previousFeedbackRef.current = next;
      const shouldPaint = !hadFeedback || !serverStable || scoreJump || !withinHold;
      if (shouldPaint) {
        setFeedback(next);
        lastCoachShownAtRef.current = Date.now();
      }
    }

    if (res.shopHints?.length) setShopHints(res.shopHints as FallbackMissingItem[]);
    if (res.source === 'cloud_vision') setSourceLabel('Cloud vision');
    else if (String(res.source || '').includes('on_device')) setSourceLabel('On-device');
    else setSourceLabel(String(res.source || 'Live'));
  }, []);

  const processFrame = useCallback(async () => {
    if (!cameraRef.current || inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        shutterSound: false,
        skipProcessing: Platform.OS === 'android',
      });
      if (!photo?.uri) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: FRAME_WIDTH } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = manipulated.base64;
      if (!base64) return;

      const frameHash = hashBase64Frame(base64);
      if (framesLikelySame(lastHashRef.current, frameHash)) {
        setStatusNote('Holding — frame unchanged');
        return;
      }
      lastHashRef.current = frameHash;

      const onDevice = await detectGarmentsOnDevice(manipulated.uri);
      const payload: Record<string, unknown> = {
        occasionType,
        hybridMatch: true,
        frameHash,
        previousItems: previousItemsRef.current,
        previousFeedback: previousFeedbackRef.current,
      };

      if (onDevice?.length) {
        payload.detections = onDevice;
        payload.detectorSource = 'yolo';
        payload.sceneType = 'worn';
      } else {
        payload.imageBase64 = stripBase64Prefix(base64);
      }

      const res = await apiService.liveScanFrame(payload);
      if (!res.success) {
        setStatusNote(res.message || 'Scan failed');
        return;
      }
      applyResponse(res);
      setStatusNote(
        res.itemCount
          ? `${res.itemCount} piece${res.itemCount === 1 ? '' : 's'} · ${res.feedback?.score ?? '—'}`
          : 'No garments yet — hold steadier',
      );
    } catch (error) {
      console.warn('[LiveStylist] frame error:', error);
      const msg = error instanceof Error ? error.message : 'Frame failed';
      if (/rate limit|429/i.test(msg)) setStatusNote('Slowing down — rate limited');
      else if (/budget|spend|limit/i.test(msg)) setStatusNote('AI budget reached for now');
      else setStatusNote('Could not analyse frame');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsBusy(false);
    }
  }, [applyResponse, occasionType]);

  useEffect(() => {
    if (!isLive) return undefined;
    processFrame();
    const id = setInterval(() => {
      processFrame();
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isLive, processFrame]);

  const toggleLive = async () => {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        Alert.alert(
          t('wardrobe.permissionRequired') || 'Permission Required',
          t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || 'Enable camera in Settings.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            { text: t('common.openSettings') || 'Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLive((v) => {
      const next = !v;
      setStatusNote(next ? 'Live — sampling…' : 'Paused');
      return next;
    });
  };

  const openStillScan = () => {
    setIsLive(false);
    navigation.navigate('ScanWardrobe');
  };

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={LuxuryColors.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, padding: Spacing.lg }]}>
        <ThemedText type="h2" style={{ marginBottom: Spacing.md }}>
          Camera access
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' }}>
          Live stylist needs the camera to sample your outfit.
        </ThemedText>
        <Pressable onPress={requestPermission} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}>
          <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
            Allow camera
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000', paddingTop: insets.top }]}>
      <View
        style={styles.cameraWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout({ width, height });
        }}
      >
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture" />
        <LiveArOverlay
          width={layout.width}
          height={layout.height}
          items={items}
          feedback={feedback}
          selectedTrackId={selected?.trackId}
          onSelectItem={(item) => {
            Haptics.selectionAsync();
            setSelected(item);
          }}
        />
      </View>

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.metaRow}>
          <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {sourceLabel} · {statusNote}
          </ThemedText>
          {isBusy ? <ActivityIndicator size="small" color={LuxuryColors.gold} /> : null}
        </View>
        <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          {yoloStatus.available
            ? 'On-device YOLO ready — cloud Vision only if detection fails'
            : yoloStatus.requiresNativeRebuild
              ? 'On-device YOLO needs a new EAS binary — using cloud sampling (OTA insufficient)'
              : 'On-device YOLO unavailable — using cloud sampling'}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
            <Feather name="x" size={22} color="#FFF" />
          </Pressable>
          <Pressable
            onPress={toggleLive}
            style={[styles.primaryBtn, { backgroundColor: isLive ? '#C45C4A' : LuxuryColors.gold, flex: 1 }]}
          >
            <ThemedText type="body" style={{ color: isLive ? '#FFF' : LuxuryColors.midnight, fontWeight: '700' }}>
              {isLive ? 'Stop' : 'Start live'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={openStillScan} style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.35)' }]}>
            <ThemedText type="caption" style={{ color: '#FFF' }}>
              Still scan
            </ThemedText>
          </Pressable>
        </View>
      </LinearGradient>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: isDark ? theme.surface : '#FFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="h3" style={{ marginBottom: 4 }}>
              {selected?.name || 'Garment'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              {selected?.category}
              {selected?.color ? ` · ${selected.color}` : ''}
              {selected?.confidence != null ? ` · ${Math.round(selected.confidence * 100)}%` : ''}
            </ThemedText>
            {selected?.suggestion ? (
              <ThemedText type="body" style={{ marginBottom: Spacing.md }}>
                {selected.suggestion}
              </ThemedText>
            ) : null}
            {selected?.wardrobeMatch ? (
              <ThemedText type="caption" style={{ color: LuxuryColors.gold, marginBottom: Spacing.md }}>
                Matches wardrobe: {selected.wardrobeMatch.name}
              </ThemedText>
            ) : null}
            <FallbackShopSection
              missing={
                shopHints.length
                  ? shopHints
                  : selected
                    ? [{
                        label: selected.name,
                        name: selected.name,
                        role: selected.category,
                        reason: 'Shop similar pieces',
                        products: [],
                        retail: {
                          query: `${selected.color || ''} ${selected.name || selected.category}`.trim(),
                          online: [
                            {
                              retailer: 'Google',
                              searchUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${selected.color || ''} ${selected.name || selected.category}`)}`,
                            },
                          ],
                        },
                      }]
                    : []
              }
              headline="Alternatives & shops"
            />
            <Pressable onPress={() => setSelected(null)} style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold, marginTop: Spacing.md }]}>
              <ThemedText type="body" style={{ color: LuxuryColors.midnight, fontWeight: '600' }}>
                Close
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
});
