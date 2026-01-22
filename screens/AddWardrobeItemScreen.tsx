import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  TextInput,
  Dimensions,
  Linking,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import {
  useWardrobe,
  ClothingCategory,
  ClothingColor,
  ClothingSeason,
  ClothingOccasion,
  ItemOrigin,
  CATEGORY_LABELS,
  COLOR_LABELS,
  SEASON_LABELS,
  OCCASION_LABELS,
  ORIGIN_LABELS,
} from "@/contexts/WardrobeContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { apiService } from "@/services/ApiService";
import * as FileSystem from "expo-file-system/legacy";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type AddWardrobeItemScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "AddWardrobeItem">;
};

const getCategoryOptions = (isMale: boolean): Array<{ key: ClothingCategory; icon: string; iconSet: 'feather' | 'material' }> => [
  { key: 'tops', icon: 'tshirt-crew', iconSet: 'material' },
  { key: 'bottoms', icon: isMale ? 'roller-skate-off' : 'lingerie', iconSet: 'material' },
  { key: 'dresses', icon: 'tshirt-v', iconSet: 'material' },
  { key: 'outerwear', icon: 'coat-rack', iconSet: 'material' },
  { key: 'shoes', icon: isMale ? 'shoe-formal' : 'shoe-heel', iconSet: 'material' },
  { key: 'bags', icon: isMale ? 'briefcase' : 'bag-personal', iconSet: 'material' },
  { key: 'accessories', icon: 'watch', iconSet: 'material' },
  { key: 'activewear', icon: 'run', iconSet: 'material' },
  { key: 'swimwear', icon: 'swim', iconSet: 'material' },
  { key: 'sleepwear', icon: 'sleep', iconSet: 'material' },
  { key: 'formal', icon: 'bow-tie', iconSet: 'material' },
];

const COLOR_OPTIONS: ClothingColor[] = [
  'black', 'white', 'gray', 'navy', 'brown', 'beige',
  'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor',
];

const SEASON_OPTIONS: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];

const OCCASION_OPTIONS: ClothingOccasion[] = [
  'casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday',
];

