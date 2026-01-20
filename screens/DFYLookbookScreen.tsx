import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Dimensions,
  Modal,
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

  useEffect(() => {
    loadDelivery();
  }, []);

  const loadDelivery = async () => {
    if (!user?.id) return;
    const saved = await dfyService.getDFYDelivery(user.id);
    if (saved && saved.tier === 'lite') {
      setDelivery(saved as DFYLiteDelivery);
      setCurrentDay(saved.currentDay);
    }
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

  const renderOutfitCard = useCallback(({ item, index }: { item: DFYOutfit; index: number }) => {
    const isCurrentDay = item.dayNumber === currentDay;
    const isPast = item.dayNumber < currentDay;
    const colors = item.stylistId ? STYLIST_COLORS[item.stylistId] : STYLIST_COLORS.ruby;

    return (
      <Pressable
        onPress={() => handleOutfitPress(item)}
        style={({ pressed }) => [
          styles.outfitCard,
          { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        <LinearGradient
          colors={isDark ? ['#2A2A3E', '#1E1E2E'] : ['#FFFFFF', '#F8F4F0']}
          style={styles.outfitCardGradient}
        >
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

          <View style={styles.outfitImageContainer}>
            <LinearGradient
              colors={[colors.gradient[0] + '40', colors.gradient[1] + '20']}
              style={styles.outfitImagePlaceholder}
            >
              <Feather name="image" size={48} color={colors.accent} />
              <ThemedText type="caption" style={{ color: colors.accent, marginTop: Spacing.sm }}>
                Outfit {index + 1}
              </ThemedText>
            </LinearGradient>
          </View>

          <View style={styles.outfitInfo}>
            <View style={styles.outfitTitleRow}>
              <ThemedText type="h3" numberOfLines={1}>
                {item.title}
              </ThemedText>
              {item.saved && (
                <View style={[styles.savedBadge, { backgroundColor: LUXURY_COLORS.emerald }]}>
                  <Feather name="bookmark" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>

            <ThemedText type="small" style={{ opacity: 0.6, marginTop: 2 }}>
              Day {item.dayNumber} of 14
            </ThemedText>

            {item.stylistNote && (
              <View style={[styles.stylistNotePreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <View style={[styles.stylistAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="user" size={10} color="#FFFFFF" />
                </View>
                <ThemedText type="small" numberOfLines={2} style={{ flex: 1, opacity: 0.8 }}>
                  "{item.stylistNote}"
                </ThemedText>
              </View>
            )}

            {item.userReaction && (
              <View style={styles.reactionIndicator}>
                <Feather
                  name={item.userReaction === 'love' ? 'heart' : 'x'}
                  size={14}
                  color={item.userReaction === 'love' ? LUXURY_COLORS.rose : LUXURY_COLORS.coral}
                />
                <ThemedText type="caption" style={{ marginLeft: 4, opacity: 0.7 }}>
                  {item.userReaction === 'love' ? 'Loved' : 'Not for me'}
                </ThemedText>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    );
  }, [currentDay, isDark]);

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
                <View style={[styles.outfitDetailImage, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                  <LinearGradient
                    colors={[colors.gradient[0] + '40', colors.gradient[1] + '20']}
                    style={styles.detailImagePlaceholder}
                  >
                    <Feather name="image" size={80} color={colors.accent} />
                    <ThemedText style={{ color: colors.accent, marginTop: Spacing.md }}>
                      Complete Outfit Photo
                    </ThemedText>
                  </LinearGradient>
                </View>

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

      <FlatList
        data={delivery.outfits}
        renderItem={renderOutfitCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
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
  outfitImageContainer: {
    aspectRatio: 16 / 9,
  },
  outfitImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitInfo: {
    padding: Spacing.lg,
  },
  outfitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistNotePreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  stylistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
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
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  detailImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
