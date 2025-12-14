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

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingCategory, CATEGORY_LABELS } from "@/contexts/WardrobeContext";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

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
  const { theme } = useTheme();
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
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCategory(item.key);
        }}
        style={[
          styles.categoryTab,
          {
            backgroundColor: isSelected ? theme.link : theme.backgroundDefault,
          },
        ]}
      >
        <Feather
          name={item.icon as any}
          size={16}
          color={isSelected ? "#FFFFFF" : theme.tabIconDefault}
        />
        <ThemedText
          type="caption"
          style={{ color: isSelected ? "#FFFFFF" : theme.text }}
        >
          {item.label}
        </ThemedText>
      </Pressable>
    );
  }, [selectedCategory, theme]);

  const renderWardrobeItem = useCallback(({ item }: { item: WardrobeItem }) => {
    return (
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.itemCard,
          {
            backgroundColor: theme.backgroundDefault,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Image
          source={{ uri: item.imageUri }}
          style={styles.itemImage}
          contentFit="cover"
          transition={200}
        />
        {item.isFavorite ? (
          <View style={[styles.favoriteIndicator, { backgroundColor: theme.link }]}>
            <Feather name="heart" size={12} color="#FFFFFF" />
          </View>
        ) : null}
        <View style={styles.itemInfo}>
          <ThemedText type="caption" numberOfLines={1} style={styles.itemName}>
            {item.name}
          </ThemedText>
          <ThemedText type="caption" style={{ opacity: 0.6 }}>
            Worn {item.timesWorn}x
          </ThemedText>
        </View>
      </Pressable>
    );
  }, [theme]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="inbox" size={48} color={theme.tabIconDefault} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        Your wardrobe is empty
      </ThemedText>
      <ThemedText type="body" style={styles.emptyText}>
        Start building your digital closet by adding photos of your clothes
      </ThemedText>
      <Pressable
        onPress={handleAddItem}
        style={[styles.emptyButton, { backgroundColor: theme.link }]}
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <ThemedText type="body" style={styles.emptyButtonText}>
          Add Your First Item
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderItemModal = () => {
    if (!selectedItem) return null;
    
    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable
              onPress={() => setShowItemModal(false)}
              style={[styles.modalCloseButton, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Item Details</ThemedText>
            <Pressable
              onPress={() => handleToggleFavorite(selectedItem)}
              style={[styles.modalCloseButton, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather
                name={selectedItem.isFavorite ? "heart" : "heart"}
                size={24}
                color={selectedItem.isFavorite ? theme.link : theme.tabIconDefault}
              />
            </Pressable>
          </View>

          <FlatList
            data={[selectedItem]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <>
                <Image
                  source={{ uri: selectedItem.imageUri }}
                  style={styles.modalImage}
                  contentFit="cover"
                  transition={300}
                />

                <View style={styles.modalInfo}>
                  <ThemedText type="h2" style={styles.modalItemName}>
                    {selectedItem.name}
                  </ThemedText>

                  <View style={styles.modalTags}>
                    <View style={[styles.modalTag, { backgroundColor: theme.backgroundDefault }]}>
                      <Feather name="tag" size={14} color={theme.tabIconDefault} />
                      <ThemedText type="caption">{CATEGORY_LABELS[selectedItem.category]}</ThemedText>
                    </View>
                    <View style={[styles.modalTag, { backgroundColor: theme.backgroundDefault }]}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(selectedItem.color) }]} />
                      <ThemedText type="caption">{selectedItem.color}</ThemedText>
                    </View>
                  </View>

                  <Card elevation={2} style={styles.statsCard}>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <ThemedText type="h3">{selectedItem.timesWorn}</ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>Times Worn</ThemedText>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <ThemedText type="h3">
                          {selectedItem.lastWorn 
                            ? new Date(selectedItem.lastWorn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : "Never"
                          }
                        </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>Last Worn</ThemedText>
                      </View>
                    </View>
                  </Card>

                  {selectedItem.brand ? (
                    <View style={styles.detailRow}>
                      <Feather name="award" size={18} color={theme.tabIconDefault} />
                      <ThemedText type="body">{selectedItem.brand}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.detailRow}>
                    <Feather name="sun" size={18} color={theme.tabIconDefault} />
                    <ThemedText type="body">
                      {selectedItem.seasons.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <Feather name="calendar" size={18} color={theme.tabIconDefault} />
                    <ThemedText type="body">
                      {selectedItem.occasions.map(o => o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ")).join(", ")}
                    </ThemedText>
                  </View>

                  {selectedItem.notes ? (
                    <View style={styles.notesSection}>
                      <ThemedText type="small" style={{ opacity: 0.6 }}>Notes</ThemedText>
                      <ThemedText type="body">{selectedItem.notes}</ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.xl }]}>
                  <Pressable
                    onPress={() => handleMarkWorn(selectedItem)}
                    style={[styles.actionButton, { backgroundColor: theme.link }]}
                  >
                    <Feather name="check-circle" size={20} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.actionButtonText}>
                      Log Wear
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteItem(selectedItem)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Feather name="trash-2" size={20} color="#FF3B30" />
                    <ThemedText type="body" style={[styles.actionButtonText, { color: "#FF3B30" }]}>
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
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>
          Loading your wardrobe...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">My Wardrobe</ThemedText>
          <View style={styles.headerStats}>
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </ThemedText>
          </View>
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
  header: {
    paddingHorizontal: Spacing.xl,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerStats: {
    width: 60,
    alignItems: "flex-end",
  },
  categoryTabs: {
    marginBottom: Spacing.lg,
  },
  categoryTabsContent: {
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
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
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: ITEM_SIZE,
    borderRadius: BorderRadius.md,
  },
  favoriteIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    padding: Spacing.sm,
  },
  itemName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["5xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.6,
    marginBottom: Spacing["2xl"],
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
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
  modalContent: {
    paddingHorizontal: Spacing.xl,
  },
  modalImage: {
    width: "100%",
    height: SCREEN_WIDTH - Spacing.xl * 2,
    borderRadius: BorderRadius.lg,
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
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    marginHorizontal: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  notesSection: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing["2xl"],
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
