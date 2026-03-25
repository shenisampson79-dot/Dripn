import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Dimensions,
  Animated,
  Modal,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import apiService from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = 100;
const ITEM_MARGIN = Spacing.sm;

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

const CATEGORY_ROWS: { key: ClothingCategory; label: string; icon: string; gradient: readonly [string, string] }[] = [
  { key: 'outerwear', label: 'Outerwear', icon: 'cloud', gradient: ['#64748B', '#475569'] as const },
  { key: 'tops', label: 'Tops', icon: 'sun', gradient: [LUXURY_COLORS.coral, '#C46A4F'] as const },
  { key: 'bottoms', label: 'Bottoms', icon: 'minimize-2', gradient: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const },
  { key: 'shoes', label: 'Shoes', icon: 'disc', gradient: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const },
  { key: 'accessories', label: 'Accessories', icon: 'watch', gradient: ['#8B5CF6', '#7C3AED'] as const },
];

type DFYModularWardrobeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type ModularCategory = 'tops' | 'bottoms' | 'outerwear' | 'shoes' | 'accessories';

type SelectedItems = {
  [K in ModularCategory]: WardrobeItem | null;
};

export default function DFYModularWardrobeScreen({ navigation }: DFYModularWardrobeScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { items } = useWardrobe();
  const insets = useSafeAreaInsets();
  const { paddingBottom: tabAwarePaddingBottom } = useScreenInsets();

  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    tops: null,
    bottoms: null,
    outerwear: null,
    shoes: null,
    accessories: null,
  });
  const [showOutfitPreview, setShowOutfitPreview] = useState(false);
  const [compatibilityScore, setCompatibilityScore] = useState<number | null>(null);
  const [compatibilityVerdict, setCompatibilityVerdict] = useState<string | null>(null);
  const [compatibilityAnalysis, setCompatibilityAnalysis] = useState<string | null>(null);
  const [compatibilityViolations, setCompatibilityViolations] = useState<string[]>([]);
  const [compatibilityImprovements, setCompatibilityImprovements] = useState<string[]>([]);
  const [isCheckingCompatibility, setIsCheckingCompatibility] = useState(false);
  const [occasionRulesApplied, setOccasionRulesApplied] = useState<string | null>(null);

  const scrollRefs = useRef<Record<string, FlatList<WardrobeItem> | null>>({});
  const rotationAnimations = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    CATEGORY_ROWS.forEach(row => {
      rotationAnimations.current[row.key] = new Animated.Value(0);
    });
  }, []);

  const getItemsByCategory = (category: ClothingCategory): WardrobeItem[] => {
    // Include activewear in their respective main categories
    if (category === 'tops') {
      return items.filter(item => item.category === 'tops' || item.category === 'activewear_tops');
    }
    if (category === 'bottoms') {
      return items.filter(item => item.category === 'bottoms' || item.category === 'activewear_bottoms');
    }
    return items.filter(item => item.category === category);
  };

  const handleItemSelect = (category: ModularCategory, item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItems(prev => ({
      ...prev,
      [category]: prev[category]?.id === item.id ? null : item,
    }));
    calculateCompatibility();
  };

  const handleRotateCategory = (category: ModularCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const categoryItems = getItemsByCategory(category as ClothingCategory);
    if (categoryItems.length === 0) return;

    const currentItem = selectedItems[category];
    const currentIndex = currentItem ? categoryItems.findIndex(i => i.id === currentItem.id) : -1;
    const nextIndex = (currentIndex + 1) % categoryItems.length;

    setSelectedItems(prev => ({
      ...prev,
      [category]: categoryItems[nextIndex],
    }));

    Animated.sequence([
      Animated.timing(rotationAnimations.current[category], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnimations.current[category], {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    calculateCompatibility();
  };

  const calculateCompatibility = async () => {
    const selected = Object.values(selectedItems).filter(Boolean) as WardrobeItem[];
    if (selected.length < 2) {
      setCompatibilityScore(null);
      setCompatibilityVerdict(null);
      setCompatibilityAnalysis(null);
      setCompatibilityViolations([]);
      setCompatibilityImprovements([]);
      setOccasionRulesApplied(null);
      return;
    }

    try {
      setIsCheckingCompatibility(true);
      const itemIds = selected.map(item => item.id);
      
      const result = await apiService.checkOutfitCompatibility({
        items: itemIds,
        stylistId: 'ruby',
        occasion: 'casual_day',
      });

      if (result.success && result.score !== undefined) {
        setCompatibilityScore(Math.round(result.score));
        setCompatibilityVerdict(result.verdict || null);
        setCompatibilityAnalysis(result.analysis || null);
        setCompatibilityViolations(result.hardRuleViolations || []);
        setCompatibilityImprovements(result.improvements || []);
        setOccasionRulesApplied(result.occasionRulesApplied || null);
      } else {
        setCompatibilityScore(null);
        setCompatibilityVerdict(null);
        setCompatibilityAnalysis(null);
        setCompatibilityViolations([]);
        setCompatibilityImprovements([]);
        setOccasionRulesApplied(null);
      }
    } catch (error) {
      console.error('Failed to calculate compatibility:', error);
      setCompatibilityScore(null);
    } finally {
      setIsCheckingCompatibility(false);
    }
  };

  const handleViewOutfit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowOutfitPreview(true);
  };

  const handleSaveOutfit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const outfitItems = Object.entries(selectedItems)
        .filter(([_, item]) => item !== null)
        .map(([_, item]) => (item as WardrobeItem).id);

      if (outfitItems.length === 0) {
        Alert.alert('No items selected', 'Please select at least one item to save');
        return;
      }

      setShowOutfitPreview(false);
      Alert.alert('Outfit Saved', 'Your outfit has been saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save outfit');
    }
  };

  const getSelectedCount = (): number => {
    return Object.values(selectedItems).filter(Boolean).length;
  };

  const renderCategoryRow = ({ key, label, icon, gradient }: typeof CATEGORY_ROWS[0]) => {
    const categoryItems = getItemsByCategory(key as ClothingCategory);
    const selected = selectedItems[key as ModularCategory];
    const rotation = rotationAnimations.current[key] || new Animated.Value(0);

    const rotateInterpolate = rotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View key={key} style={styles.categoryRow}>
        <View style={styles.categoryHeader}>
          <LinearGradient
            colors={gradient}
            style={styles.categoryIconContainer}
          >
            <Feather name={icon as any} size={16} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h3" style={{ flex: 1 }}>{label}</ThemedText>
          <View style={[styles.categoryCount, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <ThemedText type="caption">{categoryItems.length}</ThemedText>
          </View>
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Pressable
              onPress={() => handleRotateCategory(key as ModularCategory)}
              style={[styles.rotateButton, { backgroundColor: gradient[0] + '20' }]}
            >
              <Feather name="refresh-cw" size={18} color={gradient[0]} />
            </Pressable>
          </Animated.View>
        </View>

        {categoryItems.length > 0 ? (
          <FlatList
            ref={(ref) => { scrollRefs.current[key] = ref; }}
            data={categoryItems}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemsScrollContent}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              return (
                <Pressable
                  onPress={() => handleItemSelect(key as ModularCategory, item)}
                  style={({ pressed }) => [
                    styles.itemCard,
                    { opacity: pressed ? 0.9 : 1 },
                    isSelected && { borderColor: gradient[0], borderWidth: 3 },
                  ]}
                >
                  <View style={[styles.itemImageContainer, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.itemImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Feather name="image" size={32} color={theme.tabIconDefault} />
                    )}
                  </View>
                  {isSelected && (
                    <LinearGradient
                      colors={gradient}
                      style={styles.selectedIndicator}
                    >
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </LinearGradient>
                  )}
                  {item.isFavorite && (
                    <View style={styles.favoriteIndicator}>
                      <Feather name="star" size={10} color={LUXURY_COLORS.gold} />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        ) : (
          <View style={[styles.emptyCategory, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
            <ThemedText type="small" style={{ opacity: 0.5 }}>
              No {label.toLowerCase()} added yet
            </ThemedText>
          </View>
        )}
      </View>
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold, LUXURY_COLORS.obsidian]}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>Modular Wardrobe</ThemedText>
          <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Rotate & mix items like Clueless
          </ThemedText>
        </View>
        <Pressable
          onPress={() => navigation.navigate('DFYCalendar', { tier: 'core' })}
          style={styles.calendarButton}
        >
          <Feather name="calendar" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScreenScrollView style={{ backgroundColor: 'transparent', flex: 1 }}>
        <View style={styles.content}>
          {CATEGORY_ROWS.map(renderCategoryRow)}
        </View>
      </ScreenScrollView>

      {getSelectedCount() > 0 && (
        <View style={[styles.floatingBar, { bottom: tabAwarePaddingBottom - Spacing.xl }]}>
          <LinearGradient
            colors={isDark ? ['#1A1A2E', '#0D0B09'] : ['#FFFFFF', '#F8F4F0']}
            style={styles.floatingBarGradient}
          >
            <View style={styles.floatingBarContent}>
              <View>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  {getSelectedCount()} items selected
                </ThemedText>
                {isCheckingCompatibility ? (
                  <ThemedText type="caption" style={{ opacity: 0.7 }}>Analysing outfit...</ThemedText>
                ) : compatibilityScore !== null ? (
                  <ThemedText type="caption" style={{
                    opacity: 0.9,
                    color: compatibilityScore >= 70 ? LUXURY_COLORS.emerald : compatibilityScore >= 40 ? LUXURY_COLORS.gold : LUXURY_COLORS.coral,
                    fontWeight: '600',
                  }}>
                    {compatibilityScore}/100 · {compatibilityVerdict || 'Scored'}
                  </ThemedText>
                ) : null}
              </View>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.viewOutfitButton}
              >
                <Pressable onPress={handleViewOutfit} style={styles.viewOutfitButtonInner}>
                  <Feather name="eye" size={18} color={LUXURY_COLORS.midnight} />
                  <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700', marginLeft: Spacing.sm }}>
                    View Outfit
                  </ThemedText>
                </Pressable>
              </LinearGradient>
            </View>
          </LinearGradient>
        </View>
      )}

      {showOutfitPreview && (
        <Modal
          visible={showOutfitPreview}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowOutfitPreview(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold + '30', 'transparent']}
              style={styles.modalHeaderGradient}
            >
              <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
                <Pressable
                  onPress={() => setShowOutfitPreview(false)}
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
                <ThemedText type="h3">Your Outfit</ThemedText>
                <View style={{ width: 40 }} />
              </View>
            </LinearGradient>

            <ScreenScrollView style={[{ backgroundColor: 'transparent' }]}>
              <View style={styles.outfitPreviewGrid}>
                {(['outerwear', 'tops', 'bottoms', 'shoes', 'accessories'] as const).map((category) => {
                  const item = selectedItems[category];
                  if (!item) return null;
                  return (
                    <View key={category} style={styles.previewItem}>
                      <View style={[styles.previewImageContainer, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                        {item.imageUri ? (
                          <Image
                            source={{ uri: item.imageUri }}
                            style={styles.previewImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Feather name="image" size={48} color={theme.tabIconDefault} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {isCheckingCompatibility && (
                <View style={[styles.compatibilityCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.xl }]}>
                  <Feather name="loader" size={24} color={LUXURY_COLORS.gold} />
                  <ThemedText type="caption" style={{ opacity: 0.7, marginTop: Spacing.sm }}>Analysing outfit with 20-rule system...</ThemedText>
                </View>
              )}
              {!isCheckingCompatibility && compatibilityScore !== null && (
                <View style={[styles.compatibilityCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <LinearGradient
                    colors={
                      compatibilityScore >= 80
                        ? [LUXURY_COLORS.emerald, LUXURY_COLORS.teal]
                        : compatibilityScore >= 55
                        ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
                        : [LUXURY_COLORS.coral, '#C46A4F']
                    }
                    style={styles.compatibilityScoreContainer}
                  >
                    <ThemedText type="h1" style={{ color: '#FFFFFF' }}>{compatibilityScore}</ThemedText>
                    <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>/100</ThemedText>
                  </LinearGradient>
                  <View style={styles.compatibilityInfo}>
                    <ThemedText type="h3">{compatibilityVerdict || 'Compatibility Score'}</ThemedText>
                    {compatibilityAnalysis ? (
                      <ThemedText type="small" style={{ opacity: 0.7, marginTop: 4 }}>{compatibilityAnalysis}</ThemedText>
                    ) : null}
                    {occasionRulesApplied ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm }}>
                        <Feather name="calendar" size={11} color={LUXURY_COLORS.gold} style={{ marginRight: 4 }} />
                        <ThemedText type="caption" style={{ color: LUXURY_COLORS.gold, opacity: 0.85, fontSize: 11 }}>{occasionRulesApplied}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              {!isCheckingCompatibility && compatibilityViolations.length > 0 && (
                <View style={[styles.compatibilityCard, { backgroundColor: isDark ? 'rgba(224,122,95,0.1)' : 'rgba(224,122,95,0.08)', marginTop: Spacing.sm }]}>
                  <Feather name="alert-circle" size={18} color={LUXURY_COLORS.coral} style={{ marginRight: Spacing.sm, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: LUXURY_COLORS.coral, fontWeight: '700', marginBottom: 4 }}>Rule Violations</ThemedText>
                    {compatibilityViolations.map((v, i) => (
                      <ThemedText key={i} type="caption" style={{ opacity: 0.8, marginBottom: 2 }}>• {v}</ThemedText>
                    ))}
                  </View>
                </View>
              )}
              {!isCheckingCompatibility && compatibilityImprovements.length > 0 && (
                <View style={[styles.compatibilityCard, { backgroundColor: isDark ? 'rgba(5,150,105,0.1)' : 'rgba(5,150,105,0.08)', marginTop: Spacing.sm }]}>
                  <Feather name="trending-up" size={18} color={LUXURY_COLORS.emerald} style={{ marginRight: Spacing.sm, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: LUXURY_COLORS.emerald, fontWeight: '700', marginBottom: 4 }}>Improvements</ThemedText>
                    {compatibilityImprovements.map((imp, i) => (
                      <ThemedText key={i} type="caption" style={{ opacity: 0.8, marginBottom: 2 }}>• {imp}</ThemedText>
                    ))}
                  </View>
                </View>
              )}
            </ScreenScrollView>

            <View style={[styles.modalFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
              <LinearGradient
                colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.saveOutfitButton}
              >
                <Pressable style={styles.saveOutfitButtonInner} onPress={handleSaveOutfit}>
                  <Feather name="bookmark" size={18} color={LUXURY_COLORS.midnight} />
                  <ThemedText type="body" style={{ color: LUXURY_COLORS.midnight, fontWeight: '700', marginLeft: Spacing.sm }}>
                    Save This Outfit
                  </ThemedText>
                </Pressable>
              </LinearGradient>

              <Pressable
                onPress={() => navigation.navigate('DFYCalendar', { tier: 'core' })}
                style={[styles.scheduleButton, { borderColor: LUXURY_COLORS.gold }]}
              >
                <Feather name="calendar" size={18} color={LUXURY_COLORS.gold} />
                <ThemedText type="body" style={{ color: LUXURY_COLORS.gold, marginLeft: Spacing.sm }}>
                  Schedule in Calendar
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: 180,
  },
  categoryRow: {
    gap: Spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  rotateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsScrollContent: {
    gap: ITEM_MARGIN,
    paddingVertical: Spacing.xs,
  },
  itemCard: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  itemImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCategory: {
    height: ITEM_SIZE,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  floatingBarGradient: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewOutfitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  viewOutfitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xl,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  previewItem: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2,
    gap: Spacing.sm,
  },
  previewImageContainer: {
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewItemInfo: {
    alignItems: 'center',
  },
  compatibilityCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  compatibilityScoreContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compatibilityInfo: {
    flex: 1,
  },
  saveOutfitButton: {
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  saveOutfitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  modalFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});
