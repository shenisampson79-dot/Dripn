import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Linking,
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
import { UploadGuideComparisonTable } from "@/components/UploadGuideComparisonTable";
import { getClothingUploadComparisons } from "@/constants/uploadGuideExamples";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import {
  useWardrobe,
  ClothingCategory,
  ClothingColor,
  ClothingSeason,
  ClothingOccasion,
  CATEGORY_LABELS,
  COLOR_LABELS,
} from "@/contexts/WardrobeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
} from "@/utils/wardrobeDuplicateMatch";
import { apiService } from "@/services/ApiService";
import { convertImageToBase64 } from "@/services/VisionAnalysisService";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getTierFeatures } from "@/utils/tierMatrix";
import {
  scanBulkItems,
  scanBulkImagesBatch,
  extractProductFromText,
  extractProductFromImage,
  getPhotoTips,
  DetectedGarment,
  ProductLinkResult,
  describeBulkAnalyzeFailure,
} from "@/services/WardrobeDigitizationService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { prepareWardrobeImagesFromPickerAssets, rotateWardrobeImage } from "@/utils/wardrobeImageOrientation";
import { useTranslations } from "@/contexts/TranslationContext";

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type BulkWardrobeUploadScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "BulkWardrobeUpload">;
};

type InputMethod = 'camera' | 'gallery' | 'bulk';

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
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { limits } = useSubscription();
  const maxBulkBatch = limits.maxBulkUploadBatch;
  const { addItem, addItemsBatch, items: existingItems } = useWardrobe();
  const isMale = user?.gender === 'man';
  const clothingPhotoTips = useMemo(
    () => getClothingUploadComparisons(user?.gender),
    [user?.gender],
  );

  const [inputMethod, setInputMethod] = useState<InputMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Analyzing items...');
  const [processingDetail, setProcessingDetail] = useState('AI is detecting clothing items');
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
    ...(!isMale ? [{ value: 'dresses' as ClothingCategory, label: 'Dresses' }] : []),
    { value: 'outerwear', label: 'Outerwear' },
    { value: 'shoes', label: 'Shoes' },
    { value: 'bags', label: 'Bags' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'activewear_tops', label: 'Active Tops' },
    { value: 'activewear_bottoms', label: 'Active Bottoms' },
    { value: 'swimwear', label: 'Swimwear' },
    { value: 'sleepwear', label: 'Sleepwear' },
    { value: 'formal', label: 'Formal' },
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
          ? { ...item, suggestedName: editName, category: editCategory, color: editColor, imageUri: editingItem.imageUri }
          : item
      )
    );
    setEditingItem(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const rotateEditingItemImage = async (degrees: number) => {
    if (!editingItem?.imageUri) return;
    try {
      const rotated = await rotateWardrobeImage(editingItem.imageUri, degrees);
      const newUri = rotated.uri;
      setEditingItem((prev) => (prev ? { ...prev, imageUri: newUri } : prev));
      setPendingItems((items) =>
        items.map((item) =>
          item.id === editingItem.id ? { ...item, imageUri: newUri } : item,
        ),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(t('wardrobe.rotateFailed'), t('wardrobe.couldNotRotatePhotoTryAgain'));
    }
  };

  const preparePickerAssets = async (
    assets: ImagePicker.ImagePickerAsset[],
  ): Promise<string[]> => {
    const { uris } = await prepareWardrobeImagesFromPickerAssets(assets, {
      autoRotateSideways: true,
    });
    return uris;
  };

  const openAppSettings = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Linking.openSettings();
      } catch {}
    }
  };

  const beginProcessing = async (
    message: string,
    detail: string,
    progress: { current: number; total: number },
  ) => {
    setProcessingMessage(message);
    setProcessingDetail(detail);
    setProcessingProgress(progress);
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await yieldToUi();
  };

  const handlePickMultipleImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourPhotoLibraryInSet') || "Please allow access to your photo library in Settings to upload clothes.",
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.openSettings'), onPress: openAppSettings },
          ]
        );
      } else {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourPhotoLibrary') || "Please allow access to your photo library.");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxBulkBatch,
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const total = Math.min(result.assets.length, maxBulkBatch);
      try {
        await beginProcessing(
          'Preparing photos...',
          `Getting ${total} photo${total > 1 ? 's' : ''} ready`,
          { current: 0, total },
        );

        const preparedUris = await preparePickerAssets(result.assets);

        if (preparedUris.length > maxBulkBatch) {
          Alert.alert(
            t('wardrobe.tooManyImages'),
            t('wardrobe.tooManyImagesMessage').replace('{n}', String(maxBulkBatch)),
            [{ text: t('common.ok') }]
          );
        }

        const uris = preparedUris.slice(0, maxBulkBatch);
        setSelectedImages(uris);
        setProcessingMessage('Analyzing items...');
        setProcessingDetail('AI is detecting clothing items');
        await processBulkImages(uris);
      } catch (error) {
        console.error('[BulkUpload] Failed to prepare images:', error);
        setIsProcessing(false);
        Alert.alert(t('common.error'), t('wardrobe.failedToPreparePhotos'));
      }
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowCameraAccessInSettingsToTakeP') || "Please allow camera access in Settings to take photos of your clothes.",
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.openSettings'), onPress: openAppSettings },
          ]
        );
      } else {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourCamera') || "Please allow access to your camera.");
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await beginProcessing(
          'Preparing photo...',
          'Optimizing your image',
          { current: 0, total: 1 },
        );
        const [imageUri] = await preparePickerAssets([result.assets[0]]);
        setSelectedImages([imageUri]);
        setProcessingMessage('Analyzing items...');
        setProcessingDetail('AI is detecting clothing items');
        await processSingleImage(imageUri);
      } catch (error) {
        console.error('[BulkUpload] Failed to prepare camera photo:', error);
        setIsProcessing(false);
        Alert.alert(t('common.error'), t('wardrobe.failedToPreparePhoto'));
      }
    }
  };

  const handlePickScreenshot = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== 'web') {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourPhotoLibraryInSet') || "Please allow access to your photo library in Settings to upload clothes.",
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.openSettings'), onPress: openAppSettings },
          ]
        );
      } else {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourPhotoLibrary') || "Please allow access to your photo library.");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await beginProcessing(
          'Preparing photo...',
          'Optimizing your image',
          { current: 0, total: 1 },
        );
        const [imageUri] = await preparePickerAssets([result.assets[0]]);
        setSelectedImages([imageUri]);
        setProcessingMessage('Analyzing items...');
        setProcessingDetail('AI is detecting clothing items');
        await processScreenshot(imageUri);
      } catch (error) {
        console.error('[BulkUpload] Failed to prepare screenshot:', error);
        setIsProcessing(false);
        Alert.alert(t('common.error'), t('wardrobe.failedToPreparePhoto'));
      }
    }
  };

  const processSingleImage = async (imageUri: string) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing items...');
    setProcessingDetail('AI is detecting clothing items');
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
        Alert.alert(t('wardrobe.noItemsDetected') || "No Items Detected", t('wardrobe.couldNotDetectClothingItemsInThisImageTr') || "Could not detect clothing items in this image. Try a clearer photo or add details manually.",
          [
            { text: t('common.tryAgain'), style: "cancel" },
            { text: t('common.enterManually'), onPress: () => navigation.navigate("AddWardrobeItem") },
          ]
        );
      }
    } catch (error) {
      Alert.alert(t('wardrobe.error') || "Error", t('wardrobe.failedToAnalyzeImagePleaseTryAgain') || "Failed to analyze image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processBulkImages = async (imageUris: string[], isRetry: boolean = false) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing items...');
    setProcessingDetail('AI is detecting clothing items');
    const allItems: PendingItem[] = [];
    const failedUris: string[] = [];
    let quotaExceeded = false;
    let authRequired = false;
    let lastErrorDetail = '';
    setProcessingProgress({ current: 0, total: imageUris.length });

    try {
    const appendScanResult = (
      imageUri: string,
      result: Awaited<ReturnType<typeof scanBulkItems>>,
      index: number,
    ) => {
      if (result.success && result.detectedItems.length > 0) {
        const items: PendingItem[] = result.detectedItems.map((item, itemIndex) => ({
          ...item,
          id: `item_${Date.now()}_${index}_${itemIndex}`,
          imageUri,
          selected: true,
        }));
        allItems.push(...items);
        return;
      }

      if (result.error === 'QUOTA_EXCEEDED') quotaExceeded = true;
      if (result.error === 'AUTH_REQUIRED') authRequired = true;
      if (result.errorDetail) lastErrorDetail = result.errorDetail;
      failedUris.push(imageUri);
      console.log(`[BulkUpload] Analysis failed for image ${index + 1}: ${result.error}`);
    };

    const processSequential = async (uris: string[]) => {
      for (let i = 0; i < uris.length; i++) {
        setProcessingProgress({ current: i + 1, total: imageUris.length });

        try {
          const result = await scanBulkItems(uris[i]);
          appendScanResult(uris[i], result, i);
        } catch (error: any) {
          console.error(`Failed to process image ${i + 1}:`, error);
          if (error?.message) lastErrorDetail = error.message;
          failedUris.push(uris[i]);
        }

        if (i < uris.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    };

    let usedBatch = false;

    if (imageUris.length >= 2) {
      try {
        setProcessingProgress({ current: 0, total: imageUris.length });
        const { rows } = await scanBulkImagesBatch(imageUris);
        usedBatch = true;
        setProcessingProgress({ current: imageUris.length, total: imageUris.length });

        rows.forEach((row, index) => {
          if (row.garment) {
            allItems.push({
              ...row.garment,
              id: `item_${Date.now()}_${index}`,
              imageUri: row.imageUri,
              selected: true,
            });
            return;
          }

          if (row.errorCode === 'QUOTA_EXCEEDED') quotaExceeded = true;
          if (row.errorCode === 'AUTH_REQUIRED') authRequired = true;
          if (row.error) lastErrorDetail = row.error;
          failedUris.push(row.imageUri);
          console.log(`[BulkUpload] Batch analysis failed for image ${index + 1}: ${row.error}`);
        });
      } catch (error: any) {
        console.error('[BulkUpload] Batch analyze failed, falling back to sequential:', error);
        lastErrorDetail = error?.message || String(error);
        await processSequential(imageUris);
      }
    } else {
      await processSequential(imageUris);
    }

    if (usedBatch && failedUris.length > 0) {
      const urisToRetry = [...failedUris];
      failedUris.length = 0;
      await processSequential(urisToRetry);
    }

    setPendingItems(allItems);

    if (allItems.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (failedUris.length > 0) {
        Alert.alert(
          t('wardrobe.partialSuccess'),
          t('wardrobe.partialSuccessMessage')
            .replace('{found}', String(allItems.length))
            .replace('{total}', String(imageUris.length))
            .replace('{failed}', String(failedUris.length)),
          [
            { text: t('common.retryFailed'), onPress: () => processBulkImages(failedUris, true) },
            { text: t('common.continueAnyway'), style: "default" },
          ]
        );
      } else {
        Alert.alert(
          t('wardrobe.itemsDetected'),
          t('wardrobe.itemsDetectedMessage')
            .replace('{count}', String(allItems.length))
            .replace('{photos}', String(imageUris.length))
        );
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (quotaExceeded) {
        Alert.alert(t('wardrobe.aiCreditsExhausted') || "AI Credits Exhausted", t('wardrobe.yourOpenaiApiQuotaHasBeenExceededPleaseT') || "Your OpenAI API quota has been exceeded. Please top up your OpenAI account at platform.openai.com/billing to continue using AI analysis.",
          [{ text: t('common.ok'), style: "cancel" }]
        );
      } else if (authRequired) {
        Alert.alert(t('wardrobe.sessionExpired') || "Session Expired", t('wardrobe.pleaseSignOutAndSignBackInThenTryYourUpl') || "Please sign out and sign back in, then try your upload again.",
          [{ text: t('common.ok'), style: "cancel" }]
        );
      } else {
        const failure = describeBulkAnalyzeFailure(lastErrorDetail);
        Alert.alert(
          failure.title,
          failure.message,
          [
            { text: t('common.tryAgain'), onPress: () => processBulkImages(imageUris, true) },
            { text: t('common.cancel'), style: "cancel" },
          ]
        );
      }
    }
    } catch (error: any) {
      console.error('[BulkUpload] Unexpected processing error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const failure = describeBulkAnalyzeFailure(error?.message || String(error));
      Alert.alert(failure.title, failure.message);
    } finally {
      setIsProcessing(false);
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
          Alert.alert(t('wardrobe.couldNotExtract') || "Could Not Extract", t('wardrobe.unableToExtractProductInformationFromThi') || "Unable to extract product information from this screenshot.");
        }
      }
    } catch (error) {
      Alert.alert(t('wardrobe.error') || "Error", t('wardrobe.failedToProcessScreenshotPleaseTryAgain') || "Failed to process screenshot. Please try again.");
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
      Alert.alert(t('wardrobe.enterUrl') || "Enter URL", t('wardrobe.pleaseEnterOrPasteAProductUrl') || "Please enter or paste a product URL.");
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
        Alert.alert(t('wardrobe.couldNotExtract') || "Could Not Extract", t('wardrobe.unableToExtractProductInformationFromThi') || "Unable to extract product information from this URL. Try copying the full product page content instead.",
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      Alert.alert(t('wardrobe.error') || "Error", t('wardrobe.failedToProcessUrlPleaseTryAgain') || "Failed to process URL. Please try again.");
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
      existing.origin !== 'inspiration'
      && existing.origin !== 'wishlist'
      && existing.name.toLowerCase().trim() === normalizedName
      && existing.category === category
    );
  };

  const handleSaveSelected = async () => {
    const selectedItems = pendingItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      Alert.alert(t('wardrobe.noItemsSelected') || "No Items Selected", t('wardrobe.pleaseSelectAtLeastOneItemToAdd') || "Please select at least one item to add.");
      return;
    }

    // Prefer server visual+attribute check; fall back to local attribute / name match
    let duplicateIds = new Set<string>();
    let duplicateLabelMap: Record<string, string> = {};

    try {
      setIsProcessing(true);
      setProcessingMessage('Checking for duplicates...');
      setProcessingDetail('Comparing with your wardrobe');
      const payloads = [];
      for (const item of selectedItems) {
        let imageBase64: string | undefined;
        if (item.imageUri && !item.imageUri.startsWith('http')) {
          try {
            imageBase64 = await convertImageToBase64(item.imageUri);
          } catch {
            // attribute-only still works
          }
        }
        payloads.push({
          name: item.suggestedName,
          category: item.category,
          color: item.color,
          brand: item.brand,
          imageBase64,
          imageUrl: item.imageUri?.startsWith('http') ? item.imageUri : undefined,
        });
      }
      const check = await apiService.checkWardrobeDuplicates(payloads);
      (check.results || []).forEach((r) => {
        if (!r.isDuplicate || !r.matches?.length) return;
        const src = selectedItems[r.index];
        if (!src) return;
        duplicateIds.add(src.id);
        duplicateLabelMap[src.id] = formatDuplicateNames(r.matches);
      });
    } catch {
      selectedItems.forEach((item) => {
        const local = findLocalWardrobeDuplicates(
          {
            name: item.suggestedName,
            category: item.category,
            color: item.color,
            brand: item.brand,
          },
          existingItems.map((it) => ({
            id: String(it.id),
            name: it.name,
            category: it.category,
            subcategory: it.subcategory,
            color: it.color,
            brand: it.brand,
            imageUri: it.imageUri,
            origin: it.origin,
          })),
        );
        if (local.length > 0 || checkForDuplicate(item.suggestedName, item.category)) {
          duplicateIds.add(item.id);
          duplicateLabelMap[item.id] = formatDuplicateNames(
            local.length > 0 ? local : [{ name: item.suggestedName }],
          );
        }
      });
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      setProcessingDetail('');
    }

    const duplicates = selectedItems.filter((item) => duplicateIds.has(item.id));

    if (duplicates.length > 0) {
      const duplicateNames = duplicates
        .map((d) => duplicateLabelMap[d.id] || d.suggestedName)
        .join(', ');
      Alert.alert(
        t('wardrobe.alreadyHaveThis') || t('wardrobe.duplicateItemsFound'),
        (t('wardrobe.duplicateItemsMessage') || 'The following item(s) are already in your wardrobe: {names}. Would you like to add them anyway?')
          .replace('{names}', duplicateNames),
        [
          {
            text: t('common.skipDuplicates'),
            style: 'cancel',
            onPress: () => saveItems(
              selectedItems.filter((item) => !duplicateIds.has(item.id)),
              { allowDuplicates: false },
            ),
          },
          {
            text: t('common.addAnyway') || t('common.addAll'),
            onPress: () => saveItems(selectedItems, { allowDuplicates: true }),
          },
        ],
      );
      return;
    }

    await saveItems(selectedItems, { allowDuplicates: false });
  };

  const saveItems = async (
    itemsToSave: PendingItem[],
    opts?: { allowDuplicates?: boolean },
  ) => {
    if (itemsToSave.length === 0) {
      Alert.alert(t('wardrobe.noItemsToAdd') || "No Items to Add", t('wardrobe.allSelectedItemsAreAlreadyInYourWardrobe') || "All selected items are already in your wardrobe.");
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Saving items...');
    setProcessingDetail('Adding to your wardrobe');
    let savedCount = 0;

    try {
      const batchItems = itemsToSave.map((item) => ({
        imageUri: item.imageUri ?? '',
        name: item.suggestedName,
        category: item.category,
        color: item.color,
        seasons: (item.seasons.length > 0 ? item.seasons : ['all-season']) as import('@/contexts/WardrobeContext').ClothingSeason[],
        occasions: (item.occasions.length > 0 ? item.occasions : ['everyday']) as import('@/contexts/WardrobeContext').ClothingOccasion[],
        brand: item.brand,
        notes: item.description,
        origin: 'owned' as const,
        sourceUrl: item.sourceUrl,
        purchasePrice: item.price,
        isFavorite: false,
      }));

      const savedItems = await addItemsBatch(batchItems, {
        allowDuplicates: opts?.allowDuplicates === true,
      });
      savedCount = savedItems.length;
    } catch (error) {
      console.error('Failed to save items:', error);
    }

    setIsProcessing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Alert.alert(
      t('wardrobe.itemsAdded'),
      savedCount > 0
        ? t('wardrobe.itemsAddedSuccess').replace('{count}', String(savedCount))
        : t('wardrobe.itemsAddedFailed'),
      [{ text: t('common.done'), onPress: () => navigation.goBack() }]
    );
  };

  const renderInputMethodSelector = () => (
    <View>
      <View style={styles.uploadActionsSection}>
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
        </View>
      </View>

      <View style={[styles.tipsSection, { backgroundColor: theme.backgroundSecondary }]}>
        <UploadGuideComparisonTable
          compact
          title={t('wardrobe.photoTipsForBestResults') || "Photo tips for best results"}
          rows={clothingPhotoTips}
        />

        <Pressable onPress={() => setShowPhotoTips(true)} style={styles.seeAllTipsLink}>
          <ThemedText type="caption" style={{ color: theme.link, fontWeight: '600' }}>
            More photo tips
          </ThemedText>
          <Feather name="chevron-right" size={14} color={theme.link} />
        </Pressable>
      </View>
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
          placeholder={t('wardrobe.httpsexamplecomproduct') || "https://example.com/product..."}
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
          <View style={styles.pendingItemTitleRow}>
            <ThemedText type="body" style={styles.pendingItemTitle}>
              {item.suggestedName || 'New Item'}
            </ThemedText>
            <Feather name="edit-2" size={14} color={theme.link} style={styles.pendingItemEditIcon} />
          </View>
          {item.brand ? (
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              {item.brand}
            </ThemedText>
          ) : null}
          <View style={styles.pendingItemTags}>
            <View style={[styles.miniTag, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>
                {CATEGORY_LABELS[item.category] || item.category.replace(/_/g, ' ')}
              </ThemedText>
            </View>
            <View style={[styles.miniTag, { backgroundColor: theme.link + '20' }]}>
              <ThemedText type="caption" style={{ color: theme.link }}>
                {COLOR_LABELS[item.color] || item.color}
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
            <>
              <Image
                source={{ uri: editingItem.imageUri }}
                style={styles.editItemImage}
                contentFit="contain"
              />
              <View style={styles.rotateRow}>
                <Pressable
                  onPress={() => rotateEditingItemImage(-90)}
                  style={[styles.rotateButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="rotate-ccw" size={18} color={theme.text} />
                  <ThemedText type="caption" style={{ marginLeft: Spacing.xs }}>
                    Rotate left
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => rotateEditingItemImage(90)}
                  style={[styles.rotateButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="rotate-cw" size={18} color={theme.text} />
                  <ThemedText type="caption" style={{ marginLeft: Spacing.xs }}>
                    Rotate right
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : null}
          
          <View style={styles.editSection}>
            <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.sm }}>
              Item Name
            </ThemedText>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder={t('wardrobe.enterItemName') || "Enter item name"}
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

  const renderProcessingOverlay = () => (
    <Modal
      visible={isProcessing}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}
    >
      <View style={styles.processingOverlay}>
        <View style={[styles.processingCard, { backgroundColor: theme.backgroundRoot }]}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
            {processingMessage}
          </ThemedText>
          {processingProgress.total > 1 ? (
            <ThemedText type="caption" style={{ marginTop: Spacing.sm, color: theme.tabIconDefault }}>
              {processingProgress.current > 0
                ? `Processing ${processingProgress.current} of ${processingProgress.total}`
                : `${processingProgress.total} photos selected`}
            </ThemedText>
          ) : null}
          <ThemedText type="caption" style={{ marginTop: Spacing.sm, color: theme.tabIconDefault }}>
            {processingDetail}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Bulk Add Items</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {pendingItems.length > 0 ? (
        renderPendingItems()
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
  uploadActionsSection: {
    paddingTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  tipsSection: {
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
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
  seeAllTipsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
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
    alignItems: "flex-start",
    overflow: "hidden",
  },
  pendingItemMain: {
    flex: 1,
    flexDirection: "row",
    padding: Spacing.md,
    alignItems: "flex-start",
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
    minWidth: 0,
  },
  pendingItemTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pendingItemTitle: {
    flex: 1,
    flexShrink: 1,
    fontWeight: "600",
  },
  pendingItemEditIcon: {
    marginLeft: Spacing.xs,
    marginTop: 3,
  },
  checkBoxTouchArea: {
    padding: Spacing.md,
    paddingLeft: 0,
    alignSelf: "center",
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
    marginBottom: Spacing.sm,
  },
  rotateRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  rotateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Dimensions.get("window").height * 0.28,
    paddingHorizontal: Spacing.xl,
  },
  processingCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minWidth: 200,
  },
});
