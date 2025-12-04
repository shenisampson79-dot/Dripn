import React from "react";
import { StyleSheet, View, Pressable, Linking, Alert } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export interface ShoppableProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  category: string;
  sizes?: string[];
  colors?: string[];
  rating?: number;
  reviewCount?: number;
}

interface ShoppableCardProps {
  product: ShoppableProduct;
  compact?: boolean;
  onPress?: (product: ShoppableProduct) => void;
}

export function ShoppableCard({ product, compact = false, onPress }: ShoppableCardProps) {
  const { theme } = useTheme();

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  };

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  const handlePress = async () => {
    if (onPress) {
      onPress(product);
    }
    
    try {
      const supported = await Linking.canOpenURL(product.affiliateUrl);
      if (supported) {
        await Linking.openURL(product.affiliateUrl);
      } else {
        Alert.alert("Cannot open link", "Unable to open this product link.");
      }
    } catch (error) {
      console.error("Error opening affiliate link:", error);
      Alert.alert("Error", "Failed to open product page.");
    }
  };

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Image source={{ uri: product.imageUrl }} style={styles.compactImage} />
        <View style={styles.compactContent}>
          <ThemedText type="small" style={styles.brandText} numberOfLines={1}>
            {product.brand}
          </ThemedText>
          <ThemedText type="body" numberOfLines={1}>
            {product.name}
          </ThemedText>
          <View style={styles.priceRow}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>
              {formatPrice(product.price, product.currency)}
            </ThemedText>
            {hasDiscount ? (
              <ThemedText type="small" style={styles.originalPrice}>
                {formatPrice(product.originalPrice!, product.currency)}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Feather name="external-link" size={16} color={theme.link} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: product.imageUrl }} style={styles.image} />
        {hasDiscount ? (
          <View style={[styles.discountBadge, { backgroundColor: theme.error || "#FF3B30" }]}>
            <ThemedText type="small" style={styles.discountText}>
              -{discountPercent}%
            </ThemedText>
          </View>
        ) : null}
      </View>
      
      <View style={styles.content}>
        <ThemedText type="small" style={styles.brandText} numberOfLines={1}>
          {product.brand}
        </ThemedText>
        <ThemedText type="body" style={styles.productName} numberOfLines={2}>
          {product.name}
        </ThemedText>
        
        {product.rating ? (
          <View style={styles.ratingRow}>
            <Feather name="star" size={14} color="#FFD700" />
            <ThemedText type="small" style={styles.ratingText}>
              {product.rating.toFixed(1)}
            </ThemedText>
            {product.reviewCount ? (
              <ThemedText type="small" style={styles.reviewCount}>
                ({product.reviewCount})
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        
        <View style={styles.priceContainer}>
          <ThemedText type="h3" style={{ color: theme.text }}>
            {formatPrice(product.price, product.currency)}
          </ThemedText>
          {hasDiscount ? (
            <ThemedText type="body" style={styles.originalPrice}>
              {formatPrice(product.originalPrice!, product.currency)}
            </ThemedText>
          ) : null}
        </View>

        {product.sizes ? (
          <View style={styles.sizesRow}>
            <ThemedText type="small" style={styles.sizesLabel}>
              Sizes:
            </ThemedText>
            <ThemedText type="small" style={styles.sizesText}>
              {product.sizes.join(", ")}
            </ThemedText>
          </View>
        ) : null}

        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.shopButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="shopping-bag" size={16} color="#FFFFFF" />
          <ThemedText type="body" style={styles.shopButtonText}>
            Shop Now
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

interface ShoppableGridProps {
  products: ShoppableProduct[];
  title?: string;
  onProductPress?: (product: ShoppableProduct) => void;
}

export function ShoppableGrid({ products, title, onProductPress }: ShoppableGridProps) {
  const { theme } = useTheme();

  if (products.length === 0) return null;

  return (
    <View style={styles.gridContainer}>
      {title ? (
        <View style={styles.gridHeader}>
          <Feather name="shopping-bag" size={18} color={theme.link} />
          <ThemedText type="h3">{title}</ThemedText>
        </View>
      ) : null}
      <View style={styles.grid}>
        {products.map((product) => (
          <View key={product.id} style={styles.gridItem}>
            <ShoppableCard product={product} onPress={onProductPress} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 200,
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  discountText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  brandText: {
    opacity: 0.6,
    textTransform: "uppercase",
    fontWeight: "500",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  productName: {
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
  },
  ratingText: {
    fontWeight: "600",
  },
  reviewCount: {
    opacity: 0.6,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  originalPrice: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  sizesRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sizesLabel: {
    opacity: 0.6,
  },
  sizesText: {
    flex: 1,
  },
  shopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  compactImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
  },
  compactContent: {
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  gridContainer: {
    marginTop: Spacing.lg,
  },
  gridHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  gridItem: {
    width: "50%",
    padding: Spacing.xs,
  },
});
