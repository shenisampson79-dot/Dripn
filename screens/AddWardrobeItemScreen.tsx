import React, { useState, useEffect, useMemo } from "react";
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
  Modal,
  FlatList,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  getManualAddCategoryTabs,
  resolveUserPresentationGender,
} from '@/utils/wardrobeCategories';
import { onboardingProfileService } from '@/services/OnboardingProfileService';
import { wardrobeImageBackground } from "@/utils/wardrobeImage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
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
import { describeBulkAnalyzeFailure, getPhotoTips } from "@/services/WardrobeDigitizationService";
import { getClothingUploadComparisons } from "@/constants/uploadGuideExamples";
import * as FileSystem from "expo-file-system/legacy";
import { UploadGuideComparisonTable } from "@/components/UploadGuideComparisonTable";
import { sanitizeWardrobeItemName, reconcileWardrobeBrandName } from "@/utils/wardrobeItemName";
import {
  getOutfitReelImageScale,
  getOutfitReelPreviewAspectRatio,
} from "@/utils/outfitReelImage";
import {
  canOfferOutfitPlanning,
  countWardrobeOutfitBasics,
  describeOutfitPlanningGap,
} from "@/utils/wardrobeOutfitReadiness";
import { useTranslations } from "@/contexts/TranslationContext";
import {
  correctWardrobeImageOrientation,
  promptWardrobeOrientationReview,
  rotateWardrobeImage,
} from "@/utils/wardrobeImageOrientation";
import { permanentWardrobePhotoPath } from "@/utils/persistWardrobePhoto";
import { invalidateWardrobeImageCache } from "@/utils/wardrobeImageLoader";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  findLocalWardrobeDuplicates,
  formatDuplicateNames,
  normalizeDuplicateDecision,
  type DuplicateMatch,
  type NormalizedDuplicateDecision,
} from "@/utils/wardrobeDuplicateMatch";
import { DuplicateComparisonSheet } from "@/components/wardrobe/DuplicateComparisonSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PhotoSource = "camera" | "gallery";

async function clearStaleAddPreviewCache() {
  invalidateWardrobeImageCache("preview");
  const path = permanentWardrobePhotoPath("preview");
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // Non-fatal — leftover preview.jpg from older builds
  }
}

type AddWardrobeItemScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "AddWardrobeItem">;
};

const getCategoryOptions = (gender: ReturnType<typeof resolveUserPresentationGender>) =>
  getManualAddCategoryTabs(gender);

const COLOR_OPTIONS: ClothingColor[] = [
  'black', 'white', 'gray', 'navy', 'brown', 'beige',
  'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor',
];

const SEASON_OPTIONS: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];

const OCCASION_OPTIONS: ClothingOccasion[] = [
  'casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday',
];

