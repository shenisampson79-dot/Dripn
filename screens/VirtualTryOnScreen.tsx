/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Pressable, 
  Image, 
  Dimensions, 
  Platform,
  ActivityIndicator,
  FlatList,
  ScrollView
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  runOnJS
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type VirtualTryOnScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "VirtualTryOn">;
};

interface OverlayItem {
  item: WardrobeItem;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const TRYABLE_CATEGORIES: ClothingCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "accessories",
  "bags",
];

const CATEGORY_ICONS: Record<ClothingCategory, string> = {
  tops: "align-center",
  bottoms: "minus",
  dresses: "align-justify",
  outerwear: "layers",
  shoes: "anchor",
  bags: "shopping-bag",
  accessories: "watch",
  activewear: "activity",
  swimwear: "droplet",
  sleepwear: "moon",
  formal: "star",
};

export default function VirtualTryOnScreen({ navigation }: VirtualTryOnScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory>("tops");
  const [overlayItems, setOverlayItems] = useState<OverlayItem[]>([]);
  const [selectedOverlayIndex, setSelectedOverlayIndex] = useState<number | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(true);

  const ownedItems = useMemo(() => {
    return items.filter(item => 
      (!item.origin || item.origin === "owned") && 
      TRYABLE_CATEGORIES.includes(item.category)
    );
  }, [items]);

  const categoryItems = useMemo(() => {
    return ownedItems.filter(item => item.category === selectedCategory);
  }, [ownedItems, selectedCategory]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleFlipCamera = () => {
    setFacing((current: CameraType) => (current === "back" ? "front" : "back"));
  };

  const handleAddItem = (item: WardrobeItem) => {
    const newOverlay: OverlayItem = {
      item,
      x: SCREEN_WIDTH / 2 - 75,
      y: SCREEN_HEIGHT / 2 - 100,
      scale: 1,
      rotation: 0,
    };
    setOverlayItems(prev => [...prev, newOverlay]);
    setSelectedOverlayIndex(overlayItems.length);
    setShowItemPicker(false);
  };

  const handleRemoveItem = (index: number) => {
    setOverlayItems(prev => prev.filter((_, i) => i !== index));
    setSelectedOverlayIndex(null);
  };

  const handleClearAll = () => {
    setOverlayItems([]);
    setSelectedOverlayIndex(null);
  };

  const updateOverlayPosition = (index: number, x: number, y: number) => {
    setOverlayItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, x, y } : item
      )
    );
  };

  const updateOverlayScale = (index: number, scale: number) => {
    setOverlayItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, scale: Math.max(0.3, Math.min(3, scale)) } : item
      )
    );
  };

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={styles.loadingText}>
            Loading camera...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <ThemedView style={styles.container}>
          <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
            <Pressable onPress={handleBack} style={styles.backButtonAbsolute}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <Feather name="camera-off" size={64} color={theme.tabIconDefault} />
            <ThemedText type="h2" style={styles.permissionTitle}>
              Camera Access Required
            </ThemedText>
            <ThemedText type="body" style={styles.permissionText}>
              Virtual Try-On needs camera access to show how items look on you. Please enable camera access in your device settings.
            </ThemedText>
            {Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.log("Could not open settings");
                  }
                }}
                style={({ pressed }) => [
                  styles.permissionButton,
                  { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Feather name="settings" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={styles.permissionButtonText}>
                  Open Settings
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.container}>
        <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
          <Pressable onPress={handleBack} style={styles.backButtonAbsolute}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Feather name="camera" size={64} color={theme.link} />
          <ThemedText type="h2" style={styles.permissionTitle}>
            Virtual Try-On
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            See how your wardrobe items look on you in real-time. Grant camera access to get started.
          </ThemedText>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Feather name="camera" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={styles.permissionButtonText}>
              Enable Camera
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
          <Pressable onPress={handleBack} style={styles.backButtonAbsolute}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Feather name="smartphone" size={64} color={theme.link} />
          <ThemedText type="h2" style={styles.permissionTitle}>
            Use Expo Go
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            Virtual Try-On works best on your mobile device. Scan the QR code to open in Expo Go for the full experience.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
        >
          {overlayItems.map((overlay, index) => (
            <DraggableOverlay
              key={`${overlay.item.id}-${index}`}
              overlay={overlay}
              index={index}
              isSelected={selectedOverlayIndex === index}
              onSelect={() => setSelectedOverlayIndex(index)}
              onPositionChange={(x, y) => updateOverlayPosition(index, x, y)}
              onScaleChange={(scale) => updateOverlayScale(index, scale)}
              onRemove={() => handleRemoveItem(index)}
              theme={theme}
            />
          ))}
        </CameraView>

        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: "rgba(0,0,0,0.5)", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>

          <ThemedText type="h3" style={styles.headerTitle}>
            Virtual Try-On
          </ThemedText>

          <Pressable
            onPress={handleFlipCamera}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: "rgba(0,0,0,0.5)", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {overlayItems.length > 0 ? (
          <View style={styles.overlayControls}>
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => [
                styles.clearButton,
                { backgroundColor: "rgba(0,0,0,0.6)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="trash-2" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={styles.clearButtonText}>
                Clear All
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + Spacing.md }]}>
          {showItemPicker ? (
            <>
              <View style={styles.categoryTabs}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryTabsContent}
                >
                  {TRYABLE_CATEGORIES.map((category) => {
                    const count = ownedItems.filter(i => i.category === category).length;
                    const isSelected = selectedCategory === category;
                    return (
                      <Pressable
                        key={category}
                        onPress={() => setSelectedCategory(category)}
                        style={({ pressed }) => [
                          styles.categoryTab,
                          {
                            backgroundColor: isSelected 
                              ? theme.link 
                              : "rgba(255,255,255,0.2)",
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Feather 
                          name={CATEGORY_ICONS[category] as any} 
                          size={16} 
                          color={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.9)"} 
                        />
                        <ThemedText 
                          type="small" 
                          style={[
                            styles.categoryTabText,
                            { color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.9)" }
                          ]}
                        >
                          {CATEGORY_LABELS[category].split(" ")[0]} ({count})
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {categoryItems.length > 0 ? (
                <FlatList
                  horizontal
                  data={categoryItems}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.itemList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleAddItem(item)}
                      style={({ pressed }) => [
                        styles.itemCard,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />
                      <View style={styles.itemInfo}>
                        <ThemedText type="small" style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                      </View>
                      <View style={[styles.addBadge, { backgroundColor: theme.link }]}>
                        <Feather name="plus" size={14} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  )}
                />
              ) : (
                <View style={styles.emptyItems}>
                  <ThemedText type="body" style={styles.emptyItemsText}>
                    No {CATEGORY_LABELS[selectedCategory].toLowerCase()} in your wardrobe
                  </ThemedText>
                </View>
              )}
            </>
          ) : (
            <Pressable
              onPress={() => setShowItemPicker(true)}
              style={({ pressed }) => [
                styles.showPickerButton,
                { backgroundColor: "rgba(0,0,0,0.6)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.showPickerButtonText}>
                Add More Items
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

interface DraggableOverlayProps {
  overlay: OverlayItem;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange: (x: number, y: number) => void;
  onScaleChange: (scale: number) => void;
  onRemove: () => void;
  theme: any;
}

function DraggableOverlay({
  overlay,
  index,
  isSelected,
  onSelect,
  onPositionChange,
  onScaleChange,
  onRemove,
  theme,
}: DraggableOverlayProps) {
  const translateX = useSharedValue(overlay.x);
  const translateY = useSharedValue(overlay.y);
  const scale = useSharedValue(overlay.scale);
  const savedTranslateX = useSharedValue(overlay.x);
  const savedTranslateY = useSharedValue(overlay.y);
  const savedScale = useSharedValue(overlay.scale);
  const isGestureActive = useSharedValue(false);

  useEffect(() => {
    if (!isGestureActive.value) {
      translateX.value = overlay.x;
      translateY.value = overlay.y;
      scale.value = overlay.scale;
      savedTranslateX.value = overlay.x;
      savedTranslateY.value = overlay.y;
      savedScale.value = overlay.scale;
    }
  }, [overlay.x, overlay.y, overlay.scale]);

  const updatePosition = (x: number, y: number) => {
    onPositionChange(x, y);
  };

  const updateScale = (s: number) => {
    onScaleChange(s);
  };

  const selectOverlay = () => {
    onSelect();
  };

  const setGestureActive = (active: boolean) => {
    isGestureActive.value = active;
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isGestureActive.value = true;
      runOnJS(selectOverlay)();
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      isGestureActive.value = false;
      runOnJS(updatePosition)(translateX.value, translateY.value);
    })
    .onFinalize(() => {
      isGestureActive.value = false;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      isGestureActive.value = true;
      runOnJS(selectOverlay)();
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      isGestureActive.value = false;
      const clampedScale = Math.max(0.3, Math.min(3, scale.value));
      scale.value = withSpring(clampedScale);
      runOnJS(updateScale)(clampedScale);
    })
    .onFinalize(() => {
      isGestureActive.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(selectOverlay)();
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(panGesture, pinchGesture),
    tapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.overlayItem, animatedStyle]}>
        <Image
          source={{ uri: overlay.item.imageUri }}
          style={styles.overlayImage}
          resizeMode="contain"
        />
        {isSelected ? (
          <View style={styles.overlaySelectedBorder}>
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => [
                styles.removeButton,
                { backgroundColor: theme.error || "#DC2626", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="x" size={14} color="#FFFFFF" />
            </Pressable>
            <View style={[styles.scaleHint, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <ThemedText type="caption" style={styles.scaleHintText}>
                Pinch to resize
              </ThemedText>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    opacity: 0.7,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  backButtonAbsolute: {
    position: "absolute",
    top: 60,
    left: Spacing.lg,
    padding: Spacing.sm,
  },
  permissionTitle: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  permissionText: {
    textAlign: "center",
    opacity: 0.7,
    maxWidth: 300,
    lineHeight: 22,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayControls: {
    position: "absolute",
    top: 110,
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  clearButtonText: {
    color: "#FFFFFF",
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingTop: Spacing.md,
  },
  categoryTabs: {
    marginBottom: Spacing.sm,
  },
  categoryTabsContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  categoryTabText: {
    fontWeight: "500",
  },
  itemList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  itemCard: {
    width: 100,
    height: 130,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: Spacing.sm,
  },
  itemImage: {
    width: "100%",
    height: 90,
  },
  itemInfo: {
    padding: Spacing.xs,
  },
  itemName: {
    color: "#FFFFFF",
    fontSize: 11,
  },
  addBadge: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyItems: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyItemsText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  showPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  showPickerButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  overlayItem: {
    position: "absolute",
    width: 150,
    height: 200,
  },
  overlayImage: {
    width: "100%",
    height: "100%",
  },
  overlaySelectedBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: BorderRadius.sm,
    borderStyle: "dashed",
  },
  removeButton: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleHint: {
    position: "absolute",
    bottom: -24,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  scaleHintText: {
    color: "#FFFFFF",
    fontSize: 10,
  },
});
