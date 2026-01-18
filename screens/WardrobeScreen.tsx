import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

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
};

const CATEGORY_COLORS: Record<string, { gradient: readonly [string, string]; icon: string }> = {
  'all': { gradient: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const, icon: 'grid' },
  'tops': { gradient: [LUXURY_COLORS.coral, '#C46A4F'] as const, icon: 'sun' },
  'bottoms': { gradient: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald] as const, icon: 'minimize-2' },
  'dresses': { gradient: [LUXURY_COLORS.rose, '#D4949A'] as const, icon: 'heart' },
  'outerwear': { gradient: ['#64748B', '#475569'] as const, icon: 'cloud' },
  'shoes': { gradient: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const, icon: 'disc' },
  'bags': { gradient: [LUXURY_COLORS.berry, '#6B2430'] as const, icon: 'shopping-bag' },
  'accessories': { gradient: ['#8B5CF6', '#7C3AED'] as const, icon: 'watch' },
  'activewear': { gradient: ['#06B6D4', '#0891B2'] as const, icon: 'activity' },
  'formal': { gradient: ['#1E293B', '#0F172A'] as const, icon: 'star' },
};

type WardrobeScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Wardrobe">;
};

const CATEGORY_OPTIONS: Array<{ key: ClothingCategory | 'all'; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'tops', label: 'Tops', icon: 'sun' },
  { key: 'bottoms', label: 'Bottoms', icon: 'minimize-2' },
  { key: 'dresses', label: 'Dresses', icon: 'heart' },
  { key: 'outerwear', label: 'Outerwear', icon: 'cloud' },
  { key: 'shoes', label: 'Shoes', icon: 'disc' },
  { key: 'bags', label: 'Bags', icon: 'shopping-bag' },
  { key: 'accessories', label: 'Accessories', icon: 'watch' },
  { key: 'activewear', label: 'Active', icon: 'activity' },
  { key: 'formal', label: 'Formal', icon: 'star' },
];

