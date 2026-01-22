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
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
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

const CATEGORIES = ["tops", "bottoms", "outerwear", "dresses", "shoes", "accessories"] as const;
type Category = typeof CATEGORIES[number];

interface AnalyzedItem {
  category: Category;
  subcategory: string;
  color: { primary: string; secondary: string | null };
  pattern: string;
  material: string;
  brand: string | null;
  season: string[];
  occasions: string[];
  style: string;
  formality: number;
  versatilityScore: number;
}

interface UploadedImage {
  id: string;
  uri: string;
  status: "pending" | "analyzing" | "analyzed" | "saved" | "error";
  analysis?: AnalyzedItem;
  name?: string;
}

export default function DFYUploadScreen({ navigation, route }: DFYUploadScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const uploadType = route.params?.type || "core";
  const maxItems = uploadType === "outfit" ? 7 : 30;
  const minItems = uploadType === "outfit" ? 3 : 5;

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<UploadedImage | null>(null);
  const [processingCount, setProcessingCount] = useState(0);

  const convertToBase64 = async (uri: string): Promise<string> => {
    try {
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            resolve(base64.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      return base64;
    } catch (error) {
      console.error("Error converting to base64:", error);
      throw error;
    }
  };

  const analyzeImage = async (image: UploadedImage) => {
    setImages((prev) =>
      prev.map((img) => (img.id === image.id ? { ...img, status: "analyzing" } : img))
    );
    setProcessingCount((c) => c + 1);

    try {
      const base64 = await convertToBase64(image.uri);
      const response = await apiService.post<{ item: AnalyzedItem }>("/api/wardrobe/analyze", {
        imageBase64: base64,
      });

      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? {
                ...img,
                status: "analyzed",
                analysis: response.item,
                name: `${response.item.color.primary} ${response.item.subcategory}`,
              }
            : img
        )
      );
    } catch (error) {
      console.error("Analysis error:", error);
      setImages((prev) =>
        prev.map((img) => (img.id === image.id ? { ...img, status: "error" } : img))
      );
    } finally {
      setProcessingCount((c) => c - 1);
    }
  };

  const handlePickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(
          "Permission Required",
          "Photo library access was denied. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () =>
                import("react-native").then(({ Linking }) => Linking.openSettings()),
            },
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
      const newImages: UploadedImage[] = result.assets.map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
        status: "pending",
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, maxItems));
      newImages.forEach((img) => analyzeImage(img));
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
      const newImage: UploadedImage = {
        id: `${Date.now()}`,
        uri: result.assets[0].uri,
        status: "pending",
      };
      setImages((prev) => [...prev, newImage].slice(0, maxItems));
      analyzeImage(newImage);
    }
  };

  const handleRemoveImage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleRetry = (image: UploadedImage) => {
    analyzeImage(image);
  };

  const handleEditItem = (image: UploadedImage) => {
    setEditingItem(image);
  };

  const handleSaveEdit = (updatedAnalysis: AnalyzedItem, updatedName: string) => {
    if (!editingItem) return;
    setImages((prev) =>
      prev.map((img) =>
        img.id === editingItem.id ? { ...img, analysis: updatedAnalysis, name: updatedName } : img
      )
    );
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    const analyzedImages = images.filter((img) => img.status === "analyzed" && img.analysis);
    if (analyzedImages.length < minItems) {
      Alert.alert(
        "More items needed",
        `Please upload at least ${minItems} ${uploadType === "outfit" ? "outfit photos" : "items"} to continue.`
      );
      return;
    }

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      for (const image of analyzedImages) {
        if (!image.analysis) continue;
        const base64 = await convertToBase64(image.uri);
        await apiService.post("/api/wardrobe", {
          name: image.name || `${image.analysis.color.primary} ${image.analysis.subcategory}`,
          category: image.analysis.category,
          subcategory: image.analysis.subcategory,
          imageBase64: base64,
          color: image.analysis.color.primary,
          season: image.analysis.season,
          occasions: image.analysis.occasions,
          brand: image.analysis.brand,
          itemType: "owned",
        });
        setImages((prev) =>
          prev.map((img) => (img.id === image.id ? { ...img, status: "saved" } : img))
        );
      }
      navigation.navigate("Confirmation", { type: uploadType });
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", "There was an error saving your items. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const analyzedCount = images.filter((img) => img.status === "analyzed" || img.status === "saved").length;
  const canSubmit = analyzedCount >= minItems && processingCount === 0;

  const getStatusIcon = (status: UploadedImage["status"]) => {
    switch (status) {
      case "analyzing":
        return <ActivityIndicator size="small" color="#FFFFFF" />;
      case "analyzed":
        return <Feather name="check" size={14} color="#10B981" />;
      case "saved":
        return <Feather name="check-circle" size={14} color="#10B981" />;
      case "error":
        return <Feather name="alert-circle" size={14} color="#EF4444" />;
      default:
        return null;
    }
  };

  const renderImageItem = ({ item }: { item: UploadedImage }) => (
    <Pressable
      onPress={() => item.status === "analyzed" && handleEditItem(item)}
      style={styles.imageItem}
    >
      <Image source={{ uri: item.uri }} style={styles.uploadedImage} contentFit="cover" />
      <View style={[styles.statusBadge, { backgroundColor: theme.backgroundDefault }]}>
        {getStatusIcon(item.status)}
      </View>
      {item.status === "error" && (
        <Pressable
          onPress={() => handleRetry(item)}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <Feather name="refresh-cw" size={12} color="#FFFFFF" />
        </Pressable>
      )}
      <Pressable
        onPress={() => handleRemoveImage(item.id)}
        style={[styles.removeButton, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="x" size={16} color={theme.text} />
      </Pressable>
      {item.analysis && (
        <View style={[styles.categoryBadge, { backgroundColor: theme.link }]}>
          <ThemedText type="caption" style={{ color: "#FFFFFF", fontSize: 10 }}>
            {item.analysis.category}
          </ThemedText>
        </View>
      )}
    </Pressable>
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
              {analyzedCount} / {maxItems} ready
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
                  width: `${(analyzedCount / maxItems) * 100}%`,
                },
              ]}
            />
          </View>
          {processingCount > 0 && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={theme.link} />
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm }}>
                Analyzing {processingCount} {processingCount === 1 ? "item" : "items"}...
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handlePickImages}
            style={[styles.actionButton, { backgroundColor: theme.link }]}
          >
            <Feather name="image" size={20} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF" }}>
              Gallery
            </ThemedText>
          </Pressable>
          {Platform.OS !== "web" && (
            <Pressable
              onPress={handleTakePhoto}
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="camera" size={20} color={theme.text} />
              <ThemedText type="body" style={{ color: theme.text }}>
                Camera
              </ThemedText>
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
            <ThemedText type="caption" style={[styles.hint, { color: theme.tabIconDefault }]}>
              Our AI will automatically detect category, color, and style
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={[...images, { id: "add", uri: "", status: "pending" as const }]}
            renderItem={({ item }) =>
              item.id === "add" && images.length < maxItems
                ? renderAddButton()
                : item.id !== "add"
                ? renderImageItem({ item })
                : null
            }
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.imageGrid}
            columnWrapperStyle={styles.imageRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundDefault },
        ]}
      >
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
            `Save ${analyzedCount} ${analyzedCount === 1 ? "item" : "items"} to wardrobe`
          )}
        </Button>
        {!canSubmit && images.length > 0 && processingCount === 0 && (
          <ThemedText type="caption" style={[styles.helperText, { color: theme.tabIconDefault }]}>
            {analyzedCount < minItems
              ? `Add ${minItems - analyzedCount} more to continue`
              : "Tap an item to edit details"}
          </ThemedText>
        )}
      </View>

      <EditItemModal
        visible={!!editingItem}
        item={editingItem}
        theme={theme}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

