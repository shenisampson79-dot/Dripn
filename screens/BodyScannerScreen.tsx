/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * AI Body Scanner - Advanced GPT-4 Vision powered body analysis
 * Scans full-body photos to extract measurements and body proportions
 */

import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ActivityIndicator, 
  Platform,
  Alert,
  Image as RNImage,
  LayoutChangeEvent,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { BodyScanFigure } from "@/components/BodyScanFigure";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useBodyProfile, BodyScanResult, BodyShape } from "@/contexts/BodyProfileContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { getSettingsChildScreenOptions } from "@/navigation/screenOptions";
import { useTranslations } from "@/contexts/TranslationContext";

/**
 * Soft max so the silhouette stays large on tall phones without dominating short ones.
 * Actual size is measured from the flex area between header and bottom controls.
 */
const BODY_GUIDE_MAX_SIZE = 560;
/** SVG viewBox 120×305 — convert available width into a max figure height. */
const BODY_GUIDE_HEIGHT_PER_WIDTH = 305 / 120;
const CAPTURE_COUNTDOWN_SECONDS = 5;
/** Confidence below this → retake guidance + estimate framing. */
const LOW_CONFIDENCE_THRESHOLD = 60;
/** Confidence at or above this → success-style banner. */
const HIGH_CONFIDENCE_THRESHOLD = 80;

type ConfidenceBand = "low" | "medium" | "high";

function getConfidenceBand(confidence: number): ConfidenceBand {
  if (confidence < LOW_CONFIDENCE_THRESHOLD) return "low";
  if (confidence < HIGH_CONFIDENCE_THRESHOLD) return "medium";
  return "high";
}

type BodyScannerScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "BodyScanner">;
};

const BODY_SHAPE_INFO: Record<BodyShape, { icon: keyof typeof Feather.glyphMap; description: string }> = {
  hourglass: { icon: "target", description: "Balanced shoulders and hips with a defined waist" },
  pear: { icon: "triangle", description: "Hips wider than shoulders with a defined waist" },
  apple: { icon: "circle", description: "Fuller midsection with slimmer hips and legs" },
  rectangle: { icon: "square", description: "Balanced proportions with a subtle waist" },
  "inverted-triangle": { icon: "chevrons-up", description: "Broader shoulders tapering to narrower hips" },
  athletic: { icon: "activity", description: "Muscular build with strong shoulders and defined muscles" },
  petite: { icon: "minimize-2", description: "Smaller frame with balanced proportions" },
  "plus-size": { icon: "maximize-2", description: "Fuller figure with beautiful curves" },
  tall: { icon: "arrow-up", description: "Elongated proportions with longer limbs" },
  unknown: { icon: "help-circle", description: "Body shape not yet determined" },
};

const MEASUREMENT_LABELS: Record<string, string> = {
  neck: "Neck",
  shoulders: "Shoulders",
  bust: "Bust",
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  inseam: "Inseam",
  height: "Height",
  armLength: "Arm Length",
  torsoLength: "Torso Length",
};