export default function WardrobeScreen({ navigation }: WardrobeScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { items, isLoading, deleteItem, toggleItemFavorite, markItemWorn } = useWardrobe();
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  const handleAddItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddWardrobeItem");
  };

  const handleQuickAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BulkWardrobeUpload");
  };

  const handleItemPress = (item: WardrobeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (item: WardrobeItem) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to remove "${item.name}" from your wardrobe?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(item.id);
              setShowItemModal(false);
              setSelectedItem(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert("Error", "Failed to delete item");
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (item: WardrobeItem) => {
    try {
      await toggleItemFavorite(item.id);
      setSelectedItem({ ...item, isFavorite: !item.isFavorite });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to update favorite status");
    }
  };

  const handleMarkWorn = async (item: WardrobeItem) => {
    try {
      await markItemWorn(item.id);
      setSelectedItem({ ...item, timesWorn: item.timesWorn + 1 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Logged", `Marked "${item.name}" as worn today`);
    } catch (error) {
      Alert.alert("Error", "Failed to log wear");
    }
  };

  const renderCategoryTab = useCallback(({ item }: { item: typeof CATEGORY_OPTIONS[0] }) => {
    const isSelected = selectedCategory === item.key;
    const colors = CATEGORY_COLORS[item.key] || CATEGORY_COLORS['all'];
    
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCategory(item.key);
        }}
        style={styles.categoryTabWrapper}
      >
        {isSelected ? (
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryTab}
          >
            <Feather name={item.icon as any} size={14} color="#FFFFFF" />
            <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {item.label}
            </ThemedText>
          </LinearGradient>
        ) : (
          <View style={[styles.categoryTab, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <Feather name={item.icon as any} size={14} color={theme.tabIconDefault} />
            <ThemedText type="caption">{item.label}</ThemedText>
          </View>
        )}
      </Pressable>
    );
  }, [selectedCategory, theme, isDark]);

  const renderWardrobeItem = useCallback(({ item }: { item: WardrobeItem }) => {
    const hasProcessedImage = item.imageProcessed || item.aiAnalyzed;
    const categoryColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['all'];
    
    return (
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.itemCard,
          {
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.itemImageWrapper, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
          <Image
            source={{ uri: item.imageUri }}
            style={styles.itemImage}
            contentFit={hasProcessedImage ? "contain" : "cover"}
            transition={200}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.itemOverlay}
          />
          <View style={styles.itemInfoOverlay}>
            <ThemedText type="caption" numberOfLines={1} style={styles.itemNameOverlay}>
              {item.name}
            </ThemedText>
            <ThemedText type="caption" style={styles.itemWornText}>
              Worn {item.timesWorn}x
            </ThemedText>
          </View>
        </View>
        {item.isFavorite ? (
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.coral]}
            style={styles.favoriteIndicator}
          >
            <Feather name="heart" size={10} color="#FFFFFF" />
          </LinearGradient>
        ) : null}
        <View style={styles.categoryIndicator}>
          <LinearGradient
            colors={categoryColors.gradient}
            style={styles.categoryDot}
          />
        </View>
      </Pressable>
    );
  }, [theme, isDark]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[LUXURY_COLORS.violet + '30', LUXURY_COLORS.rose + '20']}
        style={styles.emptyIconContainer}
      >
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.emptyIconGradient}
        >
          <Feather name="inbox" size={32} color="#FFFFFF" />
        </LinearGradient>
      </LinearGradient>
      <ThemedText type="h2" style={styles.emptyTitle}>
        Your wardrobe awaits
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        Start building your digital closet by adding photos of your favorite pieces
      </ThemedText>
      <LinearGradient
        colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.emptyButtonGradient}
      >
        <Pressable onPress={handleQuickAdd} style={styles.emptyButtonInner}>
          <Feather name="layers" size={18} color={LUXURY_COLORS.midnight} />
          <ThemedText type="body" style={styles.emptyButtonText}>
            Quick Add Multiple Items
          </ThemedText>
        </Pressable>
      </LinearGradient>
      <Pressable
        onPress={handleAddItem}
        style={[styles.emptyButtonSecondary, { borderColor: LUXURY_COLORS.gold }]}
      >
        <Feather name="plus" size={18} color={LUXURY_COLORS.gold} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: LUXURY_COLORS.gold }}>
          Add Single Item
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderItemModal = () => {
    if (!selectedItem) return null;
    const categoryColors = CATEGORY_COLORS[selectedItem.category] || CATEGORY_COLORS['all'];
    
    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <LinearGradient
            colors={isDark 
              ? [categoryColors.gradient[0] + '40', 'transparent'] 
              : [categoryColors.gradient[0] + '20', 'transparent']
            }
            style={styles.modalHeaderGradient}
          >
            <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                onPress={() => setShowItemModal(false)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">Item Details</ThemedText>
              <Pressable
                onPress={() => handleToggleFavorite(selectedItem)}
                style={[styles.modalCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={selectedItem.isFavorite ? LUXURY_COLORS.coral : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </LinearGradient>

          <FlatList
            data={[selectedItem]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                <View style={[styles.modalImageWrapper, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
                  <Image
                    source={{ uri: selectedItem.imageUri }}
                    style={styles.modalImage}
                    contentFit={selectedItem.imageProcessed || selectedItem.aiAnalyzed ? "contain" : "cover"}
                    transition={300}
                  />
                </View>

                <View style={styles.modalInfo}>
                  <ThemedText type="h2" style={styles.modalItemName}>
                    {selectedItem.name}
                  </ThemedText>

                  <View style={styles.modalTags}>
                    <LinearGradient
                      colors={categoryColors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalTagGradient}
                    >
                      <Feather name="tag" size={12} color="#FFFFFF" />
                      <ThemedText type="caption" style={{ color: '#FFFFFF' }}>{CATEGORY_LABELS[selectedItem.category]}</ThemedText>
                    </LinearGradient>
                    <View style={[styles.modalTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(selectedItem.color) }]} />
                      <ThemedText type="caption">{selectedItem.color}</ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
                          style={styles.statIconContainer}
                        >
                          <Feather name="repeat" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <ThemedText type="h3">{selectedItem.timesWorn}</ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>Times Worn</ThemedText>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                      <View style={styles.statItem}>
                        <LinearGradient
                          colors={[LUXURY_COLORS.coral, '#C46A4F']}
                          style={styles.statIconContainer}
                        >
                          <Feather name="calendar" size={14} color="#FFFFFF" />
                        </LinearGradient>
                        <ThemedText type="h3">
                          {selectedItem.lastWorn 
                            ? new Date(selectedItem.lastWorn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : "Never"
                          }
                        </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>Last Worn</ThemedText>
                      </View>
                    </View>
                  </View>

                  {selectedItem.brand ? (
                    <View style={styles.detailRow}>
                      <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.gold + '20' }]}>
                        <Feather name="award" size={16} color={LUXURY_COLORS.gold} />
                      </View>
                      <ThemedText type="body">{selectedItem.brand}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.coral + '20' }]}>
                      <Feather name="sun" size={16} color={LUXURY_COLORS.coral} />
                    </View>
                    <ThemedText type="body">
                      {selectedItem.seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: LUXURY_COLORS.violet + '20' }]}>
                      <Feather name="calendar" size={16} color={LUXURY_COLORS.violet} />
                    </View>
                    <ThemedText type="body">
                      {selectedItem.occasions.map(o => o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ")).join(", ")}
                    </ThemedText>
                  </View>

                  {selectedItem.notes ? (
                    <View style={[styles.notesSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                      <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>Notes</ThemedText>
                      <ThemedText type="body">{selectedItem.notes}</ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.xl }]}>
                  <LinearGradient
                    colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButtonGradient}
                  >
                    <Pressable
                      onPress={() => handleMarkWorn(selectedItem)}
                      style={styles.actionButtonInner}
                    >
                      <Feather name="check-circle" size={18} color="#FFFFFF" />
                      <ThemedText type="body" style={styles.actionButtonText}>
                        Log Wear
                      </ThemedText>
                    </Pressable>
                  </LinearGradient>

                  <Pressable
                    onPress={() => handleDeleteItem(selectedItem)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Feather name="trash-2" size={18} color="#FF3B30" />
                    <ThemedText type="body" style={{ color: "#FF3B30", fontWeight: '600' }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          style={styles.loadingIconContainer}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>
          Loading your wardrobe...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <LinearGradient
        colors={[
          ScreenGradients.wardrobe.primary[0],
          ScreenGradients.wardrobe.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <ThemedText type="h2" style={{ color: '#FFFFFF' }}>My Wardrobe</ThemedText>
            <View style={[styles.itemCountBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {items.length} {items.length === 1 ? 'piece' : 'pieces'}
              </ThemedText>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={CATEGORY_OPTIONS}
          renderItem={renderCategoryTab}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
          contentContainerStyle={styles.categoryTabsContent}
        />
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderWardrobeItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.gridContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      {renderItemModal()}

      <View style={[styles.fabContainer, { bottom: insets.bottom + 100 }]}>
        <Pressable
          onPress={handleQuickAdd}
          style={[styles.fabSecondary, { backgroundColor: isDark ? LUXURY_COLORS.midnight : '#FFFFFF' }]}
        >
          <Feather name="layers" size={20} color={LUXURY_COLORS.violet} />
        </Pressable>
        <LinearGradient
          colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
          style={styles.fab}
        >
          <Pressable onPress={handleAddItem} style={styles.fabInner}>
            <Feather name="plus" size={28} color={LUXURY_COLORS.midnight} />
          </Pressable>
        </LinearGradient>
      </View>
    </View>
  );
}

function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    gray: '#808080',
    navy: '#001F3F',
    brown: '#8B4513',
    beige: '#F5F5DC',
    red: '#FF0000',
    pink: '#FFC0CB',
    orange: '#FFA500',
    yellow: '#FFFF00',
    green: '#008000',
    blue: '#0000FF',
    purple: '#800080',
    multicolor: '#FF69B4',
  };
  return colorMap[color] || '#808080';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  headerTitleContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  itemCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTabs: {
    marginBottom: Spacing.sm,
  },
  categoryTabsContent: {
    gap: Spacing.sm,
  },
  categoryTabWrapper: {},
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  gridContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  itemCard: {
    width: ITEM_SIZE,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  itemImageWrapper: {
    width: "100%",
    height: ITEM_SIZE + 20,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  itemInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  itemNameOverlay: {
    color: '#FFFFFF',
    fontWeight: "600",
    marginBottom: 2,
  },
  itemWornText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  favoriteIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["5xl"],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  emptyButtonGradient: {
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  emptyButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
  },
  emptyButtonText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: "700",
  },
  emptyButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LUXURY_COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: Spacing.xl,
  },
  modalImageWrapper: {
    width: "100%",
    height: SCREEN_WIDTH - Spacing.xl * 2,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalInfo: {
    marginTop: Spacing.xl,
  },
  modalItemName: {
    marginBottom: Spacing.md,
  },
  modalTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    height: 60,
    marginHorizontal: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing["2xl"],
  },
  actionButtonGradient: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
});