interface EditItemModalProps {
  visible: boolean;
  item: UploadedImage | null;
  theme: any;
  onClose: () => void;
  onSave: (analysis: AnalyzedItem, name: string) => void;
}

function EditItemModal({ visible, item, theme, onClose, onSave }: EditItemModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState<Category>(item?.analysis?.category || "tops");

  React.useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCategory(item.analysis?.category || "tops");
    }
  }, [item]);

  if (!item?.analysis) return null;

  const handleSave = () => {
    onSave({ ...item.analysis!, category }, name);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <View style={styles.modalHeader}>
            <ThemedText type="h3" style={{ color: theme.text }}>
              Edit Item
            </ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            <Image source={{ uri: item.uri }} style={styles.previewImage} contentFit="cover" />

            <View style={styles.formGroup}>
              <ThemedText type="body" style={[styles.label, { color: theme.text }]}>
                Name
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundSecondary, color: theme.text },
                ]}
                placeholderTextColor={theme.tabIconDefault}
                placeholder="e.g., Blue Oxford Shirt"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="body" style={[styles.label, { color: theme.text }]}>
                Category
              </ThemedText>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor:
                          category === cat ? theme.link : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: category === cat ? "#FFFFFF" : theme.text }}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="body" style={[styles.label, { color: theme.text }]}>
                Detected Details
              </ThemedText>
              <View style={[styles.detailsCard, { backgroundColor: theme.backgroundSecondary }]}>
                <DetailRow label="Color" value={item.analysis.color.primary} theme={theme} />
                <DetailRow label="Style" value={item.analysis.style} theme={theme} />
                <DetailRow label="Pattern" value={item.analysis.pattern} theme={theme} />
                <DetailRow label="Material" value={item.analysis.material} theme={theme} />
                {item.analysis.brand && (
                  <DetailRow label="Brand" value={item.analysis.brand} theme={theme} />
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button onPress={handleSave} style={{ backgroundColor: theme.link }}>
              Save Changes
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.text }}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </ThemedText>
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
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
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
  hint: {
    textAlign: "center",
    marginTop: Spacing.md,
    fontStyle: "italic",
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
  statusBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  retryButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  detailsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
});
