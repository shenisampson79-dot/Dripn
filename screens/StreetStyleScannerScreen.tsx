/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useRef } from "react";
import { StyleSheet, View, Pressable, Image, ActivityIndicator, Platform, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import apiService from "@/services/ApiService";
import * as FileSystem from 'expo-file-system/legacy';
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type StreetStyleScannerScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "StreetStyleScanner">;
};

interface OutfitAnalysis {
  id: string;
  imageUri: string;
  overallStyle: string;
  confidence: number;
  items: {
    name: string;
    category: string;
    color: string;
    estimatedPrice: string;
    whereToBuy: string[];
  }[];
  colorPalette: string[];
  styleNotes: string;
  occasions: string[];
  analyzedAt: Date;
}

export default function StreetStyleScannerScreen({ navigation }: StreetStyleScannerScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(null);
  const [scanHistory, setScanHistory] = useState<OutfitAnalysis[]>([]);
  
  const cameraRef = useRef<CameraView>(null);

  const isPremium = tier !== "free";

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo) {
          setCapturedImage(photo.uri);
          setShowCamera(false);
          await analyzeImage(photo.uri);
        }
      } catch (error: any) {
        Alert.alert('Photo Error', error?.message || 'Failed to capture photo. Please try again.');
      }
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      await analyzeImage(result.assets[0].uri);
    }
  };

  const analyzeImage = async (imageUri: string) => {
    setIsAnalyzing(true);
    
    try {
      let imageBase64: string | undefined;
      
      if (imageUri.startsWith('file://') || imageUri.startsWith('/')) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });
        imageBase64 = `data:image/jpeg;base64,${base64}`;
      }

      const response = await apiService.streetStyleScan({
        imageBase64,
        imageUrl: imageBase64 ? undefined : imageUri,
      });

      if (response.success && response.analysis) {
        const newAnalysis: OutfitAnalysis = {
          id: Date.now().toString(),
          imageUri,
          overallStyle: response.analysis.overallStyle,
          confidence: response.analysis.confidence,
          items: response.analysis.items,
          colorPalette: response.analysis.colorPalette,
          styleNotes: response.analysis.styleNotes,
          occasions: response.analysis.occasions,
          analyzedAt: new Date(),
        };

        setAnalysis(newAnalysis);
        setScanHistory(prev => [newAnalysis, ...prev.slice(0, 4)]);
      } else {
        Alert.alert('Analysis Failed', 'Could not analyze the image. Please try again.');
      }
    } catch (error: any) {
      console.error('Street style scan error:', error);
      Alert.alert('Error', error.message || 'Failed to analyze the outfit. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setCapturedImage(null);
    setAnalysis(null);
  };

  const renderAnalysisResult = () => {
    if (!analysis) return null;

    return (
      <View style={styles.analysisContainer}>
        <View style={styles.analysisHeader}>
          <Image source={{ uri: analysis.imageUri }} style={styles.analyzedImage} />
          <View style={styles.analysisOverview}>
            <View style={styles.styleLabel}>
              <ThemedText type="h3">{analysis.overallStyle}</ThemedText>
              <View style={[styles.confidenceBadge, { backgroundColor: theme.success + "20" }]}>
                <ThemedText type="caption" style={{ color: theme.success, fontWeight: "600" }}>
                  {analysis.confidence}% match
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.styleNotes, { color: theme.tabIconDefault }]}>
              {analysis.styleNotes}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.colorPaletteCard}>
          <ThemedText type="h4" style={styles.sectionLabel}>Color Palette</ThemedText>
          <View style={styles.colorSwatches}>
            {analysis.colorPalette.map((color, index) => (
              <View key={index} style={[styles.colorSwatch, { backgroundColor: color }]} />
            ))}
          </View>
        </Card>

        <View style={styles.itemsSection}>
          <ThemedText type="h4" style={styles.sectionLabel}>Identified Items</ThemedText>
          {analysis.items.map((item, index) => (
            <Card key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={[styles.itemIcon, { backgroundColor: theme.link + "20" }]}>
                  <Feather 
                    name={
                      item.category === "Outerwear" ? "umbrella" :
                      item.category === "Tops" ? "layers" :
                      item.category === "Bottoms" ? "maximize-2" :
                      item.category === "Shoes" ? "box" : "tag"
                    } 
                    size={18} 
                    color={theme.link} 
                  />
                </View>
                <View style={styles.itemInfo}>
                  <ThemedText type="h4">{item.name}</ThemedText>
                  <View style={styles.itemMeta}>
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {item.category}
                    </ThemedText>
                    <View style={[styles.colorDot, { backgroundColor: item.color === "White" ? "#F5F5F5" : item.color === "Navy Blue" ? "#1E3A5F" : item.color === "Beige" ? "#D4C4A8" : "#8B4513" }]} />
                    <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                      {item.color}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                  {item.estimatedPrice}
                </ThemedText>
              </View>
              
              <View style={styles.whereToBuy}>
                <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>Shop at:</ThemedText>
                <View style={styles.storesList}>
                  {item.whereToBuy.map((store, storeIndex) => (
                    <Pressable
                      key={storeIndex}
                      style={[styles.storeChip, { backgroundColor: theme.backgroundSecondary }]}
                    >
                      <ThemedText type="caption">{store}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Card style={styles.occasionsCard}>
          <ThemedText type="h4" style={styles.sectionLabel}>Perfect For</ThemedText>
          <View style={styles.occasionsList}>
            {analysis.occasions.map((occasion, index) => (
              <View key={index} style={[styles.occasionChip, { backgroundColor: theme.link + "15" }]}>
                <Feather name="check-circle" size={12} color={theme.link} />
                <ThemedText type="small" style={{ color: theme.link }}>{occasion}</ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="camera" size={18} color={theme.text} />
            <ThemedText style={{ fontWeight: "600" }}>Scan Another</ThemedText>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bookmark" size={18} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Save Look</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  if (showCamera) {
    if (!permission) {
      return <View />;
    }

    if (!permission.granted) {
      return (
        <ScreenScrollView contentContainerStyle={styles.container}>
          <Card style={styles.permissionCard}>
            <Feather name="camera-off" size={48} color={theme.error} />
            <ThemedText type="h3" style={styles.permissionTitle}>
              Camera Access Required
            </ThemedText>
            <ThemedText style={[styles.permissionDescription, { color: theme.tabIconDefault }]}>
              To scan outfits, please grant camera access
            </ThemedText>
            {(Platform.OS as string) !== "web" ? (
              <Pressable
                onPress={requestPermission}
                style={({ pressed }) => [
                  styles.permissionButton,
                  { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Grant Permission
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText style={[styles.webNote, { color: theme.warning }]}>
                Run in Expo Go to use camera features
              </ThemedText>
            )}
            <Pressable
              onPress={() => setShowCamera(false)}
              style={({ pressed }) => [
                styles.cancelButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={{ color: theme.link }}>Cancel</ThemedText>
            </Pressable>
          </Card>
        </ScreenScrollView>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <Pressable
                onPress={() => setShowCamera(false)}
                style={[styles.closeButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
              >
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            
            <View style={styles.scanFrame}>
              <View style={[styles.cornerTL, styles.corner]} />
              <View style={[styles.cornerTR, styles.corner]} />
              <View style={[styles.cornerBL, styles.corner]} />
              <View style={[styles.cornerBR, styles.corner]} />
            </View>
            
            <ThemedText style={styles.scanHint}>
              Position the outfit in frame
            </ThemedText>
            
            <View style={styles.cameraControls}>
              <Pressable
                onPress={handlePickImage}
                style={[styles.galleryButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              >
                <Feather name="image" size={24} color="#FFFFFF" />
              </Pressable>
              
              <Pressable
                onPress={handleTakePhoto}
                style={styles.captureButton}
              >
                <View style={styles.captureButtonInner} />
              </Pressable>
              
              <View style={styles.galleryButton} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#00B894", "#00D9A5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="aperture" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Street Style Scanner</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Snap any outfit and let AI identify each piece with shopping links
        </ThemedText>
      </View>

      {!isPremium ? (
        <Card style={styles.premiumCard}>
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBadge}
          >
            <Feather name="star" size={16} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h3" style={styles.premiumTitle}>
            Premium Feature
          </ThemedText>
          <ThemedText style={[styles.premiumDescription, { color: theme.tabIconDefault }]}>
            Upgrade to Premium or VIP for unlimited outfit scanning with GPT-4 Vision
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.upgradeButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeButtonGradient}
            >
              <ThemedText style={styles.upgradeButtonText}>Upgrade Now</ThemedText>
            </LinearGradient>
          </Pressable>
        </Card>
      ) : analysis ? (
        renderAnalysisResult()
      ) : (
        <>
          <Card style={styles.scanCard}>
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={theme.link} />
                <ThemedText type="h4" style={styles.analyzingText}>
                  Analyzing outfit with AI...
                </ThemedText>
                <ThemedText style={[styles.analyzingHint, { color: theme.tabIconDefault }]}>
                  Identifying items, colors, and styling details
                </ThemedText>
              </View>
            ) : capturedImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              </View>
            ) : (
              <View style={styles.scanOptions}>
                <Pressable
                  onPress={() => setShowCamera(true)}
                  style={({ pressed }) => [styles.scanOption, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <LinearGradient
                    colors={["#00B894", "#00D9A5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.scanOptionIcon}
                  >
                    <Feather name="camera" size={32} color="#FFFFFF" />
                  </LinearGradient>
                  <ThemedText type="h4">Take Photo</ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: "center" }}>
                    Capture an outfit in real-time
                  </ThemedText>
                </Pressable>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <Pressable
                  onPress={handlePickImage}
                  style={({ pressed }) => [styles.scanOption, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.scanOptionIcon, { backgroundColor: theme.link }]}>
                    <Feather name="image" size={32} color="#FFFFFF" />
                  </View>
                  <ThemedText type="h4">Choose Photo</ThemedText>
                  <ThemedText type="small" style={{ color: theme.tabIconDefault, textAlign: "center" }}>
                    Select from your gallery
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </Card>

          {scanHistory.length > 0 ? (
            <View style={styles.historySection}>
              <ThemedText type="h4" style={styles.sectionLabel}>Recent Scans</ThemedText>
              <View style={styles.historyGrid}>
                {scanHistory.slice(0, 4).map((scan) => (
                  <Pressable
                    key={scan.id}
                    onPress={() => setAnalysis(scan)}
                    style={({ pressed }) => [
                      styles.historyItem,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Image source={{ uri: scan.imageUri }} style={styles.historyImage} />
                    <View style={[styles.historyOverlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                      <ThemedText type="caption" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                        {scan.overallStyle}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Card style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Feather name="info" size={18} color={theme.info} />
              <ThemedText type="h4">Scanning Tips</ThemedText>
            </View>
            <View style={styles.tipsList}>
              {[
                "Ensure good lighting for accurate color detection",
                "Include the full outfit in the frame",
                "Works best with clear, uncluttered backgrounds",
                "Multiple items can be identified in one scan",
              ].map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <Feather name="check" size={14} color={theme.success} />
                  <ThemedText type="small" style={{ flex: 1, lineHeight: 20 }}>{tip}</ThemedText>
                </View>
              ))}
            </View>
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
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  premiumCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  premiumBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  premiumTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  premiumDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    width: "100%",
  },
  upgradeButtonGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  scanCard: {
    padding: Spacing.xl,
  },
  scanOptions: {
    flexDirection: "row",
    alignItems: "center",
  },
  scanOption: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.sm,
  },
  scanOptionIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  divider: {
    width: 1,
    height: 120,
    marginHorizontal: Spacing.lg,
  },
  analyzingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  analyzingText: {
    marginTop: Spacing.md,
  },
  analyzingHint: {
    textAlign: "center",
  },
  previewContainer: {
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: BorderRadius.md,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 280,
    height: 360,
    alignSelf: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanHint: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  permissionCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  permissionTitle: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  permissionDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  webNote: {
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
  },
  analysisContainer: {
    gap: Spacing.md,
  },
  analysisHeader: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  analyzedImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
  },
  analysisOverview: {
    flex: 1,
  },
  styleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginBottom: Spacing.sm,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  styleNotes: {
    lineHeight: 20,
  },
  colorPaletteCard: {
    padding: Spacing.md,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
  },
  colorSwatches: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  itemsSection: {
    gap: Spacing.sm,
  },
  itemCard: {
    padding: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  whereToBuy: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  storesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  storeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  occasionsCard: {
    padding: Spacing.md,
  },
  occasionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  occasionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  historySection: {
    gap: Spacing.sm,
  },
  historyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  historyItem: {
    width: "48%",
    aspectRatio: 0.75,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  historyImage: {
    width: "100%",
    height: "100%",
  },
  historyOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  tipsCard: {
    padding: Spacing.lg,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tipsList: {
    gap: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
});