export default function BodyScannerScreen({ navigation }: BodyScannerScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { bodyProfile, scanBody, isScanning, hasBodyProfile, saveBodyProfile } = useBodyProfile();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<BodyScanResult | null>(null);
  const [facing, setFacing] = useState<CameraType>("front");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [guideSize, setGuideSize] = useState(0);
  const cameraRef = useRef<CameraView>(null);

  const [manualMode, setManualMode] = useState(false);
  const [manualMeasurements, setManualMeasurements] = useState({
    height: "",
    bust: "",
    waist: "",
    hips: "",
  });

  const scanConfidence = bodyProfile?.scanData?.confidence;
  const confidenceBand =
    typeof scanConfidence === "number" ? getConfidenceBand(scanConfidence) : null;
  const isLowConfidence = confidenceBand === "low";
  const isMediumConfidence = confidenceBand === "medium";

  useLayoutEffect(() => {
    if (showCamera) {
      navigation.setOptions({ headerShown: false });
      return;
    }
    navigation.setOptions(
      getSettingsChildScreenOptions({
        theme,
        isDark,
        title: t('bodyScan.title'),
      }),
    );
  }, [navigation, theme, isDark, showCamera, t]);

  const closeCamera = useCallback(() => {
    setCountdown(null);
    setGuideSize(0);
    setShowCamera(false);
  }, []);

  const onBodyGuideLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // onLayout is the outer box; match bodyGuide padding so the figure fits
    // inside the safe area between header and instructions/controls.
    const availableH = Math.max(0, height - Spacing.lg * 2);
    const availableW = Math.max(0, width - Spacing.md * 2);
    const next = Math.min(
      availableH,
      availableW * BODY_GUIDE_HEIGHT_PER_WIDTH,
      BODY_GUIDE_MAX_SIZE,
    );
    setGuideSize((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
        setCountdown(null);
        setShowCamera(false);
        await processImage(photo.uri);
      }
    } catch (err) {
      console.error("Failed to take photo:", err);
      setCountdown(null);
      Alert.alert(t('common.error'), t('bodyScan.captureFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      handleTakePhoto();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, handleTakePhoto]);

  const startCountdown = () => {
    if (countdown !== null) return;
    setCountdown(CAPTURE_COUNTDOWN_SECONDS);
  };

  const handlePickImage = async () => {
    try {
      setCountdown(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setShowCamera(false);
        await processImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error("Failed to pick image:", err);
      Alert.alert(t('common.error'), t('bodyScan.failedToSelectImagePleaseTryAgain'));
    }
  };

  const compressForUpload = async (uri: string): Promise<string> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
      );
      return manipulated.uri;
    } catch (manipErr) {
      console.warn("Body scan image compress failed, using original:", manipErr);
      return uri;
    }
  };

  const processImage = async (uri: string) => {
    try {
      const uploadUri = await compressForUpload(uri);
      const base64 = await FileSystem.readAsStringAsync(uploadUri, {
        encoding: "base64",
      });

      const result = await scanBody(base64);
      setScanResult(result);

      if (result.success) {
        const band = getConfidenceBand(result.confidence);
        if (band === "low") {
          Alert.alert(
            t("bodyScan.lowConfidenceAlertTitle"),
            t("bodyScan.lowConfidenceAlertMessage").replace(
              "{confidence}",
              String(result.confidence)
            ),
            [
              {
                text: t("bodyScan.rescanRetake"),
                onPress: () => {
                  setCapturedImage(null);
                  setShowCamera(true);
                },
              },
              { text: t("common.viewResults"), style: "cancel" },
            ]
          );
        } else {
          Alert.alert(
            t("bodyScan.scanComplete"),
            t("bodyScan.scanCompleteMessage").replace(
              "{confidence}",
              String(result.confidence)
            ),
            [{ text: t("common.viewResults"), style: "default" }]
          );
        }
      } else {
        Alert.alert(
          t('bodyScan.scanIssue'),
          result.errorMessage || t('bodyScan.scanIssueDefault'),
          [
            { text: t('common.tryAgain'), onPress: () => setCapturedImage(null) },
            { text: t('common.enterManually'), onPress: () => setManualMode(true) },
          ]
        );
      }
    } catch (err) {
      console.error("Failed to process image:", err);
      Alert.alert(t('common.error'), t('bodyScan.failedToAnalyzeImagePleaseTryAgain'));
    }
  };

  const handleManualSave = async () => {
    const height = parseFloat(manualMeasurements.height);
    const bust = parseFloat(manualMeasurements.bust);
    const waist = parseFloat(manualMeasurements.waist);
    const hips = parseFloat(manualMeasurements.hips);

    let bodyShape: BodyShape = "rectangle";
    let heightCategory: "petite" | "average" | "tall" | "very-tall" = "average";
    let buildCategory: "slim" | "average" | "athletic" | "curvy" | "plus" = "average";

    if (height) {
      if (height < 63) heightCategory = "petite";
      else if (height >= 63 && height < 67) heightCategory = "average";
      else if (height >= 67 && height < 71) heightCategory = "tall";
      else heightCategory = "very-tall";
    }

    if (bust && waist && hips) {
      const waistToHip = waist / hips;
      const bustToHip = bust / hips;

      if (waistToHip < 0.75 && bustToHip >= 0.9 && bustToHip <= 1.1) {
        bodyShape = "hourglass";
      } else if (hips > bust * 1.05) {
        bodyShape = "pear";
      } else if (waist > hips * 0.85 && waist > bust * 0.85) {
        bodyShape = "apple";
      } else if (bust > hips * 1.05) {
        bodyShape = "inverted-triangle";
      } else {
        bodyShape = "rectangle";
      }

      if (waist < 28) buildCategory = "slim";
      else if (waist >= 28 && waist < 32) buildCategory = "average";
      else if (waist >= 32 && waist < 38) buildCategory = "curvy";
      else buildCategory = "plus";
    }

    await saveBodyProfile({
      measurements: {
        height: height || undefined,
        bust: bust || undefined,
        waist: waist || undefined,
        hips: hips || undefined,
      },
      bodyShape,
      heightCategory,
      buildCategory,
      isManualEntry: true,
    });

    setManualMode(false);
    Alert.alert(t('bodyScan.saved'), t('bodyScan.yourBodyProfileHasBeenSavedSuccessfully'));
  };

  const renderMeasurementRow = (key: string, value: number | undefined) => {
    if (!value) return null;
    return (
      <View key={key} style={styles.measurementRow}>
        <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
          {MEASUREMENT_LABELS[key] || key}
        </ThemedText>
        <ThemedText style={{ fontWeight: "600" }}>
          {value.toFixed(1)}"
        </ThemedText>
      </View>
    );
  };

  if (showCamera) {
    if (!permission) {
      return <ThemedView style={styles.centered}><ActivityIndicator /></ThemedView>;
    }

    if (!permission.granted) {
      return (
        <ThemedView style={styles.centered}>
          <Feather name="camera-off" size={64} color={theme.tabIconDefault} />
          <ThemedText type="h3" style={styles.permissionTitle}>Camera Access Required</ThemedText>
          <ThemedText style={[styles.permissionText, { color: theme.tabIconDefault }]}>
            We need camera access to scan your body proportions
          </ThemedText>
          {permission.status === "denied" && !permission.canAskAgain ? (
            Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (e) {}
                }}
                style={[styles.permissionButton, { backgroundColor: theme.link }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Open Settings</ThemedText>
              </Pressable>
            ) : null
          ) : (
            <Pressable
              onPress={requestPermission}
              style={[styles.permissionButton, { backgroundColor: theme.link }]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Enable Camera</ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setShowCamera(false)} style={styles.backButton}>
            <ThemedText style={{ color: theme.link }}>Go Back</ThemedText>
          </Pressable>
        </ThemedView>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <Pressable onPress={closeCamera} style={styles.cameraBackButton}>
                <Feather name="x" size={28} color="#FFFFFF" />
              </Pressable>
              <ThemedText style={styles.cameraTitle}>Body Scanner</ThemedText>
              <Pressable 
                onPress={() => setFacing(f => f === "front" ? "back" : "front")} 
                style={styles.cameraBackButton}
                disabled={countdown !== null}
              >
                <Feather name="refresh-cw" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View
              style={styles.bodyGuide}
              pointerEvents="none"
              onLayout={onBodyGuideLayout}
            >
              {guideSize > 0 ? (
                <BodyScanFigure variant="guide" size={guideSize} color="#FFFFFF" />
              ) : null}
            </View>

            {countdown !== null ? (
              <View style={styles.countdownOverlay} pointerEvents="none">
                <ThemedText style={styles.countdownText}>
                  {countdown > 0 ? countdown : ""}
                </ThemedText>
                {countdown > 0 ? (
                  <ThemedText style={styles.countdownHint}>Get into position</ThemedText>
                ) : null}
              </View>
            ) : null}

            <View style={styles.cameraInstructions}>
              <ThemedText style={styles.instructionText}>
                Step back until your whole body fits in the outline
              </ThemedText>
              <ThemedText style={styles.instructionText}>
                Stand in a well-lit area · arms slightly away from body
              </ThemedText>
            </View>

            <View style={styles.cameraControls}>
              <Pressable
                onPress={handlePickImage}
                style={styles.galleryButton}
                disabled={countdown !== null}
              >
                <Feather name="image" size={24} color="#FFFFFF" />
              </Pressable>
              
              <Pressable
                onPress={startCountdown}
                style={styles.captureButton}
                disabled={countdown !== null}
              >
                {countdown !== null ? (
                  <ThemedText style={styles.captureCountdownLabel}>
                    {countdown > 0 ? countdown : "…"}
                  </ThemedText>
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>
              
              <View style={styles.galleryButton} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  if (manualMode) {
    return (
      <ScreenScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerSection}>
          <Feather name="edit-3" size={48} color={theme.link} />
          <ThemedText type="h2" style={styles.title}>Enter Measurements</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            Enter your measurements in inches
          </ThemedText>
        </View>

        <Card style={styles.manualCard}>
          {["height", "bust", "waist", "hips"].map((field) => (
            <View key={field} style={styles.inputRow}>
              <ThemedText style={{ flex: 1 }}>{MEASUREMENT_LABELS[field]}</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <RNImage
                  source={{ uri: "" }}
                  style={{ display: "none" }}
                />
                <ThemedText style={styles.inputText}>
                  {manualMeasurements[field as keyof typeof manualMeasurements] || "—"}
                </ThemedText>
              </View>
            </View>
          ))}

          <View style={styles.keypadSection}>
            {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [".", "0", "⌫"]].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      const fields = ["height", "bust", "waist", "hips"];
                      const currentField = fields.find(f => 
                        !manualMeasurements[f as keyof typeof manualMeasurements] ||
                        manualMeasurements[f as keyof typeof manualMeasurements].length < 5
                      ) || "height";
                      
                      if (key === "⌫") {
                        setManualMeasurements(prev => ({
                          ...prev,
                          [currentField]: prev[currentField as keyof typeof prev].slice(0, -1),
                        }));
                      } else {
                        setManualMeasurements(prev => ({
                          ...prev,
                          [currentField]: prev[currentField as keyof typeof prev] + key,
                        }));
                      }
                    }}
                    style={({ pressed }) => [
                      styles.keypadButton,
                      { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <ThemedText type="h3">{key}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleManualSave}
            style={({ pressed }) => [styles.saveButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveGradient}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <ThemedText style={styles.saveText}>Save Profile</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setManualMode(false)} style={styles.cancelButton}>
            <ThemedText style={{ color: theme.tabIconDefault }}>Cancel</ThemedText>
          </Pressable>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="user" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          AI-assisted estimates of body proportions from a full-body photo — helpful for fit guidance, not a substitute for professional measuring.
        </ThemedText>
      </View>

      {isScanning ? (
        <Card style={styles.scanningCard}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="h3" style={styles.scanningTitle}>Analyzing Your Body</ThemedText>
          <ThemedText style={[styles.scanningText, { color: theme.tabIconDefault }]}>
            Our AI is measuring your proportions...
          </ThemedText>
          <View style={styles.scanningProgress}>
            {["Detecting body outline", "Measuring proportions", "Analyzing shape", "Generating profile"].map((step, index) => (
              <View key={step} style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: theme.link }]} />
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>{step}</ThemedText>
              </View>
            ))}
          </View>
        </Card>
      ) : hasBodyProfile && bodyProfile ? (
        <>
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={[styles.shapeIcon, { backgroundColor: theme.link + "20" }]}>
                <Feather 
                  name={BODY_SHAPE_INFO[bodyProfile.bodyShape]?.icon || "user"} 
                  size={28} 
                  color={theme.link} 
                />
              </View>
              <View style={styles.profileInfo}>
                <ThemedText type="h3">
                  {bodyProfile.bodyShape.charAt(0).toUpperCase() + bodyProfile.bodyShape.slice(1).replace("-", " ")}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                  {BODY_SHAPE_INFO[bodyProfile.bodyShape]?.description}
                </ThemedText>
              </View>
            </View>

            <View style={styles.categoryTags}>
              <View style={[styles.categoryTag, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="arrow-up" size={14} color={theme.text} />
                <ThemedText type="small">
                  {bodyProfile.heightCategory.charAt(0).toUpperCase() + bodyProfile.heightCategory.slice(1)}
                </ThemedText>
              </View>
              <View style={[styles.categoryTag, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="user" size={14} color={theme.text} />
                <ThemedText type="small">
                  {bodyProfile.buildCategory.charAt(0).toUpperCase() + bodyProfile.buildCategory.slice(1)} Build
                </ThemedText>
              </View>
            </View>

            {bodyProfile.scanData ? (() => {
              const confidence = bodyProfile.scanData!.confidence;
              const badgeColor = isLowConfidence
                ? theme.error
                : isMediumConfidence
                  ? theme.warning
                  : theme.success;
              const badgeIcon = isLowConfidence
                ? "alert-triangle"
                : isMediumConfidence
                  ? "alert-circle"
                  : "check-circle";
              const badgeLabel = isLowConfidence
                ? t("bodyScan.lowConfidenceBadge").replace("{confidence}", String(confidence))
                : t("bodyScan.aiScannedConfidence").replace("{confidence}", String(confidence));
              return (
                <View style={[styles.confidenceBadge, { backgroundColor: badgeColor + "20" }]}>
                  <Feather name={badgeIcon} size={16} color={badgeColor} />
                  <ThemedText type="small" style={{ color: badgeColor, flexShrink: 1, textAlign: "center" }}>
                    {badgeLabel}
                  </ThemedText>
                </View>
              );
            })() : (
              <View style={[styles.confidenceBadge, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="edit-3" size={16} color={theme.warning} />
                <ThemedText type="small" style={{ color: theme.warning }}>
                  {t("bodyScan.manuallyEntered")}
                </ThemedText>
              </View>
            )}
          </Card>

          {isLowConfidence ? (
            <Card style={[styles.guidanceCard, { borderColor: theme.error + "40" }]}>
              <View style={styles.guidanceHeader}>
                <Feather name="camera" size={18} color={theme.error} />
                <ThemedText style={{ fontWeight: "700", color: theme.error, flex: 1 }}>
                  {t("bodyScan.lowConfidenceTitle")}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.tabIconDefault, lineHeight: 20, marginBottom: Spacing.sm }}>
                {t("bodyScan.lowConfidenceMessage")}
              </ThemedText>
              <ThemedText type="small" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                {t("bodyScan.retakeGuidanceTitle")}
              </ThemedText>
              {[
                t("bodyScan.tipFullBody"),
                t("bodyScan.tipStandBack"),
                t("bodyScan.tipLighting"),
                t("bodyScan.tipPose"),
                t("bodyScan.tipClothes"),
              ].map((tip) => (
                <View key={tip} style={styles.guidanceTipRow}>
                  <Feather name="check" size={14} color={theme.link} />
                  <ThemedText type="small" style={{ flex: 1, color: theme.tabIconDefault, lineHeight: 18 }}>
                    {tip}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : isMediumConfidence ? (
            <Card style={styles.mediumTipCard}>
              <View style={styles.guidanceTipRow}>
                <Feather name="info" size={16} color={theme.warning} />
                <ThemedText type="small" style={{ flex: 1, color: theme.tabIconDefault, lineHeight: 18 }}>
                  {t("bodyScan.mediumConfidenceTip")}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          <Card style={styles.measurementsCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              {isLowConfidence
                ? t("bodyScan.measurementsEstimates")
                : t("bodyScan.yourMeasurements")}
            </ThemedText>
            {isLowConfidence ? (
              <ThemedText type="small" style={{ color: theme.warning, marginBottom: Spacing.sm, lineHeight: 18 }}>
                {t("bodyScan.measurementsLowConfidenceNote")}
              </ThemedText>
            ) : null}
            <View style={styles.measurementsGrid}>
              {Object.entries(bodyProfile.measurements).map(([key, value]) => 
                renderMeasurementRow(key, value)
              )}
            </View>
          </Card>

          {scanResult?.recommendations && scanResult.recommendations.length > 0 ? (
            <Card style={styles.recommendationsCard}>
              <ThemedText type="h4" style={styles.sectionTitle}>{t("bodyScan.styleRecommendations")}</ThemedText>
              {scanResult.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Feather name="check" size={16} color={theme.success} />
                  <ThemedText type="small" style={{ flex: 1 }}>{rec}</ThemedText>
                </View>
              ))}
            </Card>
          ) : null}

          <View style={styles.actionButtons}>
            <Pressable
              onPress={() => setShowCamera(true)}
              style={({ pressed }) => [styles.rescanButton, { opacity: pressed ? 0.8 : 1 }]}
            >
              <LinearGradient
                colors={isLowConfidence ? ["#C94C5A", "#8B2F39"] : ["#667eea", "#764ba2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rescanGradient}
              >
                <Feather
                  name={isLowConfidence ? "camera" : "refresh-cw"}
                  size={18}
                  color="#FFFFFF"
                />
                <ThemedText style={styles.rescanText}>
                  {isLowConfidence
                    ? t("bodyScan.rescanRetake")
                    : t("bodyScan.rescanBody")}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Card style={styles.introCard}>
            <View style={styles.featureList}>
              {[
                { icon: "cpu" as const, text: "GPT-5.2 Vision powered analysis" },
                { icon: "target" as const, text: "Precise body proportions" },
              ].map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.link + "20" }]}>
                    <Feather name={feature.icon} size={18} color={theme.link} />
                  </View>
                  <ThemedText>{feature.text}</ThemedText>
                </View>
              ))}
            </View>
          </Card>

          <Pressable
            onPress={() => setShowCamera(true)}
            style={({ pressed }) => [styles.scanButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scanGradient}
            >
              <Feather name="camera" size={24} color="#FFFFFF" />
              <ThemedText style={styles.scanButtonText}>Scan My Body</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            style={({ pressed }) => [
              styles.uploadButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="upload" size={20} color={theme.text} />
            <ThemedText style={{ fontWeight: "600" }}>Upload Photo Instead</ThemedText>
          </Pressable>

          <Card style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Feather name="lock" size={18} color={theme.link} />
              <ThemedText style={{ fontWeight: "600" }}>Your Privacy</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.tabIconDefault, lineHeight: 20 }}>
              Your body scan photos are processed securely and never stored on our servers. 
              Only your measurements are saved locally on your device. Estimates may vary — use manual entry if you need exact sizing for tailoring.
            </ThemedText>
          </Card>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  introCard: {
    padding: Spacing.lg,
  },
  featureList: {
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButton: {
    width: "100%",
  },
  scanGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  privacyCard: {
    padding: Spacing.md,
  },
  privacyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
  },
  cameraBackButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  bodyGuide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    overflow: "hidden",
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  countdownText: {
    color: "#FFFFFF",
    fontSize: 96,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  countdownHint: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.sm,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  cameraInstructions: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  instructionText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  captureCountdownLabel: {
    color: "#333",
    fontSize: 28,
    fontWeight: "700",
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 120,
    paddingTop: Spacing.xl,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  captureInner: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: "#333",
  },
  scanningCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  scanningTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scanningText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  scanningProgress: {
    gap: Spacing.sm,
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profileCard: {
    padding: Spacing.lg,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  shapeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  categoryTags: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  guidanceCard: {
    padding: Spacing.lg,
    borderWidth: 1,
  },
  guidanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  guidanceTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  mediumTipCard: {
    padding: Spacing.md,
  },
  measurementsCard: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  measurementsGrid: {
    gap: Spacing.sm,
  },
  measurementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  recommendationsCard: {
    padding: Spacing.lg,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionButtons: {
    gap: Spacing.md,
  },
  rescanButton: {
    width: "100%",
  },
  rescanGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  rescanText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  manualCard: {
    padding: Spacing.lg,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  inputContainer: {
    width: 80,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  inputText: {
    fontSize: 18,
    fontWeight: "600",
  },
  keypadSection: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  keypadButton: {
    width: 70,
    height: 50,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  permissionTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  permissionText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.sm,
  },
  premiumCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  premiumIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(102, 126, 234, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  premiumTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  premiumDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    width: "100%",
  },
  upgradeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
