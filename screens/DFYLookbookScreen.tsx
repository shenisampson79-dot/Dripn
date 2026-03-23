import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { dfyService, DFYOutfit, DFYLiteDelivery, StylistId } from "@/services/DFYService";
import { apiService } from "@/services/ApiService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

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

const STYLIST_COLORS: Record<NonNullable<StylistId>, { gradient: readonly [string, string]; accent: string }> = {
  ruby: { gradient: [LUXURY_COLORS.rose, LUXURY_COLORS.berry] as const, accent: LUXURY_COLORS.rose },
  max: { gradient: ['#64748B', '#475569'] as const, accent: '#64748B' },
  ace: { gradient: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const, accent: LUXURY_COLORS.teal },
  ivy: { gradient: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const, accent: LUXURY_COLORS.violet },
};

type DFYLookbookScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DFYLookbookScreen({ navigation }: DFYLookbookScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [delivery, setDelivery] = useState<DFYLiteDelivery | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<DFYOutfit | null>(null);
  const [showOutfitModal, setShowOutfitModal] = useState(false);
  const [currentDay, setCurrentDay] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingVisuals, setGeneratingVisuals] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDelivery();
  }, []);

  const loadDelivery = async () => {
    if (!user?.id) return;
    const saved = await dfyService.getDFYDelivery(user.id);
    if (saved && saved.tier === 'lite') {
      const liteDelivery = saved as DFYLiteDelivery;
      const totalDays = liteDelivery.totalDays || 14;

      // Normalise corrupted dayNumbers — if any outfit has a dayNumber > totalDays
      // the delivery was generated with the wrong formula and needs to be fixed in-place.
      const hasCorruptedDayNumbers = liteDelivery.outfits.some(o => o.dayNumber > totalDays);
      const normalised: DFYLiteDelivery = hasCorruptedDayNumbers
        ? {
            ...liteDelivery,
            outfits: liteDelivery.outfits.map((o, idx) => ({
              ...o,
              dayNumber: idx + 1,
              title: idx === 0 ? "Today's Look" : `Day ${idx + 1} Look`,
            })),
          }
        : liteDelivery;

      if (hasCorruptedDayNumbers) {
        // Persist the corrected delivery so it doesn't re-corrupt on next load
        await dfyService.saveDFYDelivery(normalised);
      }

      setDelivery(normalised);
      setCurrentDay(normalised.currentDay);

      // If all outfits have empty items, auto-generate real outfits from the wardrobe
      const allEmpty = normalised.outfits.every(o => !o.items || o.items.length === 0);
      if (allEmpty) {
        generateRealOutfits(normalised);
      } else {
        // Restore DB-cached visuals, then generate any that are missing
        restoreCachedVisuals(normalised);
      }
    }
  };

  const generateRealOutfits = async (existingDelivery: DFYLiteDelivery) => {
    if (!user?.id || isGenerating) return;
    setIsGenerating(true);
    try {
      const stylistId = user.stylistPreferences?.selectedStylistId || 'ruby';
      const result = await apiService.generateDFYDelivery({ tier: 'lite', stylistId });
      if (result.success && result.delivery) {
        const updatedDelivery: DFYLiteDelivery = {
          ...existingDelivery,
          outfits: result.delivery.outfits as any,
        };
        await dfyService.saveDFYDelivery(updatedDelivery);
        setDelivery(updatedDelivery);
        scheduleVisualGeneration(updatedDelivery);
      }
    } catch (err) {
      console.log('[DFYLookbook] Auto-generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Restore previously generated visuals from the DB cache, then fill any gaps
  const restoreCachedVisuals = async (currentDelivery: DFYLiteDelivery) => {
    const outfitsWithoutVisual = currentDelivery.outfits.filter(o => {
      if (!o.items || o.items.length === 0) return false;
      if (o.imageUri) return false;
      return !o.items.some(i => i.imageUri);
    });
    if (outfitsWithoutVisual.length === 0) return;

    let updatedOutfits = [...currentDelivery.outfits];
    let didUpdate = false;

    // Try to restore from DB cache first (fast, no generation cost)
    await Promise.all(outfitsWithoutVisual.map(async (outfit) => {
      try {
        const cached = await apiService.getDFYOutfitVisual(outfit.dayNumber);
        if (cached.success && cached.imageUrl) {
          updatedOutfits = updatedOutfits.map(o =>
            o.id === outfit.id ? { ...o, imageUri: cached.imageUrl! } : o
          );
          didUpdate = true;
        }
      } catch (_) {}
    }));

    if (didUpdate) {
      const saved: DFYLiteDelivery = { ...currentDelivery, outfits: updatedOutfits };
      await dfyService.saveDFYDelivery(saved);
      setDelivery({ ...currentDelivery, outfits: [...updatedOutfits] });
    }

    // Now generate visuals for any that still don't have one
    const stillMissing = updatedOutfits.filter(o => {
      if (!o.items || o.items.length === 0) return false;
      if (o.imageUri) return false;
      return !o.items.some(i => i.imageUri);
    });
    if (stillMissing.length > 0) {
      scheduleVisualGeneration({ ...currentDelivery, outfits: updatedOutfits });
    }
  };

  // Generate AI outfit visuals for outfits that have items but no imageUri and no item photos
  const scheduleVisualGeneration = async (currentDelivery: DFYLiteDelivery) => {
    const outfitsNeedingVisuals = currentDelivery.outfits.filter(o => {
      if (!o.items || o.items.length === 0) return false;
      if (o.imageUri) return false;
      return !o.items.some(i => i.imageUri);
    });
    if (outfitsNeedingVisuals.length === 0) return;

    let updatedOutfits = [...currentDelivery.outfits];

    // Generate 2 at a time to respect rate limits
    for (let i = 0; i < outfitsNeedingVisuals.length; i += 2) {
      const batch = outfitsNeedingVisuals.slice(i, i + 2);
      setGeneratingVisuals(prev => {
        const next = new Set(prev);
        batch.forEach(o => next.add(o.id));
        return next;
      });

      await Promise.all(batch.map(async (outfit) => {
        try {
          const result = await apiService.generateDFYOutfitVisual({
            outfitDay: outfit.dayNumber,
            outfitName: outfit.title || '',
            items: outfit.items.map(it => ({ name: it.name, category: it.category, color: it.color })),
            stylistNote: outfit.stylistNote || '',
            occasion: outfit.occasion || '',
            vibeLabel: (outfit as any).vibeLabel || '',
            stylist: outfit.stylistId || '',
          });
          if (result.success && result.imageUrl) {
            updatedOutfits = updatedOutfits.map(o =>
              o.id === outfit.id ? { ...o, imageUri: result.imageUrl! } : o
            );
            const saved: DFYLiteDelivery = { ...currentDelivery, outfits: updatedOutfits };
            await dfyService.saveDFYDelivery(saved);
            setDelivery({ ...currentDelivery, outfits: [...updatedOutfits] });
          }
        } catch (_) {}
        setGeneratingVisuals(prev => {
          const next = new Set(prev);
          next.delete(outfit.id);
          return next;
        });
      }));
    }
  };

  const generateSingleVisual = async (outfit: DFYOutfit) => {
    if (!delivery || generatingVisuals.has(outfit.id) || outfit.imageUri) return;
    setGeneratingVisuals(prev => new Set(prev).add(outfit.id));
    try {
      const result = await apiService.generateDFYOutfitVisual({
        outfitDay: outfit.dayNumber,
        outfitName: outfit.title || '',
        items: outfit.items.map(it => ({ name: it.name, category: it.category, color: it.color })),
        stylistNote: outfit.stylistNote || '',
        occasion: outfit.occasion || '',
        vibeLabel: (outfit as any).vibeLabel || '',
        stylist: outfit.stylistId || '',
      });
      if (result.success && result.imageUrl) {
        const updatedOutfits = delivery.outfits.map(o =>
          o.id === outfit.id ? { ...o, imageUri: result.imageUrl! } : o
        );
        const updatedDelivery = { ...delivery, outfits: updatedOutfits };
        await dfyService.saveDFYDelivery(updatedDelivery);
        setDelivery(updatedDelivery);
        if (selectedOutfit?.id === outfit.id) {
          setSelectedOutfit({ ...selectedOutfit, imageUri: result.imageUrl! });
        }
      }
    } catch (_) {}
    setGeneratingVisuals(prev => { const next = new Set(prev); next.delete(outfit.id); return next; });
  };

  const handleOutfitPress = (outfit: DFYOutfit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOutfit(outfit);
    setShowOutfitModal(true);
  };

  const handleReaction = async (reaction: 'love' | 'not-me') => {
    if (!selectedOutfit || !delivery) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const updatedOutfits = delivery.outfits.map(o =>
      o.id === selectedOutfit.id ? { ...o, userReaction: reaction } : o
    );
    
    const updatedDelivery = { ...delivery, outfits: updatedOutfits };
    await dfyService.saveDFYDelivery(updatedDelivery);
    setDelivery(updatedDelivery);
    setSelectedOutfit({ ...selectedOutfit, userReaction: reaction });
  };

  const handleSaveOutfit = async () => {
    if (!selectedOutfit || !delivery) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const updatedOutfits = delivery.outfits.map(o =>
      o.id === selectedOutfit.id ? { ...o, saved: true } : o
    );
    
    const updatedDelivery = { ...delivery, outfits: updatedOutfits };
    await dfyService.saveDFYDelivery(updatedDelivery);
    setDelivery(updatedDelivery);
    setSelectedOutfit({ ...selectedOutfit, saved: true });
  };

  const getDaysRemaining = (): number => {
    if (!delivery) return 14;
    const start = new Date(delivery.startDate);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 14 - elapsed);
  };

  const stylistColors = delivery?.outfits[0]?.stylistId
    ? STYLIST_COLORS[delivery.outfits[0].stylistId]
    : STYLIST_COLORS.ruby;

  const renderOutfitVisual = (outfit: DFYOutfit, height: number = 220) => {
    const colors = outfit.stylistId ? STYLIST_COLORS[outfit.stylistId] : STYLIST_COLORS.ruby;
    const itemsWithImages = (outfit.items || []).filter(i => i.imageUri);
    const isLoadingVisual = generatingVisuals.has(outfit.id);

    // Priority 1: outfit-level DALL-E generated image
    if (outfit.imageUri) {
      return (
        <Image
          source={{ uri: outfit.imageUri }}
          style={{ width: '100%', height }}
          contentFit="cover"
        />
      );
    }

    // Priority 2: real wardrobe item photos in a 2×2 grid
    if (itemsWithImages.length >= 2) {
      const photos = itemsWithImages.slice(0, 4);
      const halfH = height / 2;
      const halfW = (CARD_WIDTH) / 2;
      return (
        <View style={{ width: '100%', height, flexDirection: 'row', flexWrap: 'wrap' }}>
          {photos.map((it, k) => (
            <Image
              key={it.id}
              source={{ uri: it.imageUri! }}
              style={{ width: halfW, height: photos.length <= 2 ? height : halfH }}
              contentFit="cover"
            />
          ))}
        </View>
      );
    }

    // Priority 3: single item photo (fill the whole visual)
    if (itemsWithImages.length === 1) {
      return (
        <Image
          source={{ uri: itemsWithImages[0].imageUri! }}
          style={{ width: '100%', height }}
          contentFit="cover"
        />
      );
    }

    // Priority 4: AI visual generating — shimmer placeholder
    if (isLoadingVisual) {
      return (
        <LinearGradient
          colors={[colors.gradient[0] + '50', colors.gradient[1] + '30', colors.gradient[0] + '50']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.accent} size="small" />
          <ThemedText type="caption" style={{ color: colors.accent, marginTop: Spacing.sm, opacity: 0.9 }}>
            Styling your look...
          </ThemedText>
        </LinearGradient>
      );
    }

    // Fallback: styled gradient placeholder with tap-to-generate
    return (
      <Pressable
        onPress={() => generateSingleVisual(outfit)}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[colors.gradient[0] + '40', colors.gradient[1] + '20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }}
        >
          <Feather name="camera-off" size={28} color={colors.accent} style={{ opacity: 0.7 }} />
          <ThemedText type="caption" style={{ color: colors.accent, opacity: 0.85, textAlign: 'center' }}>
            Tap to generate outfit visual
          </ThemedText>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderOutfitCard = useCallback(({ item, index }: { item: DFYOutfit; index: number }) => {
    const isCurrentDay = item.dayNumber === currentDay;
    const colors = item.stylistId ? STYLIST_COLORS[item.stylistId] : STYLIST_COLORS.ruby;
    const hasItems = item.items && item.items.length > 0;
    const vibeLabel = (item as any).vibeLabel as string | undefined;

    return (
      <Pressable
        onPress={() => handleOutfitPress(item)}
        style={({ pressed }) => [
          styles.outfitCard,
          { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        <View style={[styles.outfitCardGradient, { backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' }]}>
          {/* Visual section — full-width image/collage */}
          <View style={styles.outfitImageContainer}>
            {renderOutfitVisual(item, 220)}

            {/* Overlaid badges */}
            {isCurrentDay && (
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.currentDayBadge}
              >
                <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  Today
                </ThemedText>
              </LinearGradient>
            )}
            {item.saved && (
              <View style={[styles.savedBadgeOverlay, { backgroundColor: LUXURY_COLORS.emerald }]}>
                <Feather name="bookmark" size={12} color="#FFFFFF" />
              </View>
            )}
            {item.userReaction && (
              <View style={[styles.reactionOverlay, { backgroundColor: item.userReaction === 'love' ? LUXURY_COLORS.rose + 'EE' : LUXURY_COLORS.coral + 'EE' }]}>
                <Feather name={item.userReaction === 'love' ? 'heart' : 'x'} size={12} color="#FFFFFF" />
              </View>
            )}

            {/* Gradient fade into info section */}
            <LinearGradient
              colors={['transparent', isDark ? 'rgba(30,30,46,0.85)' : 'rgba(255,255,255,0.85)']}
              style={styles.imageBottomFade}
            />
          </View>

          {/* Info section */}
          <View style={styles.outfitInfo}>
            <View style={styles.outfitTitleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="caption" style={{ opacity: 0.5, marginBottom: 2 }}>
                  Day {item.dayNumber} of 14
                </ThemedText>
                <ThemedText type="h3" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                {vibeLabel ? (
                  <View style={[styles.vibeBadge, { backgroundColor: colors.accent + '20' }]}>
                    <ThemedText type="caption" style={{ color: colors.accent, fontWeight: '600' }}>
                      {vibeLabel}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            {item.stylistNote ? (
              <View style={[styles.stylistNotePreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <View style={[styles.stylistAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="user" size={10} color="#FFFFFF" />
                </View>
                <ThemedText type="small" numberOfLines={2} style={{ flex: 1, opacity: 0.8, fontStyle: 'italic' }}>
                  "{item.stylistNote}"
                </ThemedText>
              </View>
            ) : null}

            {hasItems ? (
              <View style={styles.itemPillsRow}>
                {item.items.slice(0, 3).map((it, k) => (
                  <View key={k} style={[styles.itemPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <ThemedText type="caption" numberOfLines={1} style={{ opacity: 0.75 }}>
                      {it.name}
                    </ThemedText>
                  </View>
                ))}
                {item.items.length > 3 ? (
                  <View style={[styles.itemPill, { backgroundColor: colors.accent + '25' }]}>
                    <ThemedText type="caption" style={{ color: colors.accent }}>
                      +{item.items.length - 3}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }, [currentDay, isDark, generatingVisuals, delivery]);

  const renderOutfitModal = () => {
    if (!selectedOutfit) return null;
    const colors = selectedOutfit.stylistId ? STYLIST_COLORS[selectedOutfit.stylistId] : STYLIST_COLORS.ruby;

    return (
      <Modal
        visible={showOutfitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOutfitModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={[colors.gradient[0] + '30', 'transparent']}
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowOutfitModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">{selectedOutfit.title}</ThemedText>
              <Pressable
                onPress={handleSaveOutfit}
                style={[styles.modalCloseButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              >
                <Feather
                  name="bookmark"
                  size={20}
                  color={selectedOutfit.saved ? LUXURY_COLORS.gold : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </LinearGradient>

          <FlatList
            data={[selectedOutfit]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                {/* Main outfit visual */}
                <View style={[styles.outfitDetailImage, { overflow: 'hidden', borderRadius: BorderRadius.lg, backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                  {renderOutfitVisual(selectedOutfit, 300)}
                </View>

                {/* Item breakdown — horizontal scroll of item photos/pills */}
                {selectedOutfit.items && selectedOutfit.items.length > 0 ? (
                  <View style={styles.modalItemsSection}>
                    <ThemedText type="small" style={{ opacity: 0.5, marginBottom: Spacing.sm, marginLeft: Spacing.xs }}>
                      The pieces ({selectedOutfit.items.length})
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                      {selectedOutfit.items.map((wardrobeItem) => (
                        <View key={wardrobeItem.id} style={styles.modalItemCard}>
                          {wardrobeItem.imageUri ? (
                            <Image source={{ uri: wardrobeItem.imageUri }} style={styles.modalItemImage} contentFit="cover" />
                          ) : (
                            <View style={[styles.modalItemImage, { backgroundColor: isDark ? '#2A2A3E' : '#F0EDE8', alignItems: 'center', justifyContent: 'center' }]}>
                              <Feather name="package" size={20} color={colors.accent} />
                            </View>
                          )}
                          <ThemedText type="caption" numberOfLines={1} style={{ marginTop: 4, textAlign: 'center', maxWidth: 80 }}>
                            {wardrobeItem.name}
                          </ThemedText>
                          <ThemedText type="caption" style={{ opacity: 0.45, textAlign: 'center' }}>
                            {wardrobeItem.category}
                          </ThemedText>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {selectedOutfit.stylistNote && (
                  <View style={[styles.stylistNoteCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <LinearGradient
                      colors={colors.gradient}
                      style={styles.stylistNoteAvatar}
                    >
                      <Feather name="user" size={16} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.stylistNoteContent}>
                      <ThemedText type="small" style={{ color: colors.accent, fontWeight: '600' }}>
                        Stylist Note
                      </ThemedText>
                      <ThemedText style={{ marginTop: 4, lineHeight: 22 }}>
                        "{selectedOutfit.stylistNote}"
                      </ThemedText>
                    </View>
                  </View>
                )}

                <View style={styles.reactionSection}>
                  <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                    What do you think?
                  </ThemedText>
                  <View style={styles.reactionButtons}>
                    <Pressable
                      onPress={() => handleReaction('love')}
                      style={[
                        styles.reactionButton,
                        selectedOutfit.userReaction === 'love' && { borderColor: LUXURY_COLORS.rose, borderWidth: 2 }
                      ]}
                    >
                      <LinearGradient
                        colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                        style={styles.reactionButtonGradient}
                      >
                        <Feather name="heart" size={24} color="#FFFFFF" />
                      </LinearGradient>
                      <ThemedText type="small" style={{ marginTop: 6 }}>Love</ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => handleReaction('not-me')}
                      style={[
                        styles.reactionButton,
                        selectedOutfit.userReaction === 'not-me' && { borderColor: LUXURY_COLORS.coral, borderWidth: 2 }
                      ]}
                    >
                      <LinearGradient
                        colors={[LUXURY_COLORS.coral, '#C46A4F']}
                        style={styles.reactionButtonGradient}
                      >
                        <Feather name="x" size={24} color="#FFFFFF" />
                      </LinearGradient>
                      <ThemedText type="small" style={{ marginTop: 6 }}>Not me</ThemedText>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.infoNote, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <Feather name="info" size={16} color={theme.tabIconDefault} />
                  <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, opacity: 0.7 }}>
                    This is a stylist-led outfit. If you'd like to swap items yourself, consider upgrading to Core Wardrobe.
                  </ThemedText>
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (!delivery) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={[LUXURY_COLORS.coral, '#C46A4F', LUXURY_COLORS.obsidian]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>My Lookbook</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Feather name="book-open" size={64} color="rgba(255,255,255,0.3)" />
          <ThemedText type="h3" style={{ color: '#FFFFFF', marginTop: Spacing.lg }}>
            No lookbook yet
          </ThemedText>
          <ThemedText style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: Spacing.sm }}>
            Purchase Outfit-Based Setup to get your personalized 14-day style plan
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[stylistColors.gradient[0], stylistColors.gradient[1], LUXURY_COLORS.obsidian]}
        locations={[0, 0.25, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>My Lookbook</ThemedText>
          <View style={[styles.daysRemainingBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
              {getDaysRemaining()} days left
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate('DFYCalendar', { tier: 'lite' })}
          style={styles.calendarButton}
        >
          <Feather name="calendar" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={[stylistColors.accent, stylistColors.gradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${(currentDay / 14) * 100}%` }]}
          />
        </View>
        <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          Day {currentDay} of 14
        </ThemedText>
      </View>

      {isGenerating && (
        <View style={[styles.generatingBanner, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: Spacing.sm }}>
            Your stylist is curating your outfits from your wardrobe...
          </ThemedText>
        </View>
      )}

      <FlatList
        data={delivery.outfits}
        renderItem={renderOutfitCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          !isGenerating ? (
            <Pressable
              onPress={() => delivery && generateRealOutfits(delivery)}
              style={[styles.regenerateButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
            >
              <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.7)" />
              <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)', marginLeft: Spacing.xs }}>
                Refresh outfits from wardrobe
              </ThemedText>
            </Pressable>
          ) : null
        }
      />

      {renderOutfitModal()}
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
    marginBottom: Spacing.md,
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
  },
  daysRemainingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  outfitCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  outfitCardGradient: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  outfitImageContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  imageBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  currentDayBadge: {
    position: 'absolute',
    top: 0,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    zIndex: 10,
  },
  savedBadgeOverlay: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reactionOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  outfitInfo: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  outfitTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vibeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  stylistNotePreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  stylistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  itemPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    maxWidth: 140,
  },
  savedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalItemsSection: {
    marginBottom: Spacing.lg,
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: Spacing.xl,
  },
  outfitDetailImage: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  modalItemCard: {
    width: 120,
    alignItems: 'center',
  },
  modalItemImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  stylistNoteCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  stylistNoteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistNoteContent: {
    flex: 1,
  },
  reactionSection: {
    marginBottom: Spacing.lg,
  },
  reactionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  reactionButton: {
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  reactionButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
