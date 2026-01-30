import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  TextInput,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useWardrobe, ClothingCategory, ClothingColor, ClothingSeason, ClothingOccasion } from "@/contexts/WardrobeContext";
import {
  scanBulkItems,
  extractProductFromText,
  extractProductFromImage,
  getPhotoTips,
  DetectedGarment,
  ProductLinkResult,
} from "@/services/WardrobeDigitizationService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type BulkWardrobeUploadScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "BulkWardrobeUpload">;
};

type InputMethod = 'camera' | 'gallery' | 'bulk' | 'url' | 'screenshot';

interface PendingItem extends DetectedGarment {
  id: string;
  imageUri?: string;
  selected: boolean;
  sourceUrl?: string;
  price?: number;
  currency?: string;
  retailer?: string;
}

export default function BulkWardrobeUploadScreen({ navigation }: BulkWardrobeUploadScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addItem, items: existingItems } = useWardrobe();

  const [inputMethod, setInputMethod] = useState<InputMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [editingItem, setEditingItem] = useState<PendingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<ClothingCategory>("tops");
  const [editColor, setEditColor] = useState<ClothingColor>("black");

  const photoTips = getPhotoTips();
  
  const CATEGORY_OPTIONS: { value: ClothingCategory; label: string }[] = [
    { value: 'tops', label: 'Tops' },
    { value: 'bottoms', label: 'Bottoms' },
    { value: 'dresses', label: 'Dresses' },
    { value: 'outerwear', label: 'Outerwear' },
    { value: 'shoes', label: 'Shoes' },
    { value: 'bags', label: 'Bags' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'activewear', label: 'Activewear' },
    { value: 'swimwear', label: 'Swimwear' },
    { value: 'sleepwear', label: 'Sleepwear' },
  ];
  
  const COLOR_OPTIONS: { value: ClothingColor; label: string }[] = [
    { value: 'black', label: 'Black' },
    { value: 'white', label: 'White' },
    { value: 'gray', label: 'Gray' },
    { value: 'navy', label: 'Navy' },
    { value: 'blue', label: 'Blue' },
    { value: 'denim', label: 'Denim' },
    { value: 'brown', label: 'Brown' },
    { value: 'beige', label: 'Beige' },
    { value: 'cream', label: 'Cream' },
    { value: 'red', label: 'Red' },
    { value: 'pink', label: 'Pink' },
    { value: 'green', label: 'Green' },
    { value: 'yellow', label: 'Yellow' },
    { value: 'orange', label: 'Orange' },
    { value: 'purple', label: 'Purple' },
    { value: 'multicolor', label: 'Multicolor' },
  ];
  
  const openEditModal = (item: PendingItem) => {
    setEditingItem(item);
    setEditName(item.suggestedName || "");
    setEditCategory(item.category);
    setEditColor(item.color);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const saveItemEdits = () => {
    if (!editingItem) return;
    
    setPendingItems(items =>
      items.map(item =>
        item.id === editingItem.id
          ? { ...item, suggestedName: editName, category: editCategory, color: editColor }
          : item
      )
    );
    setEditingItem(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePickMultipleImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const imageUris = result.assets.map(asset => asset.uri);
      
      // Enforce max 10 images to prevent memory issues with HEIC conversion
      if (imageUris.length > 10) {
        Alert.alert(
          "Too Many Images",
          "Please select up to 10 images at a time to ensure smooth processing.",
          [{ text: "OK" }]
        );
        setSelectedImages(imageUris.slice(0, 10));
        await processBulkImages(imageUris.slice(0, 10));
      } else {
        setSelectedImages(imageUris);
        await processBulkImages(imageUris);
      }
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const imageUri = result.assets[0].uri;
      setSelectedImages([imageUri]);
      await processSingleImage(imageUri);
    }
  };

  const handlePickScreenshot = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const imageUri = result.assets[0].uri;
      setSelectedImages([imageUri]);
      await processScreenshot(imageUri);
    }
  };

  const processSingleImage = async (imageUri: string) => {
    setIsProcessing(true);
    setProcessingProgress({ current: 1, total: 1 });

    try {
      const result = await scanBulkItems(imageUri);
      if (result.success && result.detectedItems.length > 0) {
        const items: PendingItem[] = result.detectedItems.map((item, index) => ({
          ...item,
          id: `item_${Date.now()}_${index}`,
          imageUri,
          selected: true,
        }));
        setPendingItems(items);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          "No Items Detected",
          "Could not detect clothing items in this image. Try a clearer photo or add details manually.",
          [
            { text: "Try Again", style: "cancel" },
            { text: "Add Manually", onPress: () => navigation.navigate("AddWardrobeItem") },
          ]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to analyze image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processBulkImages = async (imageUris: string[], isRetry: boolean = false) => {
    setIsProcessing(true);
    const allItems: PendingItem[] = [];
    const failedUris: string[] = [];
    setProcessingProgress({ current: 0, total: imageUris.length });

    for (let i = 0; i < imageUris.length; i++) {
      setProcessingProgress({ current: i + 1, total: imageUris.length });
      
      try {
        const result = await scanBulkItems(imageUris[i]);
        if (result.success && result.detectedItems.length > 0) {
          const items: PendingItem[] = result.detectedItems.map((item, index) => ({
            ...item,
            id: `item_${Date.now()}_${i}_${index}`,
            imageUri: imageUris[i],
            selected: true,
          }));
          allItems.push(...items);
        } else {
          // AI analysis failed for this image
          failedUris.push(imageUris[i]);
          console.log(`[BulkUpload] Analysis failed for image ${i + 1}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Failed to process image ${i + 1}:`, error);
        failedUris.push(imageUris[i]);
      }
    }

    setPendingItems(allItems);
    setIsProcessing(false);

    if (allItems.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (failedUris.length > 0) {
        Alert.alert(
          "Partial Success",
          `Analyzed ${allItems.length} of ${imageUris.length} items. ${failedUris.length} image${failedUris.length > 1 ? 's' : ''} could not be analyzed. Review and confirm to add to your wardrobe.`,
          [
            { text: "Retry Failed", onPress: () => processBulkImages(failedUris, true) },
            { text: "Continue Anyway", style: "default" },
          ]
        );
      } else {
        Alert.alert(
          "Items Detected",
          `Found ${allItems.length} item${allItems.length > 1 ? 's' : ''} in ${imageUris.length} photo${imageUris.length > 1 ? 's' : ''}. Review and confirm to add to your wardrobe.`
        );
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Analysis Failed",
        "AI analysis is temporarily unavailable. This may be due to network issues. Please try again in a moment.",
        [
          { text: "Try Again", onPress: () => processBulkImages(imageUris, true) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  const processScreenshot = async (imageUri: string) => {
    setIsProcessing(true);
    setProcessingProgress({ current: 1, total: 1 });

    try {
      const result = await extractProductFromImage(imageUri);
      if (result.success && result.productName) {
        const item: PendingItem = {
          id: `item_${Date.now()}`,
          imageUri,
          selected: true,
          category: result.category || 'tops',
          color: result.color || 'black',
          suggestedName: result.productName,
          brand: result.brand,
          seasons: ['all-season'],
          occasions: ['everyday'],
          confidence: 0.9,
          description: result.description || '',
          price: result.price,
          currency: result.currency,
          retailer: result.retailer,
          sourceUrl: result.productUrl,
        };
        setPendingItems([item]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const scanResult = await scanBulkItems(imageUri);
        if (scanResult.success && scanResult.detectedItems.length > 0) {
          const items: PendingItem[] = scanResult.detectedItems.map((item, index) => ({
            ...item,
            id: `item_${Date.now()}_${index}`,
            imageUri,
            selected: true,
          }));
          setPendingItems(items);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert("Could Not Extract", "Unable to extract product information from this screenshot.");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to process screenshot. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteUrl = async () => {
    const clipboardContent = await Clipboard.getStringAsync();
    if (clipboardContent) {
      setUrlInput(clipboardContent);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleProcessUrl = async () => {
    if (!urlInput.trim()) {
      Alert.alert("Enter URL", "Please enter or paste a product URL.");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress({ current: 1, total: 1 });

    try {
      const result = await extractProductFromText(urlInput);
      if (result.success && result.productName) {
        const item: PendingItem = {
          id: `item_${Date.now()}`,
          selected: true,
          category: result.category || 'tops',
          color: result.color || 'black',
          suggestedName: result.productName,
          brand: result.brand,
          seasons: ['all-season'],
          occasions: ['everyday'],
          confidence: 0.85,
          description: result.description || '',
          price: result.price,
          currency: result.currency,
          retailer: result.retailer,
          sourceUrl: urlInput,
          imageUri: result.imageUrl,
        };
        setPendingItems([item]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          "Could Not Extract",
          "Unable to extract product information from this URL. Try copying the full product page content instead.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to process URL. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const checkForDuplicate = (itemName: string, category: string): boolean => {
    const normalizedName = itemName.toLowerCase().trim();
    return existingItems.some(existing => 
      existing.name.toLowerCase().trim() === normalizedName && 
      existing.category === category
    );
  };

  const handleSaveSelected = async () => {
    const selectedItems = pendingItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert("No Items Selected", "Please select at least one item to add.");
      return;
    }

    const duplicates = selectedItems.filter(item => 
      checkForDuplicate(item.suggestedName, item.category)
    );

    if (duplicates.length > 0) {
      const duplicateNames = duplicates.map(d => d.suggestedName).join(', ');
      Alert.alert(
        "Duplicate Items Found",
        `The following item${duplicates.length > 1 ? 's are' : ' is'} already in your wardrobe: ${duplicateNames}. Would you like to add them anyway?`,
        [
          {
            text: "Skip Duplicates",
            style: 'cancel',
            onPress: () => saveItems(selectedItems.filter(item => !checkForDuplicate(item.suggestedName, item.category))),
          },
          {
            text: "Add All",
            onPress: () => saveItems(selectedItems),
          },
        ]
      );
      return;
    }

    await saveItems(selectedItems);
  };

  const saveItems = async (itemsToSave: PendingItem[]) => {
    if (itemsToSave.length === 0) {
      Alert.alert("No Items to Add", "All selected items are already in your wardrobe.");
      return;
    }

    setIsProcessing(true);
    let savedCount = 0;

    for (const item of itemsToSave) {
      try {
        await addItem({
          imageUri: item.imageUri || 'https://via.placeholder.com/300',
          name: item.suggestedName,
          category: item.category,
          color: item.color,
          seasons: item.seasons.length > 0 ? item.seasons : ['all-season'],
          occasions: item.occasions.length > 0 ? item.occasions : ['everyday'],
          brand: item.brand,
          notes: item.description,
          origin: 'owned',
          sourceUrl: item.sourceUrl,
          purchasePrice: item.price,
          aiAnalyzed: true,
          isFavorite: false,
        });
        savedCount++;
      } catch (error) {
        console.error('Failed to save item:', error);
      }
    }

    setIsProcessing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Alert.alert(
      "Items Added",
      `Successfully added ${savedCount} item${savedCount > 1 ? 's' : ''} to your wardrobe!`,
      [{ text: "Done", onPress: () => navigation.goBack() }]
    );
  };

  const renderInputMethodSelector = () => (
    <View style={styles.methodsContainer}>
      <ThemedText type="h3" style={styles.sectionTitle}>
        How would you like to add items?
      </ThemedText>

      <View style={styles.methodsGrid}>
        <Pressable
          onPress={() => {
            setInputMethod('bulk');
            handlePickMultipleImages();
          }}
          style={[styles.methodCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.methodIconContainer, { backgroundColor: theme.link + '20' }]}>
            <Feather name="layers" size={28} color={theme.link} />
          </View>
          <ThemedText type="body" style={styles.methodTitle}>Bulk Upload</ThemedText>
          <ThemedText type="caption" style={styles.methodDescription}>
            Select multiple photos at once
          </ThemedText>
        </Pressable>

        {Platform.OS !== "web" ? (
          <Pressable
            onPress={() => {
              setInputMethod('camera');
              handleTakePhoto();
            }}
            style={[styles.methodCard, { backgroundColor: theme.backgroundDefault }]}
          >
            <View style={[styles.methodIconContainer, { backgroundColor: theme.link + '20' }]}>
              <Feather name="camera" size={28} color={theme.link} />
            </View>
            <ThemedText type="body" style={styles.methodTitle}>Take Photo</ThemedText>
            <ThemedText type="caption" style={styles.methodDescription}>
              Photograph your clothes
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {
            setInputMethod('screenshot');
            handlePickScreenshot();
          }}
          style={[styles.methodCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.methodIconContainer, { backgroundColor: theme.link + '20' }]}>
            <Feather name="smartphone" size={28} color={theme.link} />
          </View>
          <ThemedText type="body" style={styles.methodTitle}>From Screenshot</ThemedText>
          <ThemedText type="caption" style={styles.methodDescription}>
            Import from shopping apps
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setInputMethod('url')}
          style={[styles.methodCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.methodIconContainer, { backgroundColor: theme.link + '20' }]}>
            <Feather name="link" size={28} color={theme.link} />
          </View>
          <ThemedText type="body" style={styles.methodTitle}>Paste Link</ThemedText>
          <ThemedText type="caption" style={styles.methodDescription}>
            Add from product URL
          </ThemedText>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setShowPhotoTips(true)}
        style={[styles.tipsButton, { borderColor: theme.tabIconDefault }]}
      >
        <Feather name="help-circle" size={18} color={theme.tabIconDefault} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
          Photo Tips for Best Results
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderUrlInput = () => (
    <View style={styles.urlInputContainer}>
      <ThemedText type="h3" style={styles.sectionTitle}>
        Paste Product Link
      </ThemedText>
      <ThemedText type="caption" style={[styles.urlHint, { color: theme.tabIconDefault }]}>
        Paste a link from any shopping website to automatically extract product details
      </ThemedText>

      <View style={styles.urlInputRow}>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://example.com/product..."
          placeholderTextColor={theme.tabIconDefault}
          style={[styles.urlInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          onPress={handlePasteUrl}
          style={[styles.pasteButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="clipboard" size={20} color={theme.link} />
        </Pressable>
      </View>

      <Pressable
        onPress={handleProcessUrl}
        disabled={!urlInput.trim() || isProcessing}
        style={[
          styles.processButton,
          {
            backgroundColor: urlInput.trim() && !isProcessing ? theme.link : theme.backgroundDefault,
            opacity: urlInput.trim() && !isProcessing ? 1 : 0.5,
          },
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="download" size={20} color={urlInput.trim() ? "#FFFFFF" : theme.tabIconDefault} />
        )}
        <ThemedText
          type="body"
          style={{
            color: urlInput.trim() && !isProcessing ? "#FFFFFF" : theme.tabIconDefault,
            marginLeft: Spacing.sm,
          }}
        >
          Extract Product Info
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={() => setInputMethod(null)}
        style={styles.backLink}
      >
        <Feather name="arrow-left" size={16} color={theme.tabIconDefault} />
        <ThemedText type="caption" style={{ marginLeft: Spacing.xs, color: theme.tabIconDefault }}>
          Back to upload options
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderPendingItem = useCallback(({ item }: { item: PendingItem }) => (
    <View
      style={[
        styles.pendingItemCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: item.selected ? theme.link : 'transparent',
          borderWidth: 2,
        },
      ]}
    >
      <Pressable 
        onPress={() => openEditModal(item)}
        style={styles.pendingItemMain}
      >
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.pendingItemImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.pendingItemImage, { backgroundColor: theme.backgroundRoot }]}>
            <Feather name="image" size={24} color={theme.tabIconDefault} />
          </View>
        )}

        <View style={styles.pendingItemInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ThemedText type="body" numberOfLines={1} style={{ fontWeight: '600', flex: 1 }}>
              {item.suggestedName || 'New Item'}
            </ThemedText>
            <Feather name="edit-2" size={14} color={theme.link} style={{ marginLeft: Spacing.xs }} />
          </View>
          {item.brand ? (
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              {item.brand}
            </ThemedText>
          ) : null}
          <View style={styles.pendingItemTags}>
            <View style={[styles.miniTag, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>
                {item.category}
              </ThemedText>
            </View>
            <View style={[styles.miniTag, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>
                {item.color}
              </ThemedText>
            </View>
          </View>
          {item.price ? (
            <ThemedText type="body" style={{ color: theme.link, marginTop: 4 }}>
              {item.currency || '$'}{item.price.toFixed(2)}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>

      <Pressable 
        onPress={() => toggleItemSelection(item.id)}
        style={styles.checkBoxTouchArea}
      >
        <View style={[styles.checkBox, { borderColor: item.selected ? theme.link : theme.tabIconDefault }]}>
          {item.selected ? (
            <View style={[styles.checkBoxFilled, { backgroundColor: theme.link }]}>
              <Feather name="check" size={14} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  ), [theme]);

  const renderPendingItems = () => {
    const selectedCount = pendingItems.filter(i => i.selected).length;
    
    return (
      <View style={styles.pendingContainer}>
        <View style={styles.pendingHeader}>
          <ThemedText type="h3">
            Review Items ({pendingItems.length})
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
            {selectedCount} selected
          </ThemedText>
        </View>

        <FlatList
          data={pendingItems}
          renderItem={renderPendingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.pendingList}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.pendingActions, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <Pressable
            onPress={() => {
              setPendingItems([]);
              setSelectedImages([]);
              setInputMethod(null);
            }}
            style={[styles.actionButton, styles.cancelButton, { borderColor: theme.tabIconDefault }]}
          >
            <ThemedText type="body">Start Over</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSaveSelected}
            disabled={selectedCount === 0 || isProcessing}
            style={[
              styles.actionButton,
              styles.saveButton,
              {
                backgroundColor: selectedCount > 0 && !isProcessing ? theme.link : theme.backgroundDefault,
                opacity: selectedCount > 0 && !isProcessing ? 1 : 0.5,
              },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="plus" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                  Add {selectedCount} Item{selectedCount !== 1 ? 's' : ''}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={!!editingItem}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setEditingItem(null)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => setEditingItem(null)}
            style={[styles.modalCloseButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Edit Item</ThemedText>
          <Pressable
            onPress={saveItemEdits}
            style={[styles.modalSaveButton, { backgroundColor: theme.link }]}
          >
            <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Save</ThemedText>
          </Pressable>
        </View>
        
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.editModalContent}
        >
          {editingItem?.imageUri ? (
            <Image
              source={{ uri: editingItem.imageUri }}
              style={styles.editItemImage}
              contentFit="contain"
            />
          ) : null}
          
          <View style={styles.editSection}>
            <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
              Item Name
            </ThemedText>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter item name"
              placeholderTextColor={theme.tabIconDefault}
              style={[styles.editInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            />
          </View>
          
          <View style={styles.editSection}>
            <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
              Category
            </ThemedText>
            <View style={styles.optionsGrid}>
              {CATEGORY_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => setEditCategory(option.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: editCategory === option.value ? theme.link : theme.backgroundDefault,
                      borderColor: editCategory === option.value ? theme.link : theme.tabIconDefault,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: editCategory === option.value ? '#FFFFFF' : theme.text }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
          
          <View style={styles.editSection}>
            <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
              Color
            </ThemedText>
            <View style={styles.optionsGrid}>
              {COLOR_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => setEditColor(option.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: editColor === option.value ? theme.link : theme.backgroundDefault,
                      borderColor: editColor === option.value ? theme.link : theme.tabIconDefault,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: editColor === option.value ? '#FFFFFF' : theme.text }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );

  const renderPhotoTipsModal = () => (
    <Modal
      visible={showPhotoTips}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPhotoTips(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={() => setShowPhotoTips(false)}
            style={[styles.modalCloseButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Photo Tips</ThemedText>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={[
            { title: 'Do', items: photoTips.doList, icon: 'check-circle', color: '#34C759' },
            { title: "Don't", items: photoTips.dontList, icon: 'x-circle', color: '#FF3B30' },
            { title: 'Tips', items: photoTips.tips, icon: 'info', color: theme.link },
          ]}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.tipsContent}
          renderItem={({ item }) => (
            <Card elevation={1} style={styles.tipsSection}>
              <View style={styles.tipsSectionHeader}>
                <Feather name={item.icon as any} size={20} color={item.color} />
                <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                  {item.title}
                </ThemedText>
              </View>
              {item.items.map((tip, index) => (
                <View key={index} style={styles.tipRow}>
                  <View style={[styles.tipBullet, { backgroundColor: item.color }]} />
                  <ThemedText type="body" style={styles.tipText}>{tip}</ThemedText>
                </View>
              ))}
            </Card>
          )}
        />
      </View>
    </Modal>
  );

  const renderProcessingOverlay = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.processingOverlay}>
        <View style={[styles.processingCard, { backgroundColor: theme.backgroundRoot }]}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
            Analyzing Items...
          </ThemedText>
          {processingProgress.total > 1 ? (
            <ThemedText type="caption" style={{ marginTop: Spacing.sm, color: theme.tabIconDefault }}>
              Processing {processingProgress.current} of {processingProgress.total}
            </ThemedText>
          ) : null}
          <ThemedText type="caption" style={{ marginTop: Spacing.sm, color: theme.tabIconDefault }}>
            AI is detecting clothing items
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Quick Add Items</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {pendingItems.length > 0 ? (
        renderPendingItems()
      ) : inputMethod === 'url' ? (
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderUrlInput()}
        </KeyboardAwareScrollView>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderInputMethodSelector}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        />
      )}

      {renderEditModal()}
      {renderPhotoTipsModal()}
      {renderProcessingOverlay()}
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  methodsContainer: {
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  methodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  methodCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  methodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  methodTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  methodDescription: {
    textAlign: "center",
    opacity: 0.7,
  },
  tipsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  urlInputContainer: {
    paddingTop: Spacing.lg,
  },
  urlHint: {
    marginBottom: Spacing.lg,
  },
  urlInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  urlInput: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  pasteButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  processButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  pendingContainer: {
    flex: 1,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  pendingList: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  pendingItemCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    alignItems: "center",
    overflow: "hidden",
  },
  pendingItemMain: {
    flex: 1,
    flexDirection: "row",
    padding: Spacing.md,
    alignItems: "center",
  },
  pendingItemImage: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingItemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checkBoxTouchArea: {
    padding: Spacing.md,
    paddingLeft: 0,
  },
  pendingItemTags: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  miniTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxFilled: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingActions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  editModalContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  editItemImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  editSection: {
    marginBottom: Spacing.xl,
  },
  editInput: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tipsContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  tipsSection: {
    marginBottom: Spacing.lg,
  },
  tipsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  tipText: {
    flex: 1,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  processingCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minWidth: 200,
  },
});
