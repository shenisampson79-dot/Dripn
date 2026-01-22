import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiService } from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2) / 3;

type DFYUploadScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "DFYUpload">;
  route: RouteProp<AuthStackParamList, "DFYUpload">;
};

interface UploadedImage {
  id: string;
  uri: string;
}

export default function DFYUploadScreen({ navigation, route }: DFYUploadScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const uploadType = route.params?.type || "core";
  const maxItems = uploadType === "outfit" ? 7 : 30;
  const minItems = uploadType === "outfit" ? 3 : 5;

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(
          "Permission Required",
          "Photo library access was denied. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => import("react-native").then(({ Linking }) => Linking.openSettings()) },
          ]
        );
      } else {
        Alert.alert("Permission Required", "Please allow access to your photo library.");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxItems - images.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newImages = result.assets.map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, maxItems));
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "web") return;

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newImage = {
        id: `${Date.now()}`,
        uri: result.assets[0].uri,
      };
      setImages((prev) => [...prev, newImage].slice(0, maxItems));
    }
  };

  const handleRemoveImage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = async () => {
    if (images.length < minItems) {
      Alert.alert(
        "More photos needed",
        `Please upload at least ${minItems} ${uploadType === "outfit" ? "outfit photos" : "items"} to continue.`
      );
      return;
    }

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiService.post("/api/dfy/upload", {
        type: uploadType,
        imageCount: images.length,
        images: images.map((img) => img.uri),
      });
      
      navigation.navigate("Confirmation", { type: uploadType });
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "There was an error uploading your photos. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = images.length >= minItems;

  const renderImageItem = ({ item }: { item: UploadedImage }) => (
    <View style={styles.imageItem}>
      <Image source={{ uri: item.uri }} style={styles.uploadedImage} contentFit="cover" />
      <Pressable
        onPress={() => handleRemoveImage(item.id)}
        style={[styles.removeButton, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="x" size={16} color={theme.text} />
      </Pressable>
    </View>
  );

  const renderAddButton = () => (
    <Pressable
      onPress={handlePickImages}
      style={[styles.addImageButton, { backgroundColor: theme.backgroundSecondary }]}
    >
      <Feather name="plus" size={28} color={theme.tabIconDefault} />
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        Add
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={{ color: theme.text }}>
          Upload {uploadType === "outfit" ? "Outfits" : "Items"}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={[styles.progressCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.progressRow}>
            <ThemedText type="body" style={{ color: theme.text }}>
              {images.length} / {maxItems} uploaded
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              Min: {minItems}
            </ThemedText>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.backgroundDefault }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: canSubmit ? "#10B981" : theme.link,
                  width: `${(images.length / maxItems) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handlePickImages}
            style={[styles.actionButton, { backgroundColor: theme.link }]}
          >
            <Feather name="image" size={20} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF" }}>Gallery</ThemedText>
          </Pressable>
          {Platform.OS !== "web" && (
            <Pressable
              onPress={handleTakePhoto}
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="camera" size={20} color={theme.text} />
              <ThemedText type="body" style={{ color: theme.text }}>Camera</ThemedText>
            </Pressable>
          )}
        </View>

        {images.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="upload-cloud" size={48} color={theme.tabIconDefault} />
            </View>
            <ThemedText type="h3" style={[styles.emptyTitle, { color: theme.text }]}>
              Upload your {uploadType === "outfit" ? "outfits" : "wardrobe items"}
            </ThemedText>
            <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
              {uploadType === "outfit"
                ? "Add 3-7 photos of your favorite complete outfits"
                : "Add up to 30 individual clothing items and accessories"}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={[...images, { id: "add", uri: "" }]}
            renderItem={({ item }) =>
              item.id === "add" && images.length < maxItems ? renderAddButton() : item.id !== "add" ? renderImageItem({ item }) : null
            }
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.imageGrid}
            columnWrapperStyle={styles.imageRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundDefault }]}>
        <Button
          onPress={handleSubmit}
          disabled={!canSubmit || isUploading}
          style={[
            styles.submitButton,
            { backgroundColor: canSubmit ? theme.link : theme.backgroundSecondary },
          ]}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            `Submit ${images.length} ${images.length === 1 ? "photo" : "photos"}`
          )}
        </Button>
        {!canSubmit && images.length > 0 && (
          <ThemedText type="caption" style={[styles.helperText, { color: theme.tabIconDefault }]}>
            Add {minItems - images.length} more to continue
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  progressCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  imageGrid: {
    paddingBottom: Spacing.xl,
  },
  imageRow: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  imageItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButton: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  submitButton: {
    width: "100%",
  },
  helperText: {
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
