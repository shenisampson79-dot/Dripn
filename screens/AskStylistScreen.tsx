import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Image,
  Alert,
  Modal,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";
import {
  decisionService,
  DecisionType,
  DecisionContext,
  DecisionRequest,
  DecisionResponse,
  DecisionAccessStatus,
  SecondOpinionResponse,
} from "@/services/DecisionService";
import { apiService } from "@/services/ApiService";
import { convertImageToBase64 } from "@/services/VisionAnalysisService";
import { ScrollView, ActivityIndicator } from "react-native";

interface FashionRule {
  id: number;
  title: string;
  content: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  gender: 'all' | 'women' | 'men';
  tags: string[];
  colorSwatches?: Array<{ name: string; hex: string }>;
}

interface FashionCategory {
  name: string;
  count: number;
  topics: string[];
}

interface ColorTrend {
  id?: string;
  name: string;
  hexCode: string;
  pantoneCode?: string;
  season?: string;
  year?: number;
  description?: string;
  pairingColors: string[];
  bestFor: string[];
  undertone?: 'warm' | 'cool' | 'neutral';
}

interface ColorOfTheYear {
  name: string;
  hexCode: string;
  pantoneCode?: string;
  description: string;
  pairingColors: string[];
  bestFor: string[];
  year: number;
}

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  obsidian: '#0D0B09',
};

type AskStylistScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function AskStylistScreen({ navigation }: AskStylistScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { translations } = useTranslations();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'type' | 'upload' | 'event-questions' | 'context' | 'response'>('type');
  const [selectedType, setSelectedType] = useState<DecisionType | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [contextNotes, setContextNotes] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<DecisionContext[]>([]);
  const [isSurpriseMe, setIsSurpriseMe] = useState(false);
  const [eventDetails, setEventDetails] = useState({
    eventType: '',
    dressCode: '',
    venue: '',
    timeOfDay: '',
  });
  const contextInputRef = useRef<TextInput>(null);
  const [accessStatus, setAccessStatus] = useState<DecisionAccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<DecisionResponse | null>(null);
  const [secondOpinion, setSecondOpinion] = useState<SecondOpinionResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [fashionRules, setFashionRules] = useState<FashionRule[]>([]);
  const [dailyRule, setDailyRule] = useState<FashionRule | null>(null);
  const [categories, setCategories] = useState<FashionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [showBlogSection, setShowBlogSection] = useState(false);

  const [colorOfTheYear, setColorOfTheYear] = useState<ColorOfTheYear | null>(null);
  const [seasonalPalette, setSeasonalPalette] = useState<ColorTrend[]>([]);
  const [showColorTrends, setShowColorTrends] = useState(false);

  const decisionTypes = decisionService.getDecisionTypes();
  const contextChips = decisionService.getContextChips();

  useEffect(() => {
    checkAccess();
    loadFashionBlog();
  }, []);

  const loadFashionBlog = async () => {
    try {
      const [dailyRes, categoriesRes] = await Promise.all([
        apiService.getDailyFashionRule(),
        apiService.getFashionRuleCategories(),
      ]);
      if (dailyRes && dailyRes.id && dailyRes.title) {
        setDailyRule(dailyRes as FashionRule);
      } else {
        throw new Error('Invalid daily rule response');
      }
      setCategories(categoriesRes.categories || []);
    } catch (error) {
      setDailyRule({
        id: 1,
        title: "The 60-30-10 Color Rule",
        content: "Use 60% dominant color, 30% secondary, and 10% accent for a balanced, stylish outfit.",
        category: "Color Theory",
        difficulty: "Beginner",
        gender: "all",
        tags: ["color", "basics"],
        colorSwatches: [
          { name: "Dominant", hex: "#1E3A8A" },
          { name: "Secondary", hex: "#6B7280" },
          { name: "Accent", hex: "#F59E0B" },
        ],
      });
      setCategories([
        { name: "Color Theory", count: 10, topics: ["60-30-10 rule", "complementary colors"] },
        { name: "Fit & Tailoring", count: 8, topics: ["One loose/one fitted", "shoulder seams"] },
        { name: "Proportions", count: 7, topics: ["Third piece rule", "1/3-2/3 ratio"] },
        { name: "Pattern Mixing", count: 6, topics: ["Scale variation", "stripes as neutrals"] },
        { name: "Styling Formulas", count: 8, topics: ["Jeans+tee+blazer", "French tuck"] },
      ]);
    }

    try {
      const colorTrendsRes = await apiService.getCurrentColorTrends();
      setColorOfTheYear(colorTrendsRes.colorOfTheYear);
      setSeasonalPalette(colorTrendsRes.seasonalPalette || []);
    } catch (error) {
      setColorOfTheYear({
        name: "Mocha Mousse",
        hexCode: "#A47864",
        pantoneCode: "PANTONE 17-1230",
        description: "A warm, earthy brown that evokes comfort and timeless elegance.",
        pairingColors: ["#FFFFFF", "#000000", "#D4A574", "#8B7355"],
        bestFor: ["Warm", "Neutral"],
        year: 2025,
      });
      setSeasonalPalette([
        {
          id: "1",
          name: "Butter Cream",
          hexCode: "#F5E6C8",
          pantoneCode: "PANTONE 13-0720",
          season: "Spring",
          year: 2026,
          description: "A soft, creamy yellow that brings warmth and optimism.",
          pairingColors: ["#A47864", "#6B5B4F", "#FFFFFF"],
          bestFor: ["Warm", "Neutral"],
        },
        {
          id: "2",
          name: "Sage Mist",
          hexCode: "#B8C4A8",
          pantoneCode: "PANTONE 15-6316",
          season: "Spring",
          year: 2026,
          description: "A calming, muted green perfect for fresh spring looks.",
          pairingColors: ["#FFFFFF", "#F5E6C8", "#6B7355"],
          bestFor: ["Cool", "Neutral"],
        },
        {
          id: "3",
          name: "Dusty Rose",
          hexCode: "#D4A5A5",
          pantoneCode: "PANTONE 15-1614",
          season: "Spring",
          year: 2026,
          description: "A romantic, muted pink that flatters all skin tones.",
          pairingColors: ["#FFFFFF", "#000000", "#C9A87C"],
          bestFor: ["Warm", "Cool"],
        },
        {
          id: "4",
          name: "Ocean Depth",
          hexCode: "#2E5A6B",
          pantoneCode: "PANTONE 19-4241",
          season: "Spring",
          year: 2026,
          description: "A sophisticated teal that adds depth to any outfit.",
          pairingColors: ["#FFFFFF", "#F5E6C8", "#C9A87C"],
          bestFor: ["Cool", "Neutral"],
        },
      ]);
    }
  };

  const loadRulesByCategory = async (category: string) => {
    setIsLoadingRules(true);
    setSelectedCategory(category);
    try {
      const res = await apiService.getFashionRules({ category });
      setFashionRules(res.rules || []);
    } catch (error) {
      setFashionRules([]);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const checkAccess = async () => {
    if (!user?.id) return;
    const status = await decisionService.checkDecisionAccess(
      user.id,
      user.subscriptionTier || 'free'
    );
    setAccessStatus(status);

    if (!status.canMakeDecision) {
      setShowUpgradeModal(true);
    }
  };

  const handleTypeSelect = (type: DecisionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
    setIsSurpriseMe(false);
    // For "what-to-wear" and "sanity-check", show exploratory questions first before upload
    if (type === 'what-to-wear' || type === 'sanity-check') {
      setStep('context');
    } else {
      setStep('upload');
    }
  };

  const handleSurpriseMe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSurpriseMe(true);
    if (selectedType === 'what-to-wear') {
      // For "what-to-wear", context is already done, so submit directly
      handleSubmit();
    } else if (selectedType === 'event-outfit') {
      setStep('event-questions');
    } else {
      setStep('context');
    }
  };

  const handlePickImage = async () => {
    if (!accessStatus) return;

    if (images.length >= accessStatus.maxImages) {
      Alert.alert(
        'Maximum images reached',
        `You can upload up to ${accessStatus.maxImages} images.`
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: accessStatus.maxImages - images.length,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, accessStatus.maxImages));
    }
  };

  const handleTakePhoto = async () => {
    if (!accessStatus) return;

    if (images.length >= accessStatus.maxImages) {
      Alert.alert(
        'Maximum images reached',
        `You can upload up to ${accessStatus.maxImages} images.`
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Please enable camera access in settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, accessStatus.maxImages));
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleContextToggle = (context: DecisionContext) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedContexts(prev =>
      prev.includes(context)
        ? prev.filter(c => c !== context)
        : [...prev, context]
    );
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    // Images are only required when NOT using Surprise Me
    if (!isSurpriseMe && images.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const stylistId = user?.stylistPreferences?.selectedStylistId || 'ruby';
      const context = decisionService.formatContextForApi(selectedContexts, contextNotes.trim() || undefined);
      
      const decisionTypeMap: Record<string, 'sanity_check' | 'shopping' | 'what_to_wear' | 'event_outfit'> = {
        'sanity-check': 'sanity_check',
        'shopping': 'shopping',
        'what-to-wear': 'what_to_wear',
        'event-outfit': 'event_outfit',
      };

      const base64Images = await Promise.all(
        images.map(async (imageUri) => {
          const base64 = await convertImageToBase64(imageUri);
          return `data:image/jpeg;base64,${base64}`;
        })
      );

      // Map frontend gender values to backend-expected values
      const mappedGender = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : user?.gender || null;

      // Build comprehensive profile from all direct user state properties
      // Merge backend blob first, then override with direct user state (direct takes precedence)
      const fullUserProfile = {
        ...(user?.profileData || {}),
        gender: mappedGender,
        name: user?.name,
        country: user?.country,
        skinUndertone: user?.skinUndertone,
        bodyType: user?.bodyShape,
        bodyMeasurements: user?.bodyMeasurements,
        colorScanData: user?.colorScanData,
        extendedPreferences: user?.extendedPreferences,
        stylistPreferences: user?.stylistPreferences,
        stylePreference: user?.stylePreference,
        sizeRange: user?.sizeRange,
        budgetRange: user?.budgetRange,
        subscriptionTier: user?.subscriptionTier,
        retailers: user?.extendedPreferences?.favoriteShops || [],
      };

      const apiResult = await apiService.submitDecisionCheck({
        decisionType: decisionTypeMap[selectedType] || 'sanity_check',
        images: base64Images,
        context,
        stylist: stylistId,
        userProfile: fullUserProfile,
      });

      const result: DecisionResponse = {
        id: `response-${Date.now()}`,
        requestId: `request-${Date.now()}`,
        recommendation: apiResult.decision || apiResult.recommendation || apiResult.response || '',
        reasoning: apiResult.reasoning || '',
        stylistId,
        timestamp: new Date().toISOString(),
        outfitImageUrl: apiResult.outfitImageUrl,
      };

      if (user?.id) {
        await decisionService.incrementDecisionsToday(user.id);
        await decisionService.incrementTotalDecisions(user.id);
      }

      setResponse(result);
      setStep('response');
    } catch (error: any) {
      if (error.limitCopy || error.message?.includes("your decision for today")) {
        Alert.alert(
          'Unable to submit',
          error.limitCopy?.message || error.message || "That's your decision for today. Your stylist is here whenever you're ready.",
          [
            {
              text: 'Maybe later',
              style: 'cancel',
            },
            {
              text: error.limitCopy?.cta || 'Unlock unlimited decisions',
              onPress: () => {
                const redirectUrl = error.limitCopy?.redirectUrl || '/subscription';
                if (redirectUrl === '/subscription' || redirectUrl.includes('subscription')) {
                  navigation.navigate('Subscription' as never);
                } else {
                  navigation.navigate(redirectUrl.replace('/', '') as never);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Unable to submit', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecondOpinion = async () => {
    if (!response) return;

    if (!user?.id) {
      setShowRegisterModal(true);
      return;
    }

    if (!accessStatus?.hasSecondOpinion) {
      setShowUpgradeModal(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const result = await decisionService.requestSecondOpinion(
        response.requestId,
        response,
        user.subscriptionTier || 'free'
      );
      setSecondOpinion(result);
    } catch (error: any) {
      Alert.alert('Unable to get second opinion', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHelpful = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const getStylistGradient = (): readonly [string, string] => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return [LUXURY_COLORS.rose, '#D4949A'];
    if (stylistId === 'max') return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet];
    if (stylistId === 'ace') return [LUXURY_COLORS.obsidian, '#1A1A1A'];
    if (stylistId === 'ivy') return [LUXURY_COLORS.emerald, LUXURY_COLORS.teal];
    return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold];
  };

  const getStylistIcon = (): string => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return 'heart';
    if (stylistId === 'max') return 'zap';
    if (stylistId === 'ace') return 'target';
    if (stylistId === 'ivy') return 'compass';
    return 'star';
  };

  const getStylistName = (): string => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return 'Ruby';
    if (stylistId === 'max') return 'Max';
    if (stylistId === 'ace') return 'Ace';
    if (stylistId === 'ivy') return 'Ivy';
    return 'Your Stylist';
  };

  const DECISION_LABEL_KEYS: Record<string, string | undefined> = {
    shopping: translations.aiStylist?.decisionShopping,
    'what-to-wear': translations.aiStylist?.decisionWhatToWear,
    'event-outfit': translations.aiStylist?.decisionEventOutfit,
    'sanity-check': translations.aiStylist?.decisionSanityCheck,
  };
  const DECISION_DESC_KEYS: Record<string, string | undefined> = {
    shopping: translations.aiStylist?.decisionShoppingDesc,
    'what-to-wear': translations.aiStylist?.decisionWhatToWearDesc,
    'event-outfit': translations.aiStylist?.decisionEventOutfitDesc,
    'sanity-check': translations.aiStylist?.decisionSanityCheckDesc,
  };

  const renderTypeSelection = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        {translations.aiStylist?.whatDecisionHelp || 'What decision can I help you with?'}
      </ThemedText>

      <View style={styles.typeGrid}>
        {decisionTypes.map((type) => (
          <Pressable
            key={type.id}
            onPress={() => handleTypeSelect(type.id)}
            style={({ pressed }) => [
              styles.typeCard,
              pressed && styles.typeCardPressed,
            ]}
          >
            {({ pressed }) => (
              <LinearGradient
                colors={pressed 
                  ? ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']
                  : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={[
                  styles.typeCardGradient,
                  pressed && styles.typeCardGradientPressed,
                ]}
              >
                <View style={[
                  styles.typeIconContainer,
                  pressed && { backgroundColor: 'rgba(255,255,255,0.25)' }
                ]}>
                  <Feather name={type.icon as any} size={24} color="#FFFFFF" />
                </View>
                <ThemedText type="body" style={styles.typeLabel}>
                  {DECISION_LABEL_KEYS[type.id] || type.label}
                </ThemedText>
                <ThemedText type="small" style={styles.typeDescription}>
                  {DECISION_DESC_KEYS[type.id] || type.description}
                </ThemedText>
              </LinearGradient>
            )}
          </Pressable>
        ))}
      </View>

      {accessStatus ? (
        <View style={styles.limitInfo}>
          <Feather name="info" size={14} color="rgba(255,255,255,0.5)" />
          <ThemedText type="small" style={styles.limitText}>
            {decisionService.getLimitCopy(user?.subscriptionTier || 'free').subtitle === "One decision a day, on me."
              ? (translations.aiStylist?.oneDecisionDay || "One decision a day, on me.")
              : decisionService.getLimitCopy(user?.subscriptionTier || 'free').subtitle}
          </ThemedText>
        </View>
      ) : null}

    </View>
  );

  const renderColourInsights = () => (
    <View style={styles.stepContent}>
      <Pressable onPress={() => setStep('type')} style={styles.backLink}>
        <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.7)" />
        <ThemedText style={styles.backLinkText}>Back</ThemedText>
      </Pressable>

      <View style={styles.colorTrendsSection}>
          <View style={styles.blogHeader}>
            <Feather name="droplet" size={20} color={LUXURY_COLORS.gold} />
            <ThemedText type="h3" style={styles.blogTitle}>
              Colour Insights
            </ThemedText>
          </View>
  
          {/* Personal Colour Profile */}
          <View style={styles.colourProfileCard}>
            <View style={styles.colourProfileHeader}>
              <LinearGradient
                colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                style={styles.colourProfileIconBadge}
              >
                <Feather name="user" size={12} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="small" style={styles.colourProfileBadgeText}>
                YOUR COLOUR PROFILE
              </ThemedText>
            </View>
  
            {user?.skinUndertone === 'warm' ? (
              <View style={styles.colourProfileBody}>
                <ThemedText type="body" style={styles.colourProfileTitle}>
                  Warm Undertone
                </ThemedText>
                <ThemedText type="small" style={styles.colourProfileDesc}>
                  Earth tones and rich, warm hues make you radiate. Lean into camel, terracotta, olive, rust, and gold — they work with your natural warmth rather than against it.
                </ThemedText>
                <View style={styles.colourPaletteRow}>
                  {[
                    { hex: '#C19A6B', name: 'Camel' },
                    { hex: '#E27D60', name: 'Terracotta' },
                    { hex: '#6B7A3A', name: 'Olive' },
                    { hex: '#B7410E', name: 'Rust' },
                    { hex: '#C9A87C', name: 'Gold' },
                    { hex: '#FFFDD0', name: 'Cream' },
                  ].map((c, i) => (
                    <View key={i} style={styles.colourChip}>
                      <View style={[styles.colourChipSwatch, { backgroundColor: c.hex }]} />
                      <ThemedText type="caption" style={styles.colourChipName}>{c.name}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : user?.skinUndertone === 'cool' ? (
              <View style={styles.colourProfileBody}>
                <ThemedText type="body" style={styles.colourProfileTitle}>
                  Cool Undertone
                </ThemedText>
                <ThemedText type="small" style={styles.colourProfileDesc}>
                  Cool, jewel-toned shades bring out the best in you. Navy, burgundy, lavender, cobalt, and rose all complement your undertone beautifully.
                </ThemedText>
                <View style={styles.colourPaletteRow}>
                  {[
                    { hex: '#001F5B', name: 'Navy' },
                    { hex: '#800020', name: 'Burgundy' },
                    { hex: '#9B7EBD', name: 'Lavender' },
                    { hex: '#0047AB', name: 'Cobalt' },
                    { hex: '#E8B4B8', name: 'Rose' },
                    { hex: '#8F9CC0', name: 'Slate' },
                  ].map((c, i) => (
                    <View key={i} style={styles.colourChip}>
                      <View style={[styles.colourChipSwatch, { backgroundColor: c.hex }]} />
                      <ThemedText type="caption" style={styles.colourChipName}>{c.name}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : user?.skinUndertone === 'neutral' ? (
              <View style={styles.colourProfileBody}>
                <ThemedText type="body" style={styles.colourProfileTitle}>
                  Neutral Undertone
                </ThemedText>
                <ThemedText type="small" style={styles.colourProfileDesc}>
                  You have the most versatile palette — almost any colour works. Anchor looks with navy, camel, or white, then experiment freely with bolder accent shades.
                </ThemedText>
                <View style={styles.colourPaletteRow}>
                  {[
                    { hex: '#001F5B', name: 'Navy' },
                    { hex: '#FFFFFF', name: 'White' },
                    { hex: '#1A1A1A', name: 'Black' },
                    { hex: '#C19A6B', name: 'Camel' },
                    { hex: '#E8B4B8', name: 'Blush' },
                    { hex: '#8B8589', name: 'Taupe' },
                  ].map((c, i) => (
                    <View key={i} style={styles.colourChip}>
                      <View style={[styles.colourChipSwatch, { backgroundColor: c.hex, borderWidth: c.hex === '#FFFFFF' ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)' }]} />
                      <ThemedText type="caption" style={styles.colourChipName}>{c.name}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.colourProfileBody}>
                <ThemedText type="small" style={styles.colourProfileDesc}>
                  Complete your profile to unlock a personalised colour palette based on your unique undertone.
                </ThemedText>
                <Pressable
                  onPress={() => navigation.navigate('Profile')}
                  style={styles.colourProfileCta}
                >
                  <ThemedText type="small" style={styles.colourProfileCtaText}>
                    Complete Profile
                  </ThemedText>
                  <Feather name="arrow-right" size={14} color={LUXURY_COLORS.gold} />
                </Pressable>
              </View>
            )}
          </View>
  
          {/* Colour of the Year */}
          {colorOfTheYear ? (
            <View style={styles.colorOfYearCard}>
              <View style={styles.colorOfYearBadge}>
                <Feather name="award" size={12} color="#FFFFFF" />
                <ThemedText type="small" style={styles.colorOfYearBadgeText}>
                  COLOUR OF THE YEAR {colorOfTheYear.year}
                </ThemedText>
              </View>
              <View style={styles.colorOfYearContent}>
                <View style={[styles.colorOfYearSwatch, { backgroundColor: colorOfTheYear.hexCode }]} />
                <View style={styles.colorOfYearInfo}>
                  <ThemedText type="body" style={styles.colorOfYearName}>
                    {colorOfTheYear.name}
                  </ThemedText>
                  <ThemedText type="small" style={styles.colorOfYearHex}>
                    {colorOfTheYear.hexCode}
                  </ThemedText>
                  {colorOfTheYear.pantoneCode ? (
                    <ThemedText type="small" style={styles.colorOfYearPantone}>
                      {colorOfTheYear.pantoneCode}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              <ThemedText type="small" style={styles.colorOfYearDescription}>
                {colorOfTheYear.description}
              </ThemedText>
              <View style={styles.pairingSection}>
                <ThemedText type="small" style={styles.pairingLabel}>
                  Pairs with:
                </ThemedText>
                <View style={styles.pairingSwatches}>
                  {colorOfTheYear.pairingColors.map((color, idx) => (
                    <View
                      key={idx}
                      style={[styles.pairingSwatch, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.bestForSection}>
                <ThemedText type="small" style={styles.bestForLabel}>
                  Best for:
                </ThemedText>
                <ThemedText type="small" style={styles.bestForValue}>
                  {colorOfTheYear.bestFor.join(' & ')}
                </ThemedText>
              </View>
            </View>
          ) : null}
  
          {/* Colour Harmony Guide */}
          <View style={styles.harmonyCard}>
            <View style={styles.harmonyCardHeader}>
              <LinearGradient
                colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                style={styles.harmonyCardIconBadge}
              >
                <Feather name="grid" size={12} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="small" style={styles.harmonyCardBadgeText}>
                COLOUR HARMONY GUIDE
              </ThemedText>
            </View>
            <View style={styles.harmonyRules}>
              <View style={styles.harmonyRule}>
                <View style={styles.harmonySwatches}>
                  {['#2E3B8F', '#5B6FC4', '#A8B3E8'].map((c, i) => (
                    <View key={i} style={[styles.harmonySwatch, { backgroundColor: c }]} />
                  ))}
                </View>
                <View style={styles.harmonyRuleText}>
                  <ThemedText type="body" style={styles.harmonyRuleName}>Monochrome</ThemedText>
                  <ThemedText type="small" style={styles.harmonyRuleDesc}>
                    One hue in light, mid, and dark shades — effortlessly polished.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.harmonyDivider} />
              <View style={styles.harmonyRule}>
                <View style={styles.harmonySwatches}>
                  {['#1A5276', '#E67E22', '#1A5276'].map((c, i) => (
                    <View key={i} style={[styles.harmonySwatch, { backgroundColor: c }]} />
                  ))}
                </View>
                <View style={styles.harmonyRuleText}>
                  <ThemedText type="body" style={styles.harmonyRuleName}>Complementary</ThemedText>
                  <ThemedText type="small" style={styles.harmonyRuleDesc}>
                    Opposite colours on the wheel (e.g. blue + orange) create bold contrast.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.harmonyDivider} />
              <View style={styles.harmonyRule}>
                <View style={styles.harmonySwatches}>
                  {['#1A3A5C', '#6B7A3A', '#C9A87C'].map((c, i) => (
                    <View key={i} style={[styles.harmonySwatch, { backgroundColor: c, width: i === 0 ? 28 : i === 1 ? 18 : 10 }]} />
                  ))}
                </View>
                <View style={styles.harmonyRuleText}>
                  <ThemedText type="body" style={styles.harmonyRuleName}>60-30-10 Rule</ThemedText>
                  <ThemedText type="small" style={styles.harmonyRuleDesc}>
                    60% dominant, 30% secondary, 10% accent — the formula for a balanced outfit.
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
  
          {/* Seasonal Palette */}
          <Pressable
            onPress={() => setShowColorTrends(!showColorTrends)}
            style={({ pressed }) => [
              styles.exploreCategoriesButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText type="body" style={styles.exploreCategoriesText}>
              {showColorTrends ? 'Hide Seasonal Palette' : `This Season's Palette (${seasonalPalette.length})`}
            </ThemedText>
            <Feather
              name={showColorTrends ? "chevron-up" : "chevron-down"}
              size={18}
              color={LUXURY_COLORS.gold}
            />
          </Pressable>
  
          {showColorTrends ? (
            <View style={styles.seasonalPaletteGrid}>
              {seasonalPalette.map((color) => (
                <View key={color.id} style={styles.seasonalColorCard}>
                  <View style={[styles.seasonalColorSwatch, { backgroundColor: color.hexCode }]} />
                  <View style={styles.seasonalColorInfo}>
                    <ThemedText type="body" style={styles.seasonalColorName}>
                      {color.name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.seasonalColorHex}>
                      {color.hexCode}
                    </ThemedText>
                    {color.pantoneCode ? (
                      <ThemedText type="small" style={styles.seasonalColorPantone}>
                        {color.pantoneCode}
                      </ThemedText>
                    ) : null}
                    <View style={styles.seasonalPairingSwatches}>
                      {color.pairingColors.slice(0, 3).map((pc, idx) => (
                        <View
                          key={idx}
                          style={[styles.miniPairingSwatch, { backgroundColor: pc }]}
                        />
                      ))}
                    </View>
                    <ThemedText type="small" style={styles.seasonalBestFor}>
                      {color.bestFor.join(' & ')}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
    </View>
  );

  const getUploadTitle = () => {
    if (selectedType === 'sanity-check') return "Show me what you're wearing";
    if (selectedType === 'what-to-wear' || selectedType === 'event-outfit') return "How can I help?";
    return "Show me your options";
  };

  const getUploadSubtitle = () => {
    if (selectedType === 'sanity-check') return "Upload one outfit or item for a quick check.";
    if (selectedType === 'what-to-wear' || selectedType === 'event-outfit') return "Upload photos or let me pick something from your wardrobe.";
    return "Two or three options is perfect.";
  };

  const getMaxImagesForType = () => {
    if (selectedType === 'sanity-check') return 1;
    return accessStatus?.maxImages || 2;
  };

  const showSurpriseMeOption = selectedType === 'what-to-wear' || selectedType === 'event-outfit';

  const renderUpload = () => {
    const isComparisonMode = selectedType === 'shopping';
    const option1Filled = images.length > 0;
    const option2Filled = images.length > 1;

    return (
      <View style={styles.stepContent}>
        <ThemedText type="h2" style={styles.stepTitle}>
          {getUploadTitle()}
        </ThemedText>
        <ThemedText style={styles.stepSubtitle}>
          {getUploadSubtitle()}
        </ThemedText>

        {isComparisonMode ? (
          <View style={styles.optionsComparisonContainer}>
            {/* Option 1 Section */}
            <View style={styles.optionSection}>
              <ThemedText type="body" style={styles.optionLabel}>Option 1</ThemedText>
              {option1Filled ? (
                <View style={styles.optionImageContainer}>
                  <Image source={{ uri: images[0] }} style={styles.uploadedImage} />
                  <Pressable
                    onPress={() => handleRemoveImage(0)}
                    style={styles.removeImageButton}
                  >
                    <Feather name="x" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.optionUploadArea}>
                  <View style={styles.uploadButtonsColumn}>
                    <Pressable 
                      onPress={handlePickImage} 
                      style={({ pressed }) => [
                        styles.optionUploadButton,
                        pressed && styles.uploadButtonPressed
                      ]}
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={pressed 
                            ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                            : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={styles.uploadButtonGradient}
                        >
                          <Feather name="image" size={28} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                          <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                            Gallery
                          </ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                    <Pressable 
                      onPress={handleTakePhoto} 
                      style={({ pressed }) => [
                        styles.optionUploadButton,
                        pressed && styles.uploadButtonPressed
                      ]}
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={pressed 
                            ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                            : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={styles.uploadButtonGradient}
                        >
                          <Feather name="camera" size={28} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                          <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                            Camera
                          </ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Option 2 Section */}
            <View style={styles.optionSection}>
              <ThemedText type="body" style={[styles.optionLabel, { opacity: option1Filled ? 1 : 0.5 }]}>
                Option 2
              </ThemedText>
              {option2Filled ? (
                <View style={styles.optionImageContainer}>
                  <Image source={{ uri: images[1] }} style={styles.uploadedImage} />
                  <Pressable
                    onPress={() => handleRemoveImage(1)}
                    style={styles.removeImageButton}
                  >
                    <Feather name="x" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : option1Filled ? (
                <View style={styles.optionUploadArea}>
                  <View style={styles.uploadButtonsColumn}>
                    <Pressable 
                      onPress={handlePickImage} 
                      style={({ pressed }) => [
                        styles.optionUploadButton,
                        pressed && styles.uploadButtonPressed
                      ]}
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={pressed 
                            ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                            : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={styles.uploadButtonGradient}
                        >
                          <Feather name="image" size={28} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                          <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                            Gallery
                          </ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                    <Pressable 
                      onPress={handleTakePhoto} 
                      style={({ pressed }) => [
                        styles.optionUploadButton,
                        pressed && styles.uploadButtonPressed
                      ]}
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={pressed 
                            ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                            : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={styles.uploadButtonGradient}
                        >
                          <Feather name="camera" size={28} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                          <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                            Camera
                          </ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={[styles.optionUploadArea, styles.optionDisabled]}>
                  <ThemedText type="small" style={styles.optionDisabledText}>
                    Upload Option 1 first
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        ) : (
          // Single image upload (non-shopping mode)
          <View style={styles.imagesGrid}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.uploadedImage} />
                <Pressable
                  onPress={() => handleRemoveImage(index)}
                  style={styles.removeImageButton}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}

            {images.length < getMaxImagesForType() ? (
              <View style={styles.uploadButtonsRow}>
                <Pressable 
                  onPress={handlePickImage} 
                  style={({ pressed }) => [
                    styles.uploadButton,
                    pressed && styles.uploadButtonPressed
                  ]}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={pressed 
                        ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                      style={styles.uploadButtonGradient}
                    >
                      <Feather name="image" size={24} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                      <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                        Gallery
                      </ThemedText>
                    </LinearGradient>
                  )}
                </Pressable>
                <Pressable 
                  onPress={handleTakePhoto} 
                  style={({ pressed }) => [
                    styles.uploadButton,
                    pressed && styles.uploadButtonPressed
                  ]}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={pressed 
                        ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] 
                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                      style={styles.uploadButtonGradient}
                    >
                      <Feather name="camera" size={24} color={pressed ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                      <ThemedText type="small" style={[styles.uploadButtonText, pressed && { color: '#FFFFFF' }]}>
                        Camera
                      </ThemedText>
                    </LinearGradient>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {showSurpriseMeOption && images.length === 0 ? (
          <View style={styles.surpriseMeSection}>
            <View style={styles.orDivider}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.orText}>or</ThemedText>
              <View style={styles.dividerLine} />
            </View>
            <Pressable onPress={handleSurpriseMe} style={styles.surpriseMeButton}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.surpriseMeButtonGradient}
              >
                <Feather name="shuffle" size={20} color={LUXURY_COLORS.midnight} />
                <ThemedText type="body" style={styles.surpriseMeButtonText}>
                  Surprise Me
                </ThemedText>
                <ThemedText type="small" style={styles.surpriseMeSubtext}>
                  Pick from my wardrobe
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {images.length > 0 ? (
          <Pressable
            onPress={() => selectedType === 'what-to-wear' || selectedType === 'sanity-check' ? handleSubmit() : setStep('context')}
            disabled={isLoading}
            style={styles.nextButton}
          >
            <LinearGradient
              colors={getStylistGradient()}
              style={styles.nextButtonGradient}
            >
              <ThemedText type="body" style={styles.nextButtonText}>
                {isLoading ? 'Analyzing...' : 'Continue'}
              </ThemedText>
              {!isLoading && <Feather name="arrow-right" size={18} color="#FFFFFF" />}
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const eventTypes = [
    { id: 'wedding', label: 'Wedding' },
    { id: 'date', label: 'Date Night' },
    { id: 'party', label: 'Party' },
    { id: 'business', label: 'Business Meeting' },
    { id: 'interview', label: 'Interview' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'other', label: 'Other' },
  ];

  const dressCodes = [
    { id: 'casual', label: 'Casual' },
    { id: 'smart-casual', label: 'Smart Casual' },
    { id: 'business', label: 'Business' },
    { id: 'cocktail', label: 'Cocktail' },
    { id: 'formal', label: 'Formal' },
    { id: 'black-tie', label: 'Black Tie' },
  ];

  const timeOptions = [
    { id: 'morning', label: 'Morning' },
    { id: 'afternoon', label: 'Afternoon' },
    { id: 'evening', label: 'Evening' },
    { id: 'night', label: 'Night' },
  ];

  const renderEventQuestions = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Tell me about your event
      </ThemedText>
      <ThemedText style={styles.stepSubtitle}>
        Help me pick the perfect outfit for you.
      </ThemedText>

      <View style={styles.eventQuestionsContainer}>
        <ThemedText type="body" style={styles.eventQuestionLabel}>
          What type of event?
        </ThemedText>
        <View style={styles.eventChipsRow}>
          {eventTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => setEventDetails(prev => ({ ...prev, eventType: type.id }))}
              style={[
                styles.eventChip,
                eventDetails.eventType === type.id && styles.eventChipSelected,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.eventChipText,
                  eventDetails.eventType === type.id && styles.eventChipTextSelected,
                ]}
              >
                {type.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="body" style={styles.eventQuestionLabel}>
          Dress code?
        </ThemedText>
        <View style={styles.eventChipsRow}>
          {dressCodes.map((code) => (
            <Pressable
              key={code.id}
              onPress={() => setEventDetails(prev => ({ ...prev, dressCode: code.id }))}
              style={[
                styles.eventChip,
                eventDetails.dressCode === code.id && styles.eventChipSelected,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.eventChipText,
                  eventDetails.dressCode === code.id && styles.eventChipTextSelected,
                ]}
              >
                {code.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="body" style={styles.eventQuestionLabel}>
          Time of day?
        </ThemedText>
        <View style={styles.eventChipsRow}>
          {timeOptions.map((time) => (
            <Pressable
              key={time.id}
              onPress={() => setEventDetails(prev => ({ ...prev, timeOfDay: time.id }))}
              style={[
                styles.eventChip,
                eventDetails.timeOfDay === time.id && styles.eventChipSelected,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.eventChipText,
                  eventDetails.timeOfDay === time.id && styles.eventChipTextSelected,
                ]}
              >
                {time.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="body" style={styles.eventQuestionLabel}>
          Anything I should know?
        </ThemedText>

        <TextInput
          ref={contextInputRef}
          style={styles.contextInput}
          placeholder="Add any extra details (optional)"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={contextNotes}
          onChangeText={setContextNotes}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      {eventDetails.eventType && eventDetails.dressCode ? (
        <Pressable
          onPress={handleSubmit}
          disabled={isLoading}
          style={styles.nextButton}
        >
          <LinearGradient
            colors={getStylistGradient()}
            style={styles.nextButtonGradient}
          >
            {isLoading ? (
              <ThemedText type="body" style={styles.nextButtonText}>
                Thinking...
              </ThemedText>
            ) : (
              <>
                <ThemedText type="body" style={styles.nextButtonText}>
                  Ask my stylist
                </ThemedText>
                <Feather name="send" size={18} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );

  const renderContext = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Anything I should know?
      </ThemedText>

      <View style={styles.contextChipsContainer}>
        {contextChips.map((chip) => {
          const isSelected = selectedContexts.includes(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => handleContextToggle(chip.id)}
              style={[
                styles.contextChip,
                isSelected && styles.contextChipSelected,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.contextChipText,
                  isSelected && styles.contextChipTextSelected,
                ]}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        ref={contextInputRef}
        style={styles.contextInput}
        placeholder="Add any extra details (optional)"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={contextNotes}
        onChangeText={setContextNotes}
        multiline
        numberOfLines={3}
        maxLength={200}
      />

      {selectedType === 'what-to-wear' || selectedType === 'sanity-check' ? (
        <>
          <Pressable
            onPress={() => setStep('upload')}
            style={styles.submitButton}
          >
            <LinearGradient
              colors={getStylistGradient()}
              style={styles.submitButtonGradient}
            >
              <ThemedText type="body" style={styles.submitButtonText}>
                Next
              </ThemedText>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => setStep('type')} style={styles.backLink}>
            <ThemedText style={styles.backLinkText}>Back</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.submitButton}
          >
            <LinearGradient
              colors={getStylistGradient()}
              style={styles.submitButtonGradient}
            >
              {isLoading ? (
                <ThemedText type="body" style={styles.submitButtonText}>
                  Thinking...
                </ThemedText>
              ) : (
                <>
                  <ThemedText type="body" style={styles.submitButtonText}>
                    Ask my stylist
                  </ThemedText>
                  <Feather name="send" size={18} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setStep('upload')} style={styles.backLink}>
            <ThemedText style={styles.backLinkText}>Back to images</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );

  const renderResponse = () => (
    <View style={styles.stepContent}>
      <View style={styles.stylistAvatarContainer}>
        <LinearGradient
          colors={getStylistGradient()}
          style={styles.stylistAvatar}
        >
          <Feather
            name={getStylistIcon() as any}
            size={28}
            color="#FFFFFF"
          />
        </LinearGradient>
        <ThemedText type="small" style={styles.stylistName}>
          {getStylistName()}
        </ThemedText>
      </View>

      {response?.outfitImageUrl ? (
        <View style={styles.outfitImageContainer}>
          <Image
            source={{ uri: response.outfitImageUrl }}
            style={styles.outfitImage}
          />
        </View>
      ) : null}

      <View style={styles.responseCard}>
        <ThemedText type="body" style={styles.responseText}>
          {response?.recommendation}
        </ThemedText>
        {response?.reasoning ? (
          <ThemedText style={styles.reasoningText}>
            {response.reasoning}
          </ThemedText>
        ) : null}
      </View>

      {secondOpinion ? (
        <View style={styles.secondOpinionCard}>
          <ThemedText type="small" style={styles.secondOpinionLabel}>
            Second opinion
          </ThemedText>
          <ThemedText style={styles.secondOpinionText}>
            {secondOpinion.response}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.responseActions}>
        <Pressable onPress={handleHelpful} style={styles.helpfulButton}>
          <LinearGradient
            colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
            style={styles.helpfulButtonGradient}
          >
            <Feather name="thumbs-up" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={styles.helpfulButtonText}>
              That helps
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {!secondOpinion && accessStatus?.hasSecondOpinion ? (
          <Pressable onPress={handleSecondOpinion} style={styles.secondOpinionButton}>
            <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.secondOpinionButtonText}>
              Second opinion
            </ThemedText>
          </Pressable>
        ) : !accessStatus?.hasSecondOpinion ? (
          <Pressable onPress={() => setShowUpgradeModal(true)} style={styles.secondOpinionButton}>
            <Feather name="lock" size={16} color="rgba(255,255,255,0.5)" />
            <ThemedText style={styles.secondOpinionButtonText}>
              Second opinion
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          LUXURY_COLORS.violet,
          LUXURY_COLORS.deepViolet,
          LUXURY_COLORS.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenKeyboardAwareScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h3" style={styles.headerTitle}>
            {translations.aiStylist?.askStylistTitle || 'Ask the Stylist'}
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {step === 'type' && renderTypeSelection()}
          {step === 'upload' && renderUpload()}
          {step === 'context' && renderContext()}
          {step === 'event-questions' && renderEventQuestions()}
          {step === 'response' && renderResponse()}
        </View>
      </ScreenKeyboardAwareScrollView>

      <Modal
        visible={showRegisterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowRegisterModal(false)}
        >
          <Pressable style={styles.upgradeModal} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.upgradeModalGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <Feather name="user-plus" size={32} color={LUXURY_COLORS.midnight} />
              </View>
              <ThemedText type="h2" style={styles.upgradeTitle}>
                Register to access second opinions
              </ThemedText>
              <ThemedText style={styles.upgradeDescription}>
                Create an account so we can get your style details and send you personalized recommendations. Your registered profile helps our stylists understand your preferences better.
              </ThemedText>
              <Pressable
                onPress={() => {
                  setShowRegisterModal(false);
                  navigation.navigate('Auth');
                }}
                style={styles.upgradeButton}
              >
                <ThemedText type="body" style={styles.upgradeButtonText}>
                  Sign up now
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setShowRegisterModal(false)}
                style={[styles.upgradeButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: LUXURY_COLORS.gold }]}
              >
                <ThemedText type="body" style={[styles.upgradeButtonText, { color: LUXURY_COLORS.gold }]}>
                  Maybe later
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowUpgradeModal(false)}
        >
          <Pressable style={styles.upgradeModal} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.upgradeModalGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <Feather name="unlock" size={32} color={LUXURY_COLORS.midnight} />
              </View>
              <ThemedText type="h2" style={styles.upgradeTitle}>
                {decisionService.getUpgradeCopy().headline}
              </ThemedText>
              <ThemedText style={styles.upgradeDescription}>
                {accessStatus?.reason ||
                  decisionService.getSecondOpinionLockedCopy()}
              </ThemedText>
              <Pressable
                onPress={() => {
                  setShowUpgradeModal(false);
                  navigation.navigate('Subscription');
                }}
                style={styles.upgradeButton}
              >
                <ThemedText type="body" style={styles.upgradeButtonText}>
                  {decisionService.getUpgradeCopy().cta}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setShowUpgradeModal(false)}
                style={styles.maybeLaterButton}
              >
                <ThemedText style={styles.maybeLaterText}>
                  {accessStatus?.canMakeDecision ? 'Not right now' : "I'll wait until tomorrow"}
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  typeGrid: {
    gap: Spacing.md,
  },
  typeCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  typeCardGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  typeDescription: {
    color: 'rgba(255,255,255,0.6)',
    flex: 1.5,
  },
  typeCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  typeCardGradientPressed: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  limitText: {
    color: 'rgba(255,255,255,0.5)',
  },
  imagesGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  uploadButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: 'rgba(255,255,255,0.6)',
  },
  uploadButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  surpriseMeSection: {
    marginTop: Spacing.lg,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  orText: {
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: Spacing.md,
    fontSize: 14,
  },
  surpriseMeButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  surpriseMeButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  surpriseMeButtonText: {
    color: '#1A1A2E',
    fontWeight: '700',
    fontSize: 16,
  },
  surpriseMeSubtext: {
    color: 'rgba(26,26,46,0.7)',
    fontSize: 12,
  },
  eventQuestionsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  eventQuestionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  eventChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  eventChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  eventChipSelected: {
    backgroundColor: 'rgba(201,168,124,0.3)',
    borderColor: '#C9A87C',
  },
  eventChipText: {
    color: 'rgba(255,255,255,0.7)',
  },
  eventChipTextSelected: {
    color: '#C9A87C',
    fontWeight: '600',
  },
  venueInputContainer: {
    marginTop: Spacing.sm,
  },
  venueInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nextButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contextChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  contextChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  contextChipSelected: {
    backgroundColor: LUXURY_COLORS.gold,
    borderColor: LUXURY_COLORS.gold,
  },
  contextChipText: {
    color: 'rgba(255,255,255,0.8)',
  },
  contextChipTextSelected: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '600',
  },
  contextInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backLinkText: {
    color: 'rgba(255,255,255,0.6)',
  },
  stylistAvatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  stylistAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stylistName: {
    color: 'rgba(255,255,255,0.7)',
  },
  responseCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  responseText: {
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  reasoningText: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  secondOpinionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: LUXURY_COLORS.gold,
  },
  secondOpinionLabel: {
    color: LUXURY_COLORS.gold,
    marginBottom: Spacing.xs,
  },
  secondOpinionText: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  responseActions: {
    gap: Spacing.md,
  },
  helpfulButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  helpfulButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  helpfulButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondOpinionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  secondOpinionButtonText: {
    color: 'rgba(255,255,255,0.7)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  upgradeModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  upgradeModalGradient: {
    padding: Spacing.xl,
    paddingBottom: 50,
    alignItems: 'center',
  },
  upgradeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  upgradeTitle: {
    color: LUXURY_COLORS.midnight,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeDescription: {
    color: 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: LUXURY_COLORS.midnight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  maybeLaterButton: {
    paddingVertical: Spacing.sm,
  },
  maybeLaterText: {
    color: 'rgba(0,0,0,0.5)',
  },
  blogSection: {
    marginTop: Spacing["2xl"],
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  blogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  blogTitle: {
    color: '#FFFFFF',
  },
  dailyRuleCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: LUXURY_COLORS.gold,
  },
  dailyRuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: LUXURY_COLORS.gold,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  dailyRuleBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ruleNumberContainer: {
    marginBottom: Spacing.xs,
  },
  ruleNumber: {
    color: LUXURY_COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  dailyRuleTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  dailyRuleContent: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  colorSwatches: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  swatchLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
  ruleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  difficultyBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  difficultyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 11,
  },
  categoryTag: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  exploreCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,168,124,0.3)',
  },
  exploreCategoriesText: {
    color: LUXURY_COLORS.gold,
  },
  categoriesContainer: {
    marginTop: Spacing.lg,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  categoryTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  categoryTabActive: {
    backgroundColor: LUXURY_COLORS.gold,
  },
  categoryTabText: {
    color: 'rgba(255,255,255,0.7)',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rulesListContainer: {
    gap: Spacing.md,
  },
  ruleItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  ruleItemNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,168,124,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleItemNumberText: {
    color: LUXURY_COLORS.gold,
    fontWeight: '700',
    fontSize: 12,
  },
  ruleItemContent: {
    flex: 1,
  },
  ruleItemTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  ruleItemDescription: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  miniSwatches: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  miniSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ruleItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  miniDifficultyBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
  },
  miniDifficultyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
  },
  genderTag: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  noRulesText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  colorTrendsSection: {
    marginTop: Spacing["2xl"],
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  colorOfYearCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#A47864',
  },
  colorOfYearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#A47864',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  colorOfYearBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1,
  },
  colorOfYearContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  colorOfYearSwatch: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorOfYearInfo: {
    flex: 1,
  },
  colorOfYearName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 2,
  },
  colorOfYearHex: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  colorOfYearPantone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  colorOfYearDescription: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  pairingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pairingLabel: {
    color: 'rgba(255,255,255,0.6)',
  },
  pairingSwatches: {
    flexDirection: 'row',
    gap: 6,
  },
  pairingSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bestForSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bestForLabel: {
    color: 'rgba(255,255,255,0.6)',
  },
  bestForValue: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  seasonalPaletteGrid: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  seasonalColorCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  seasonalColorSwatch: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  seasonalColorInfo: {
    flex: 1,
  },
  seasonalColorName: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  seasonalColorHex: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  seasonalColorPantone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginBottom: 4,
  },
  seasonalPairingSwatches: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 4,
  },
  miniPairingSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  seasonalBestFor: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  colourProfileCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Spacing.md,
  },
  colourProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  colourProfileIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colourProfileBadgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  colourProfileBody: {
    gap: Spacing.sm,
  },
  colourProfileTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  colourProfileDesc: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  colourPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  colourChip: {
    alignItems: 'center',
    gap: 4,
  },
  colourChipSwatch: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  colourChipName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    textAlign: 'center',
  },
  colourProfileCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  colourProfileCtaText: {
    color: '#C9A87C',
    fontWeight: '600',
  },
  harmonyCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Spacing.md,
  },
  harmonyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  harmonyCardIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harmonyCardBadgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  harmonyRules: {
    gap: 0,
  },
  harmonyRule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  harmonySwatches: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingTop: 2,
  },
  harmonySwatch: {
    width: 18,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  harmonyRuleText: {
    flex: 1,
    gap: 2,
  },
  harmonyRuleName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  harmonyRuleDesc: {
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    fontSize: 12,
  },
  harmonyDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 2,
  },
  optionsComparisonContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  optionSection: {
    gap: Spacing.md,
  },
  optionLabel: {
    fontWeight: '600',
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  optionImageContainer: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  optionUploadArea: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  uploadButtonsColumn: {
    flexDirection: 'column',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  optionUploadButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  optionDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  optionDisabledText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  outfitImageContainer: {
    marginVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  outfitImage: {
    width: '100%',
    height: 350,
    borderRadius: BorderRadius.lg,
  },
});