export default function AddWardrobeItemScreen({ navigation }: AddWardrobeItemScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const { addItem, items } = useWardrobe();
  const { user } = useAuth();
  const [onboardingProfile, setOnboardingProfile] = useState<Awaited<ReturnType<typeof onboardingProfileService.getProfile>> | null>(null);

  useEffect(() => {
    onboardingProfileService.getProfile().then(setOnboardingProfile).catch(() => {});
  }, []);

  const presentationGender = resolveUserPresentationGender(user, onboardingProfile);
  const categoryOptions = getCategoryOptions(presentationGender);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource>("gallery");
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
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [dupeSheet, setDupeSheet] = useState<{
    visible: boolean;
    decision: NormalizedDuplicateDecision;
  }>({ visible: false, decision: { type: 'ok', matches: [], isDuplicate: false } });
  const photoTips = getPhotoTips();
  const clothingPhotoTips = useMemo(
    () => getClothingUploadComparisons(user?.gender),
    [user?.gender],
  );

  const beginImageImport = async (asset: ImagePicker.ImagePickerAsset, source: PhotoSource) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await clearStaleAddPreviewCache();
    setPhotoSource(source);
    try {
      const corrected = await correctWardrobeImageOrientation(asset.uri, asset);
      setOriginalImageUri(corrected.uri);
      setImageUri(corrected.uri);
      setImageProcessed(false);
      setAiAnalyzed(false);

      promptWardrobeOrientationReview(corrected, (uri) => {
        setOriginalImageUri(uri);
        setImageUri(uri);
        processImageWithAI(uri);
      });
    } catch (error) {
      console.warn('[AddWardrobeItem] Orientation correction failed:', error);
      setOriginalImageUri(asset.uri);
      setImageUri(asset.uri);
      setImageProcessed(false);
      setAiAnalyzed(false);
      processImageWithAI(asset.uri);
    }
  };

  const handleRotatePhoto = async () => {
    if (!imageUri || isProcessingImage) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const rotated = await rotateWardrobeImage(imageUri, 90);
      await clearStaleAddPreviewCache();
      setImageUri(rotated.uri);
      setOriginalImageUri(rotated.uri);
      setImageProcessed(false);
      setAiAnalyzed(false);
    } catch (error) {
      Alert.alert(t('wardrobe.rotateFailed'), t('wardrobe.couldNotRotatePhotoTryAnother'));
    }
  };

  const toJpegBase64 = async (uri: string): Promise<{ base64: string; correctedUri: string }> => {
    if (uri.startsWith('data:')) return { base64: uri.split(',')[1], correctedUri: uri };
    // Remote URLs (e.g. Replicate CDN after background removal) — cannot read as local file
    if (uri.startsWith('http')) return { base64: '', correctedUri: uri };
    if (Platform.OS !== 'web') {
      try {
        const r = await ImageManipulator.manipulateAsync(
          uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        const base64 = await FileSystem.readAsStringAsync(r.uri, { encoding: 'base64' });
        return { base64, correctedUri: r.uri };
      } catch (_) {}
    }
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return { base64, correctedUri: uri };
  };

  const applyClothingAnalysis = (analysis: {
    type?: string;
    color?: string;
    style?: string;
    material?: string;
    brand?: string;
    features?: string[];
    occasions?: string[];
    seasons?: string[];
    description?: string;
  }) => {
    const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear_tops', 'activewear_bottoms', 'swimwear', 'sleepwear', 'formal'];
    const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'denim', 'cream', 'multicolor'];
    const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
    const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];

    const typeToCategory: Record<string, ClothingCategory> = {
      'shirt': 'tops', 'blouse': 'tops', 't-shirt': 'tops', 'top': 'tops', 'sweater': 'tops', 'hoodie': 'tops',
      'pants': 'bottoms', 'jeans': 'bottoms', 'shorts': 'bottoms', 'skirt': 'bottoms', 'trousers': 'bottoms',
      'dress': 'dresses', 'gown': 'dresses', 'jumpsuit': 'dresses', 'romper': 'dresses',
      'jacket': 'outerwear', 'coat': 'outerwear', 'blazer': 'outerwear', 'cardigan': 'outerwear', 'suit': 'formal',
      'gilet': 'outerwear', 'vest': 'outerwear', 'puffer': 'outerwear',
      'shoes': 'shoes', 'sneakers': 'shoes', 'boots': 'shoes', 'heels': 'shoes', 'sandals': 'shoes',
      'bag': 'bags', 'purse': 'bags', 'backpack': 'bags', 'handbag': 'bags',
      'watch': 'accessories', 'jewelry': 'accessories', 'belt': 'accessories', 'hat': 'accessories', 'scarf': 'accessories',
      'jersey': 'activewear_tops', 'sports shirt': 'activewear_tops', 'athletic top': 'activewear_tops',
      'sports top': 'activewear_tops', 'gym top': 'activewear_tops', 'training top': 'activewear_tops',
      'track pants': 'activewear_bottoms', 'joggers': 'activewear_bottoms', 'leggings': 'activewear_bottoms',
      'sweatpants': 'activewear_bottoms', 'gym shorts': 'activewear_bottoms', 'training pants': 'activewear_bottoms',
      'running shorts': 'activewear_bottoms', 'athletic pants': 'activewear_bottoms',
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
  };

  const processImageWithAI = async (uri: string) => {
    setIsProcessingImage(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { base64: imageBase64, correctedUri } = await toJpegBase64(uri);
      if (correctedUri !== uri) {
        setImageUri(correctedUri);
      }

      if (!imageBase64) {
        setImageProcessed(false);
        return correctedUri || uri;
      }

      // Preview must call rembg directly — extract-clothing/resilient never returns a cutout.
      // Analysis runs in parallel and never overwrites the user's photo with another item.
      const [bgOutcome, extractOutcome] = await Promise.allSettled([
        apiService.removeBackground(imageBase64),
        apiService.extractClothing({ imageBase64 }),
      ]);

      let nextUri = correctedUri || uri;
      let didRemoveBg = false;

      if (bgOutcome.status === 'fulfilled') {
        const bg = bgOutcome.value;
        if (bg?.removed !== false && bg?.imageUrl) {
          nextUri = bg.imageUrl;
          didRemoveBg = true;
          setImageUri(bg.imageUrl);
          setImageProcessed(true);
        } else {
          setImageProcessed(false);
        }
      } else {
        console.log('Background removal failed, keeping original photo:', bgOutcome.reason?.message || bgOutcome.reason);
        setImageProcessed(false);
      }

      if (extractOutcome.status === 'fulfilled') {
        const analysis = extractOutcome.value?.clothingAnalysis;
        // Autofill labels only — never swap imageUri from analysis / wardrobe matches.
        if (analysis) {
          applyClothingAnalysis(analysis);
        }
      } else {
        console.log('Clothing analysis failed:', extractOutcome.reason?.message || extractOutcome.reason);
      }

      if (didRemoveBg) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return nextUri;
    } catch (error: any) {
      console.log('Image processing not available, using original image:', error.message);
      setImageProcessed(false);
      return uri;
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRetryBackgroundRemoval = async () => {
    const source = originalImageUri || imageUri;
    if (!source || isProcessingImage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await processImageWithAI(source);
  };

  const handleAIScan = async () => {
    if (!imageUri) return;
    
    setIsAnalyzing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear_tops', 'activewear_bottoms', 'swimwear', 'sleepwear', 'formal'];
    const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'denim', 'cream', 'multicolor'];
    const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
    const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];
    
    try {
      const { base64: imageBase64 } = await toJpegBase64(imageUri);

      if (!imageBase64 || imageBase64.length < 100) {
        throw new Error('Could not read this photo. Try taking a new picture or picking a different image.');
      }

      const result = await apiService.analyzeGarmentPhoto(imageBase64) as any;
      
      // Debug log to see what API returns
      console.log('[AI Analysis] Full API result:', JSON.stringify(result, null, 2));
      
      // Handle guest limit reached
      if (!result.success && result.errorCode === 'GUEST_LIMIT_REACHED') {
        setIsAnalyzing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          t('wardrobe.freeScansUsed'),
          result.message || t('wardrobe.freeScansUsedDefault'),
          [
            { text: t('common.maybeLater'), style: "cancel" },
            { 
              text: t('common.signUp'), 
              style: "default",
              onPress: () => navigation.navigate('Auth' as any)
            }
          ]
        );
        return;
      }
      
      // Track guest mode and scans remaining
      if (result.authMode === 'guest') {
        setIsGuest(true);
        if (typeof result.scansRemaining === 'number') {
          setScansRemaining(result.scansRemaining);
        }
      }
      
      // The deployed backend returns flat fields at the top level of result
      // AND a nested result.analysis.item object — prefer the flat top-level fields
      // since those are already normalised strings (e.g. color = "black" not { primary: "black" })
      const nested = result.analysis?.item || result.analysis || {};
      const analysis = {
        name:        result.name        || result.suggestedName  || result.itemName    || result.detectedName || nested.name,
        category:    result.category    || result.garmentType    || nested.category,
        color:       result.color       || result.colorTag       || result.primaryColor || result.detectedColor
                     || (typeof nested.color === 'string' ? nested.color : nested.color?.primary),
        seasons:     result.seasons     || result.season         || nested.seasons      || nested.season,
        occasions:   result.occasions   || nested.occasions,
        brand:       result.brand       || nested.brand,
        description: result.styleNotes  || result.style_notes    || result.analysis?.styleNotes || nested.description,
      };
      
      console.log('[AI Analysis] Normalised analysis:', JSON.stringify(analysis, null, 2));
      
      // Color mapping for API values that don't match our predefined colors
      const colorMap: Record<string, ClothingColor> = {
        olive: 'green',
        khaki: 'beige',
        tan: 'beige',
        charcoal: 'gray',
        ivory: 'cream',
        burgundy: 'red',
        maroon: 'red',
        coral: 'pink',
        teal: 'blue',
        turquoise: 'blue',
        sage: 'green',
        forest: 'green',
        mint: 'green',
        lavender: 'purple',
        magenta: 'pink',
        gold: 'yellow',
        silver: 'gray',
        copper: 'brown',
        rust: 'orange',
        terracotta: 'orange',
        camel: 'brown',
        chocolate: 'brown',
        taupe: 'beige',
        slate: 'gray',
        indigo: 'navy',
        cobalt: 'blue',
        emerald: 'green',
        ruby: 'red',
        sapphire: 'blue',
        wine: 'red',
        blush: 'pink',
        nude: 'beige',
        sand: 'beige',
        stone: 'gray',
        ash: 'gray',
        midnight: 'navy',
        sky: 'blue',
        aqua: 'blue',
        plum: 'purple',
        violet: 'purple',
        rose: 'pink',
        peach: 'orange',
        mauve: 'pink',
        lilac: 'purple',
        chartreuse: 'green',
        mustard: 'yellow',
        lemon: 'yellow',
      };
      
      // Season mapping for API values
      const seasonMap: Record<string, ClothingSeason> = {
        fall: 'autumn',
        'all-year': 'all-season',
        'all year': 'all-season',
        'all season': 'all-season',
        'all seasons': 'all-season',
        allseason: 'all-season',
        'year-round': 'all-season',
        'year round': 'all-season',
      };
      
      // Occasion mapping for API values
      const occasionMap: Record<string, ClothingOccasion> = {
        sport: 'workout',
        sports: 'workout',
        gym: 'workout',
        sportswear: 'workout',
        athletic: 'workout',
        exercise: 'workout',
        'smart-casual': 'casual',
        'smart casual': 'casual',
        outdoor: 'casual',
        outdoors: 'casual',
        travel: 'vacation',
        office: 'work',
        professional: 'work',
        business: 'work',
        evening: 'date-night',
        night: 'date-night',
        'night out': 'date-night',
        nightout: 'date-night',
        beach: 'vacation',
        lounge: 'casual',
        loungewear: 'casual',
        special: 'formal',
        'special occasion': 'formal',
        wedding: 'formal',
        gala: 'formal',
        cocktail: 'party',
        festival: 'party',
        club: 'party',
        brunch: 'casual',
        daily: 'everyday',
        day: 'everyday',
        daytime: 'everyday',
      };
      
      if (analysis) {
        console.log('[AI Analysis] Setting fields from analysis...');
        const analysisFields = analysis as typeof analysis & {
          suggestedName?: string;
          itemName?: string;
          colorTag?: string;
          primaryColor?: string;
        };
        
        // Handle name - check multiple field variations
        const itemName = analysisFields.name || analysisFields.suggestedName || analysisFields.itemName;
        const itemColor = analysisFields.color || analysisFields.colorTag || analysisFields.primaryColor;
        if (itemName) {
          const withBrand = analysis.brand
            ? reconcileWardrobeBrandName(itemName, analysis.brand)
            : itemName;
          const cleaned = sanitizeWardrobeItemName(withBrand, {
            color: itemColor,
            brand: analysis.brand,
          });
          console.log('[AI Analysis] Setting name:', cleaned);
          setName(cleaned);
        }
        
        // Handle category — map generic 'activewear' to subcategory based on item name
        if (analysis.category) {
          const cat = analysis.category.toLowerCase();
          const nameForMapping = (itemName || '').toLowerCase();
          console.log('[AI Analysis] Category from API:', cat);
          
          let resolvedCategory: ClothingCategory | null = null;
          
          if (cat === 'activewear') {
            // Determine if top or bottom by inspecting the item name
            const bottomKeywords = ['pants', 'shorts', 'joggers', 'leggings', 'sweatpants', 'bottoms', 'tights', 'track pant', 'running pant'];
            const isBottom = bottomKeywords.some(kw => nameForMapping.includes(kw));
            resolvedCategory = isBottom ? 'activewear_bottoms' : 'activewear_tops';
          } else if (validCategories.includes(cat as ClothingCategory)) {
            resolvedCategory = cat as ClothingCategory;
          }
          
          if (resolvedCategory) setCategory(resolvedCategory);
        }
        
        // Handle color - check multiple field variations and map if needed
        const apiColor = (analysisFields.color || analysisFields.colorTag || '').toLowerCase();
        if (apiColor) {
          console.log('[AI Analysis] Color from API:', apiColor);
          let mappedColor: ClothingColor | null = null;
          
          if (validColors.includes(apiColor as ClothingColor)) {
            mappedColor = apiColor as ClothingColor;
          } else if (colorMap[apiColor]) {
            mappedColor = colorMap[apiColor];
            console.log('[AI Analysis] Mapped color:', apiColor, '->', mappedColor);
          }
          
          if (mappedColor) {
            setColor(mappedColor);
          }
        }
        
        // Handle seasons - map values like "fall" to "autumn"
        if (analysis.seasons && analysis.seasons.length > 0) {
          console.log('[AI Analysis] Seasons from API:', analysis.seasons);
          const mappedSeasons = analysis.seasons
            .map((s: string) => {
              const lower = s.toLowerCase();
              if (validSeasons.includes(lower as ClothingSeason)) return lower;
              if (seasonMap[lower]) return seasonMap[lower];
              return null;
            })
            .filter((s: ClothingSeason | null): s is ClothingSeason => s !== null);
          
          if (mappedSeasons.length > 0) {
            console.log('[AI Analysis] Setting mapped seasons:', mappedSeasons);
            setSeasons(mappedSeasons);
          }
        }
        
        // Handle occasions - map values like "outdoor" to "casual"
        if (analysis.occasions && analysis.occasions.length > 0) {
          console.log('[AI Analysis] Occasions from API:', analysis.occasions);
          const mappedOccasions = analysis.occasions
            .map((o: string) => {
              const lower = o.toLowerCase();
              if (validOccasions.includes(lower as ClothingOccasion)) return lower;
              if (occasionMap[lower]) return occasionMap[lower];
              return null;
            })
            .filter((o: ClothingOccasion | null): o is ClothingOccasion => o !== null);
          
          if (mappedOccasions.length > 0) {
            console.log('[AI Analysis] Setting mapped occasions:', mappedOccasions);
            setOccasions(mappedOccasions);
          }
        }
        
        // Handle brand
        if (analysis.brand) {
          console.log('[AI Analysis] Setting brand:', analysis.brand);
          setBrand(analysis.brand);
        }
        
        // Handle description/notes
        if (analysis.description) {
          console.log('[AI Analysis] Setting notes:', analysis.description);
          setNotes(analysis.description);
        }
        
        setAiAnalyzed(true);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Show scans remaining for guests
        const remainingScans = result.scansRemaining;
        const scansMessage = result.authMode === 'guest' && typeof remainingScans === 'number'
          ? `\n\n${remainingScans} free scan${remainingScans !== 1 ? 's' : ''} remaining`
          : '';
        
        Alert.alert(
          t('wardrobe.aiAnalysisComplete'),
          t('wardrobe.aiAnalysisCompleteMessage')
            .replace('{name}', itemName || t('wardrobe.fashionItem'))
            .replace('{scans}', scansMessage),
          [{ text: t('common.gotIt'), style: "default" }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(t('wardrobe.analysisIssue') || "Analysis Issue", t('wardrobe.couldNotAnalyzeImagePleaseFillInTheDetai') || "Could not analyze image. Please fill in the details manually.",
          [{ text: t('common.ok'), style: "default" }]
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const failure = describeBulkAnalyzeFailure(error?.message);
      Alert.alert(
        failure.title,
        failure.message || "Failed to analyze image. Please try again or fill in details manually.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openSettings = async () => {
    if (Platform.OS !== "web") {
      try {
        await Linking.openSettings();
      } catch (error) {
        Alert.alert(t('wardrobe.error') || "Error", t('wardrobe.couldNotOpenSettingsPleaseEnablePermissi') || "Could not open settings. Please enable permissions manually.");
      }
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.photoLibraryAccessWasDeniedPleaseEnableI') || "Photo library access was denied. Please enable it in Settings to add images.",
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.openSettings'), onPress: openSettings },
          ]
        );
      } else {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourPhotoLibraryToAdd') || "Please allow access to your photo library to add images.");
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      await beginImageImport(result.assets[0], "gallery");
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      if (!permissionResult.canAskAgain && Platform.OS !== "web") {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.cameraAccessWasDeniedPleaseEnableItInSet') || "Camera access was denied. Please enable it in Settings to take photos.",
          [
            { text: t('common.cancel'), style: "cancel" },
            { text: t('common.openSettings'), onPress: openSettings },
          ]
        );
      } else {
        Alert.alert(t('wardrobe.permissionRequired') || "Permission Required", t('wardrobe.pleaseAllowAccessToYourCameraToTakePhoto') || "Please allow access to your camera to take photos.");
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      await beginImageImport(result.assets[0], "camera");
    }
  };

  const handleRetakePhoto = async () => {
    if (isProcessingImage) return;
    if (photoSource === "camera" && Platform.OS !== "web") {
      await handleTakePhoto();
      return;
    }
    await handlePickImage();
  };

  const handleEditPhotoOptions = () => {
    if (isProcessingImage) return;
    const buttons: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[] = [];

    if (Platform.OS !== "web") {
      buttons.push({
        text: "Retake with camera",
        onPress: () => {
          void handleTakePhoto();
        },
      });
    }
    buttons.push({
      text: "Choose from gallery",
      onPress: () => {
        void handlePickImage();
      },
    });
    buttons.push({
      text: "Rotate 90°",
      onPress: () => {
        void handleRotatePhoto();
      },
    });
    buttons.push({ text: t('common.cancel') || "Cancel", style: "cancel" });

    Alert.alert(
      "Edit photo",
      "Retake keeps your new shot. We never replace it with another wardrobe item.",
      buttons,
    );
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

  const handleSave = async (opts?: { allowDuplicate?: boolean }) => {
    const missingFields: string[] = [];
    if (!imageUri) missingFields.push("Photo");
    if (!name.trim()) missingFields.push("Name");
    if (!category) missingFields.push("Category");
    if (!color) missingFields.push("Color");
    if (seasons.length === 0) missingFields.push("Season");
    if (occasions.length === 0) missingFields.push("Occasion");
    
    if (missingFields.length > 0) {
      Alert.alert(
        t('wardrobe.completeYourItem'),
        t('wardrobe.pleaseFillIn').replace('{fields}', missingFields.join(", ")),
        [{ text: t('common.ok') }]
      );
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('wardrobe.missingName') || "Missing Name", t('wardrobe.pleaseGiveYourItemAName') || "Please give your item a name.");
      return;
    }
    if (!category) {
      Alert.alert(t('wardrobe.missingCategory') || "Missing Category", t('wardrobe.pleaseSelectACategoryForYourItem') || "Please select a category for your item.");
      return;
    }
    if (!color) {
      Alert.alert(t('wardrobe.missingColor') || "Missing Color", t('wardrobe.pleaseSelectAPrimaryColorForYourItem') || "Please select a primary color for your item.");
      return;
    }
    if (seasons.length === 0) {
      Alert.alert(t('wardrobe.missingSeason') || "Missing Season", t('wardrobe.pleaseSelectAtLeastOneSeasonForYourItem') || "Please select at least one season for your item.");
      return;
    }
    if (occasions.length === 0) {
      Alert.alert(t('wardrobe.missingOccasion') || "Missing Occasion", t('wardrobe.pleaseSelectAtLeastOneOccasionForYourIte') || "Please select at least one occasion for your item.");
      return;
    }

    if (!imageUri) {
      Alert.alert(t('wardrobe.missingPhoto') || "Missing Photo", t('wardrobe.pleaseAddAPhotoForYourItem') || "Please add a photo for your item.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert image to base64 for backend processing
      const { base64: imageBase64 } = await toJpegBase64(imageUri);
      const sanitizedName = sanitizeWardrobeItemName(name.trim(), { color, brand: undefined });

      if (!opts?.allowDuplicate) {
        let decision: NormalizedDuplicateDecision = { type: 'ok', matches: [], isDuplicate: false };
        try {
          const check = await apiService.checkWardrobeDuplicates([{
            name: sanitizedName,
            category,
            color,
            brand: brand.trim() || undefined,
            imageBase64,
          }]);
          const first = check?.results?.[0];
          decision = normalizeDuplicateDecision({
            ...first,
            type: first?.type || first?.decision?.type,
            decision: first?.decision,
            similarMatches: first?.similarMatches,
          });
        } catch {
          const local = findLocalWardrobeDuplicates(
            { name: sanitizedName, category, color, brand: brand.trim() || undefined },
            items.map((it) => ({
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
          decision = normalizeDuplicateDecision({
            isDuplicate: local.length > 0,
            type: local.length > 0 ? 'duplicate' : 'ok',
            matches: local,
          });
        }

        if (decision.type === 'duplicate' || decision.type === 'already_owned' || decision.type === 'similar_item') {
          setIsSubmitting(false);
          setDupeSheet({ visible: true, decision });
          return;
        }
      }

      const newItem = await addItem({
        imageUri,
        originalImageUri: originalImageUri || imageUri,
        imageProcessed,
        imageBase64,
        name: sanitizedName,
        category,
        color,
        seasons,
        occasions,
        brand: brand.trim() || undefined,
        notes: notes.trim() || undefined,
        origin,
        aiAnalyzed,
        isFavorite: false,
        allowDuplicate: opts?.allowDuplicate === true,
      } as any);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const itemLabel = name.trim();

      if (origin === 'inspiration') {
        Alert.alert(
          t('wardrobe.savedToInspiration'),
          t('wardrobe.savedToInspirationMessage').replace('{name}', itemLabel),
          [{ text: t('common.done'), onPress: () => navigation.goBack() }],
        );
        return;
      }

      const wardrobeForCounts = [
        ...items.filter((item) => item.origin !== 'inspiration' && item.id !== newItem.id),
        newItem,
      ];
      const outfitCounts = countWardrobeOutfitBasics(wardrobeForCounts);

      if (canOfferOutfitPlanning(outfitCounts)) {
        if (FEATURE_FLAGS.launchSimplified) {
          Alert.alert(
            t('wardrobe.itemAdded'),
            t('wardrobe.itemAddedPlanOutfit').replace('{name}', itemLabel),
            [{ text: t('common.ok') || t('common.keepBuilding'), onPress: () => navigation.goBack() }],
          );
          return;
        }

        Alert.alert(
          t('wardrobe.itemAdded'),
          t('wardrobe.itemAddedPlanOutfit').replace('{name}', itemLabel),
          [
            {
              text: t('common.notNow'),
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
            {
              text: t('wardrobe.planOutfit'),
              onPress: () => {
                navigation.replace('OutfitCalendar');
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        t('wardrobe.itemAdded'),
        t('wardrobe.itemAddedGap')
          .replace('{name}', itemLabel)
          .replace('{gap}', describeOutfitPlanningGap(outfitCounts, t)),
        [{ text: t('common.keepBuilding'), onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      if (error?.duplicate || error?.error === 'DUPLICATE_WARDROBE_ITEM' || error?.status === 409) {
        const decision = normalizeDuplicateDecision({
          type: error?.type || error?.decision?.type || 'duplicate',
          isDuplicate: true,
          message: error?.message,
          matches: error?.matches || error?.decision?.matches,
          decision: error?.decision,
        });
        setDupeSheet({ visible: true, decision });
        return;
      }
      Alert.alert(t('wardrobe.error') || "Error", t('wardrobe.failedToAddItemToWardrobePleaseTryAgain') || "Failed to add item to wardrobe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSave = imageUri && name.trim() && category && color && seasons.length > 0 && occasions.length > 0;
  const outfitMixPreviewScale = useMemo(() => getOutfitReelImageScale(category), [category]);
  const outfitMixPreviewAspect = useMemo(() => getOutfitReelPreviewAspectRatio(), []);

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
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: canSave ? theme.link : theme.backgroundDefault,
              opacity: isSubmitting ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="check" size={20} color={canSave ? "#FFFFFF" : theme.tabIconDefault} />
        </Pressable>
      </View>

      <ScrollContainer {...scrollViewProps}>
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Photo</ThemedText>
          <ThemedText type="caption" style={[styles.outfitMixPreviewHint, { color: theme.tabIconDefault }]}>
            {photoSource === "camera"
              ? "Preview framing matches how this item will look in outfits. Tap the photo to retake with the camera if it looks too close or cut off."
              : "Preview framing matches how this item will look in outfits. Tap the photo to choose a different image if it looks too close or cut off."}
          </ThemedText>
          {imageUri ? (
            <View>
              <Pressable
                onPress={handleRetakePhoto}
                disabled={isProcessingImage}
                style={[styles.imageContainer, { aspectRatio: outfitMixPreviewAspect }]}
              >
                <View style={[
                  styles.imageWrapper,
                  wardrobeImageBackground(isDark, { imageUri, imageProcessed, aiAnalyzed: false })
                    ? { backgroundColor: wardrobeImageBackground(isDark, { imageUri, imageProcessed, aiAnalyzed: false }) }
                    : null,
                ]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={[
                      styles.selectedImage,
                      outfitMixPreviewScale !== 1
                        ? { transform: [{ scale: outfitMixPreviewScale }] }
                        : null,
                    ]}
                    contentFit="contain"
                    // Never disk-cache add-flow previews under a shared key — that swapped wrong photos on retake.
                    cachePolicy="none"
                    recyclingKey={imageUri}
                    transition={200}
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
                <Pressable
                  onPress={handleEditPhotoOptions}
                  disabled={isProcessingImage}
                  style={[styles.changeImageBadge, { backgroundColor: theme.backgroundDefault }]}
                  accessibilityLabel="Edit photo"
                  hitSlop={8}
                >
                  <Feather name="edit-2" size={16} color={theme.text} />
                </Pressable>
                {!isProcessingImage ? (
                  <Pressable
                    onPress={() => {
                      void handleRetryBackgroundRemoval();
                    }}
                    style={[styles.rotateImageBadge, { backgroundColor: theme.backgroundDefault }]}
                    accessibilityLabel="Retry background removal"
                    hitSlop={8}
                  >
                    <Feather name="refresh-cw" size={16} color={theme.text} />
                  </Pressable>
                ) : null}
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
                      void processImageWithAI(originalImageUri);
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
              {!imageProcessed && !isProcessingImage && originalImageUri ? (
                <Pressable
                  onPress={() => {
                    void handleRetryBackgroundRemoval();
                  }}
                  style={[styles.toggleImageButton, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="refresh-cw" size={16} color={theme.tabIconDefault} />
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginLeft: 6 }}>
                    Retry background removal
                  </ThemedText>
                </Pressable>
              ) : null}
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
              <View style={[styles.tipsSectionInline, { backgroundColor: theme.backgroundSecondary }]}>
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
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Item Type</ThemedText>
          <View style={styles.originSelector}>
            {(['owned', 'inspiration'] as const).map((originOption) => {
              const isSelected = origin === originOption;
              const iconMap: Record<'owned' | 'inspiration', keyof typeof Feather.glyphMap> = {
                owned: 'check-circle',
                inspiration: 'eye',
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
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Name</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('wardrobe.egBlueDenimJacket') || "e.g. Blue Denim Jacket"}
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
            placeholder={t('wardrobe.egZaraHmNike') || "e.g. Zara, H&M, Nike"}
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
            placeholder={t('wardrobe.anyAdditionalNotesAboutThisItem') || "Any additional notes about this item..."}
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

      <Modal
        visible={showPhotoTips}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPhotoTips(false)}
      >
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable
              onPress={() => setShowPhotoTips(false)}
              style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="x" size={20} color={theme.text} />
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
            contentContainerStyle={styles.photoTipsModalContent}
            renderItem={({ item }) => (
              <Card elevation={1} style={styles.photoTipsSection}>
                <View style={styles.photoTipsSectionHeader}>
                  <Feather name={item.icon as any} size={20} color={item.color} />
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    {item.title}
                  </ThemedText>
                </View>
                {item.items.map((tip, index) => (
                  <View key={index} style={styles.photoTipRow}>
                    <View style={[styles.photoTipBullet, { backgroundColor: item.color }]} />
                    <ThemedText type="body" style={styles.photoTipText}>{tip}</ThemedText>
                  </View>
                ))}
              </Card>
            )}
          />
        </View>
      </Modal>

      <DuplicateComparisonSheet
        visible={dupeSheet.visible}
        type={dupeSheet.decision.type}
        message={
          dupeSheet.decision.message
          || (dupeSheet.decision.type === 'similar_item'
            ? undefined
            : (t('wardrobe.alreadyHaveThisMessage') || 'This looks very similar to {names} in your wardrobe.')
              .replace('{names}', formatDuplicateNames(dupeSheet.decision.matches) || 'an existing item'))
        }
        candidateImageUri={imageUri}
        candidateLabel={name.trim() || 'New item'}
        matches={dupeSheet.decision.matches as DuplicateMatch[]}
        onClose={() => setDupeSheet((s) => ({ ...s, visible: false }))}
        onAddAnyway={() => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          void handleSave({ allowDuplicate: true });
        }}
        onContinue={() => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          void handleSave({ allowDuplicate: true });
        }}
        onViewExisting={(match) => {
          setDupeSheet((s) => ({ ...s, visible: false }));
          const existingId = match?.id;
          try {
            if (existingId != null) {
              (navigation as any).navigate('WardrobeItemDetail', { itemId: String(existingId) });
            } else {
              (navigation as any).navigate('Wardrobe');
            }
          } catch {
            (navigation as any).navigate('Wardrobe');
          }
        }}
      />
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
    denim: '#4682B4',
    cream: '#FFFDD0',
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
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  outfitMixPreviewHint: {
    marginBottom: Spacing.sm,
    lineHeight: 18,
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
  rotateImageBadge: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md + 44 + Spacing.sm,
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
  seeAllTipsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tipsSectionInline: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
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
  photoTipsModalContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  photoTipsSection: {
    marginBottom: Spacing.lg,
  },
  photoTipsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  photoTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  photoTipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  photoTipText: {
    flex: 1,
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
    ...StyleSheet.absoluteFill,
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