export default function AddWardrobeItemScreen({ navigation }: AddWardrobeItemScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addItem } = useWardrobe();
  const { user } = useAuth();
  
  const isMale = user?.gender === 'man';
  const categoryOptions = getCategoryOptions(isMale);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageProcessed, setImageProcessed] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [color, setColor] = useState<ClothingColor | null>(null);
  const [seasons, setSeasons] = useState<ClothingSeason[]>([]);
  const [occasions, setOccasions] = useState<ClothingOccasion[]>([]);
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [origin, setOrigin] = useState<ItemOrigin>('owned');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  const processImageWithAI = async (uri: string) => {
    setIsProcessingImage(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      let imageBase64: string;
      if (uri.startsWith('data:')) {
        imageBase64 = uri.split(',')[1];
      } else {
        imageBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      }
      
      const result = await apiService.extractClothing({ imageBase64 });
      
      if (result.success && result.processedImageBase64) {
        const processedUri = `data:image/png;base64,${result.processedImageBase64}`;
        setImageUri(processedUri);
        setImageProcessed(true);
        
        if (result.clothingAnalysis) {
          const analysis = result.clothingAnalysis;
          const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear', 'swimwear', 'sleepwear', 'formal'];
          const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor'];
          const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
          const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];
          
          const typeToCategory: Record<string, ClothingCategory> = {
            'shirt': 'tops', 'blouse': 'tops', 't-shirt': 'tops', 'top': 'tops', 'sweater': 'tops', 'hoodie': 'tops',
            'pants': 'bottoms', 'jeans': 'bottoms', 'shorts': 'bottoms', 'skirt': 'bottoms', 'trousers': 'bottoms',
            'dress': 'dresses', 'gown': 'dresses', 'jumpsuit': 'dresses', 'romper': 'dresses',
            'jacket': 'outerwear', 'coat': 'outerwear', 'blazer': 'outerwear', 'cardigan': 'outerwear', 'suit': 'formal',
            'shoes': 'shoes', 'sneakers': 'shoes', 'boots': 'shoes', 'heels': 'shoes', 'sandals': 'shoes',
            'bag': 'bags', 'purse': 'bags', 'backpack': 'bags', 'handbag': 'bags',
            'watch': 'accessories', 'jewelry': 'accessories', 'belt': 'accessories', 'hat': 'accessories', 'scarf': 'accessories',
          };
          
          const detectedType = analysis.type?.toLowerCase() || '';
          const mappedCategory = typeToCategory[detectedType] || validCategories.find(c => detectedType.includes(c));
          if (mappedCategory) setCategory(mappedCategory);
          
          const colorLower = analysis.color?.toLowerCase() || '';
          const mappedColor = validColors.find(c => colorLower.includes(c));
          if (mappedColor) setColor(mappedColor);
          
          if (analysis.description) setName(analysis.description.slice(0, 50));
          if (analysis.brand) setBrand(analysis.brand);
          if (analysis.seasons) setSeasons(analysis.seasons.filter((s: string) => validSeasons.includes(s as ClothingSeason)) as ClothingSeason[]);
          if (analysis.occasions) setOccasions(analysis.occasions.filter((o: string) => validOccasions.includes(o as ClothingOccasion)) as ClothingOccasion[]);
          
          setAiAnalyzed(true);
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return processedUri;
      }
      
      setImageProcessed(false);
      return uri;
    } catch (error: any) {
      console.log('Clothing extraction not available, using original image:', error.message);
      setImageProcessed(false);
      return uri;
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleAIScan = async () => {
    if (!imageUri) return;
    
    setIsAnalyzing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      let imageBase64: string;
      if (imageUri.startsWith('data:')) {
        imageBase64 = imageUri.split(',')[1];
      } else {
        imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });
      }
      
      const result = await apiService.analyzeGarmentPhoto(imageBase64);
      
      if (result.success && result.analysis) {
        const analysis = result.analysis;
        const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear', 'swimwear', 'sleepwear', 'formal'];
        const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor'];
        const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
        const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];
        
        if (analysis.category && validCategories.includes(analysis.category as ClothingCategory)) {
          setCategory(analysis.category as ClothingCategory);
        }
        if (analysis.color && validColors.includes(analysis.color as ClothingColor)) {
          setColor(analysis.color as ClothingColor);
        }
        if (analysis.suggestedName) setName(analysis.suggestedName);
        if (analysis.seasons && analysis.seasons.length > 0) {
          setSeasons(analysis.seasons.filter((s: string) => validSeasons.includes(s as ClothingSeason)) as ClothingSeason[]);
        }
        if (analysis.occasions && analysis.occasions.length > 0) {
          setOccasions(analysis.occasions.filter((o: string) => validOccasions.includes(o as ClothingOccasion)) as ClothingOccasion[]);
        }
        if (analysis.brand) setBrand(analysis.brand);
        if (analysis.description) setNotes(analysis.description);
        setAiAnalyzed(true);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "AI Analysis Complete",
          `Detected: ${analysis.suggestedName || 'Fashion Item'}\n\nFeel free to adjust any details before saving.`,
          [{ text: "Got it", style: "default" }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "Analysis Issue",
          "Could not analyze image. Please fill in the details manually.",
          [{ text: "OK", style: "default" }]
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to analyze image. Please try again or fill in details manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openSettings = async () => {
    if (Platform.OS !== "web") {
      try {
        await Linking.openSettings();
      } catch (error) {
        Alert.alert("Error", "Could not open settings. Please enable permissions manually.");
      }
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(
          "Permission Required",
          "Photo library access was denied. Please enable it in Settings to add images.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openSettings },
          ]
        );
      } else {
        Alert.alert("Permission Required", "Please allow access to your photo library to add images.");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const selectedUri = result.assets[0].uri;
      setOriginalImageUri(selectedUri);
      setImageUri(selectedUri);
      setImageProcessed(false);
      setAiAnalyzed(false);
      
      processImageWithAI(selectedUri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(
          "Permission Required",
          "Camera access was denied. Please enable it in Settings to take photos.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openSettings },
          ]
        );
      } else {
        Alert.alert("Permission Required", "Please allow access to your camera to take photos.");
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const selectedUri = result.assets[0].uri;
      setOriginalImageUri(selectedUri);
      setImageUri(selectedUri);
      setImageProcessed(false);
      setAiAnalyzed(false);
      
      processImageWithAI(selectedUri);
    }
  };

  const toggleSeason = (season: ClothingSeason) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (seasons.includes(season)) {
      setSeasons(seasons.filter(s => s !== season));
    } else {
      setSeasons([...seasons, season]);
    }
  };

  const toggleOccasion = (occasion: ClothingOccasion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (occasions.includes(occasion)) {
      setOccasions(occasions.filter(o => o !== occasion));
    } else {
      setOccasions([...occasions, occasion]);
    }
  };

  const handleSave = async () => {
    if (!imageUri) {
      Alert.alert("Missing Photo", "Please add a photo of your item.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please give your item a name.");
      return;
    }
    if (!category) {
      Alert.alert("Missing Category", "Please select a category for your item.");
      return;
    }
    if (!color) {
      Alert.alert("Missing Color", "Please select a primary color for your item.");
      return;
    }
    if (seasons.length === 0) {
      Alert.alert("Missing Season", "Please select at least one season for your item.");
      return;
    }
    if (occasions.length === 0) {
      Alert.alert("Missing Occasion", "Please select at least one occasion for your item.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newItemId = await addItem({
        imageUri,
        originalImageUri: originalImageUri || imageUri,
        imageProcessed,
        name: name.trim(),
        category,
        color,
        seasons,
        occasions,
        brand: brand.trim() || undefined,
        notes: notes.trim() || undefined,
        origin,
        aiAnalyzed,
        isFavorite: false,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        "Item Added",
        `${name.trim()} has been added to your wardrobe. Would you like to plan an outfit with it?`,
        [
          {
            text: "Not Now",
            style: "cancel",
            onPress: () => navigation.goBack(),
          },
          {
            text: "Plan Outfit",
            onPress: () => {
              navigation.replace('OutfitCalendar');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add item to wardrobe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSave = imageUri && name.trim() && category && color && seasons.length > 0 && occasions.length > 0;

  const scrollViewProps = {
    style: styles.scrollView,
    contentContainerStyle: [styles.content, { paddingBottom: insets.bottom + Spacing.xl }],
    keyboardShouldPersistTaps: "handled" as const,
    showsVerticalScrollIndicator: false,
  };

  const ScrollContainer = Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Add to Wardrobe</ThemedText>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSubmitting}
          style={[
            styles.headerButton,
            {
              backgroundColor: canSave ? theme.link : theme.backgroundDefault,
              opacity: isSubmitting ? 0.5 : 1,
            },
          ]}
        >
          <Feather name="check" size={20} color={canSave ? "#FFFFFF" : theme.tabIconDefault} />
        </Pressable>
      </View>

      <ScrollContainer {...scrollViewProps}>
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Photo</ThemedText>
          {imageUri ? (
            <View>
              <Pressable onPress={handlePickImage} disabled={isProcessingImage} style={styles.imageContainer}>
                <View style={[styles.imageWrapper, { backgroundColor: '#FFFFFF' }]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.selectedImage, imageProcessed && { backgroundColor: '#FFFFFF' }]}
                    contentFit={imageProcessed ? "contain" : "cover"}
                  />
                </View>
                {isProcessingImage && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <ThemedText type="body" style={styles.processingText}>
                      Removing background...
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.changeImageBadge, { backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="edit-2" size={16} color={theme.text} />
                </View>
                {imageProcessed && !isProcessingImage && (
                  <View style={[styles.processedBadge, { backgroundColor: '#10B981' }]}>
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <ThemedText type="caption" style={{ color: "#FFFFFF", marginLeft: 4 }}>
                      Pro Quality
                    </ThemedText>
                  </View>
                )}
                {aiAnalyzed ? (
                  <View style={[styles.aiAnalyzedBadge, { backgroundColor: theme.link }]}>
                    <Feather name="zap" size={14} color="#FFFFFF" />
                    <ThemedText type="caption" style={{ color: "#FFFFFF", marginLeft: 4 }}>
                      AI Analyzed
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
              {originalImageUri && imageProcessed && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (imageUri === originalImageUri) {
                      processImageWithAI(originalImageUri);
                    } else {
                      setImageUri(originalImageUri);
                      setImageProcessed(false);
                    }
                  }}
                  style={[styles.toggleImageButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather 
                    name={imageUri === originalImageUri ? "zap" : "image"} 
                    size={16} 
                    color={theme.tabIconDefault} 
                  />
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: 6 }}>
                    {imageUri === originalImageUri ? "Reprocess image" : "View original"}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={handleAIScan}
                disabled={isAnalyzing || isProcessingImage}
                style={[
                  styles.aiScanButton,
                  {
                    backgroundColor: isAnalyzing || isProcessingImage ? theme.backgroundDefault : theme.link,
                    opacity: isAnalyzing || isProcessingImage ? 0.7 : 1,
                  },
                ]}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Feather name="zap" size={20} color={isProcessingImage ? theme.tabIconDefault : "#FFFFFF"} />
                )}
                <ThemedText
                  type="body"
                  style={{ color: isAnalyzing || isProcessingImage ? theme.text : "#FFFFFF", marginLeft: Spacing.sm }}
                >
                  {isAnalyzing ? "Analyzing..." : "Scan with AI"}
                </ThemedText>
              </Pressable>
              <ThemedText type="caption" style={[styles.aiHintText, { color: theme.tabIconDefault }]}>
                AI will auto-fill item details from screenshots or photos
              </ThemedText>
              <View style={styles.visualGuideContainer}>
                <ThemedText type="small" style={[styles.photoTipsTitle, { color: theme.text }]}>
                  Photo guide
                </ThemedText>
                <View style={styles.visualExamplesRow}>
                  <View style={styles.visualExampleCard}>
                    <View style={[styles.visualBadge, { backgroundColor: '#10B981' }]}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                    <Image
                      source={require('@/assets/images/clothing-tips-correct.png')}
                      style={styles.visualExampleImage}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.visualExampleCard}>
                    <View style={[styles.visualBadge, { backgroundColor: '#E57373' }]}>
                      <Feather name="x" size={10} color="#FFFFFF" />
                    </View>
                    <Image
                      source={require('@/assets/images/clothing-tips-incorrect.png')}
                      style={styles.visualExampleImage}
                      contentFit="cover"
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.imagePickerRow}>
                <Pressable
                  onPress={handlePickImage}
                  style={[styles.imagePickerButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="image" size={32} color={theme.tabIconDefault} />
                  <ThemedText type="body">Gallery</ThemedText>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <Pressable
                    onPress={handleTakePhoto}
                    style={[styles.imagePickerButton, { backgroundColor: theme.backgroundDefault }]}
                  >
                    <Feather name="camera" size={32} color={theme.tabIconDefault} />
                    <ThemedText type="body">Camera</ThemedText>
                  </Pressable>
                ) : (
                  <View style={[styles.imagePickerButton, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="smartphone" size={32} color={theme.tabIconDefault} />
                    <ThemedText type="caption" style={{ textAlign: "center" }}>
                      Use Expo Go for camera
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.visualGuideContainer}>
                <ThemedText type="small" style={[styles.photoTipsTitle, { color: theme.text }]}>
                  Photo guide
                </ThemedText>
                <View style={styles.visualExamplesRow}>
                  <View style={styles.visualExampleCard}>
                    <View style={[styles.visualBadge, { backgroundColor: '#10B981' }]}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                    <Image
                      source={require('@/assets/images/clothing-tips-correct.png')}
                      style={styles.visualExampleImage}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.visualExampleCard}>
                    <View style={[styles.visualBadge, { backgroundColor: '#E57373' }]}>
                      <Feather name="x" size={10} color="#FFFFFF" />
                    </View>
                    <Image
                      source={require('@/assets/images/clothing-tips-incorrect.png')}
                      style={styles.visualExampleImage}
                      contentFit="cover"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Item Type</ThemedText>
          <View style={styles.originSelector}>
            {(['owned', 'inspiration', 'wishlist'] as ItemOrigin[]).map((originOption) => {
              const isSelected = origin === originOption;
              const iconMap: Record<ItemOrigin, keyof typeof Feather.glyphMap> = {
                owned: 'check-circle',
                inspiration: 'eye',
                wishlist: 'heart',
              };
              return (
                <Pressable
                  key={originOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setOrigin(originOption);
                  }}
                  style={[
                    styles.originOption,
                    {
                      backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
                      borderColor: isSelected ? theme.link : theme.backgroundDefault,
                    },
                  ]}
                >
                  <Feather
                    name={iconMap[originOption]}
                    size={18}
                    color={isSelected ? "#FFFFFF" : theme.tabIconDefault}
                  />
                  <ThemedText
                    type="body"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      marginLeft: Spacing.xs,
                    }}
                    numberOfLines={1}
                  >
                    {ORIGIN_LABELS[originOption]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="caption" style={[styles.originHintText, { color: theme.tabIconDefault }]}>
            {origin === 'owned' && "Items you own and can wear"}
            {origin === 'inspiration' && "Style inspiration from screenshots or online finds"}
            {origin === 'wishlist' && "Items you want to purchase"}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Name</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Blue Denim Jacket"
            placeholderTextColor={theme.tabIconDefault}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
              },
            ]}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Category</ThemedText>
          <View style={styles.optionsGrid}>
            {categoryOptions.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategory(cat.key);
                }}
                style={[
                  styles.categoryOption,
                  {
                    backgroundColor: category === cat.key ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                {cat.iconSet === 'material' ? (
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={22}
                    color={category === cat.key ? "#FFFFFF" : theme.tabIconDefault}
                  />
                ) : (
                  <Feather
                    name={cat.icon as any}
                    size={20}
                    color={category === cat.key ? "#FFFFFF" : theme.tabIconDefault}
                  />
                )}
                <ThemedText
                  type="caption"
                  style={{
                    color: category === cat.key ? "#FFFFFF" : theme.text,
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {CATEGORY_LABELS[cat.key].split(" ")[0]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Primary Color</ThemedText>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map((col) => (
              <Pressable
                key={col}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setColor(col);
                }}
                style={[
                  styles.colorOption,
                  {
                    backgroundColor: getColorHex(col),
                    borderWidth: color === col ? 3 : 1,
                    borderColor: color === col ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                {color === col ? (
                  <Feather name="check" size={16} color={col === 'white' || col === 'beige' || col === 'yellow' ? '#000' : '#FFF'} />
                ) : null}
              </Pressable>
            ))}
          </View>
          {color ? (
            <ThemedText type="caption" style={styles.selectedColorLabel}>
              Selected: {COLOR_LABELS[color]}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Seasons</ThemedText>
          <View style={styles.chipGrid}>
            {SEASON_OPTIONS.map((season) => (
              <Pressable
                key={season}
                onPress={() => toggleSeason(season)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: seasons.includes(season) ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: seasons.includes(season) ? "#FFFFFF" : theme.text,
                  }}
                >
                  {SEASON_LABELS[season]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Occasions</ThemedText>
          <View style={styles.chipGrid}>
            {OCCASION_OPTIONS.map((occasion) => (
              <Pressable
                key={occasion}
                onPress={() => toggleOccasion(occasion)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: occasions.includes(occasion) ? theme.link : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: occasions.includes(occasion) ? "#FFFFFF" : theme.text,
                  }}
                >
                  {OCCASION_LABELS[occasion]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Brand (Optional)</ThemedText>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Zara, H&M, Nike"
            placeholderTextColor={theme.tabIconDefault}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
              },
            ]}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Notes (Optional)</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes about this item..."
            placeholderTextColor={theme.tabIconDefault}
            multiline
            numberOfLines={3}
            style={[
              styles.textAreaInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
              },
            ]}
          />
        </View>
      </ScrollContainer>
    </View>
  );
}

function getColorHex(color: ClothingColor): string {
  const colorMap: Record<ClothingColor, string> = {
    black: '#000000',
    white: '#FFFFFF',
    gray: '#808080',
    navy: '#001F3F',
    brown: '#8B4513',
    beige: '#F5F5DC',
    red: '#DC143C',
    pink: '#FF69B4',
    orange: '#FF8C00',
    yellow: '#FFD700',
    green: '#228B22',
    blue: '#4169E1',
    purple: '#9932CC',
    multicolor: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 50%, #FFE66D 100%)',
  };
  return colorMap[color] || '#808080';
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
  content: {
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  imagePickerRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  imagePickerButton: {
    flex: 1,
    height: 120,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
  },
  changeImageBadge: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  textAreaInput: {
    minHeight: 100,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    textAlignVertical: "top",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 3) / 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedColorLabel: {
    marginTop: Spacing.sm,
    opacity: 0.7,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  aiScanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  aiHintText: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  photoTipsCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  photoTipsTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  visualGuideContainer: {
    marginTop: Spacing.md,
  },
  visualExamplesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  visualExampleCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  visualExampleImage: {
    width: "100%",
    height: 80,
    borderRadius: BorderRadius.md,
  },
  visualBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  aiAnalyzedBadge: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  processedBadge: {
    position: "absolute",
    top: Spacing.md + 32,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
  },
  processingText: {
    color: "#FFFFFF",
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  toggleImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    alignSelf: "center",
  },
  originSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  originOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  originHintText: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
