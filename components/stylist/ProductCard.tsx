import React from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';

export type RetailProduct = {
  id?: string;
  title?: string;
  brand?: string;
  price?: number;
  currency?: string;
  priceFormatted?: string;
  image?: string;
  url?: string | null;
  searchUrl?: string | null;
  retailerId?: string;
  retailer?: string;
  category?: string;
  score?: number;
};

type Props = {
  product: RetailProduct;
  roleLabel?: string;
};

async function openUrl(url?: string | null) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // best-effort
  }
}

export function ProductCard({ product, roleLabel }: Props) {
  const theme = useTheme();
  const title = sanitizeStylistUserText(product.title || product.brand || 'Piece');
  const price = product.priceFormatted
    || (typeof product.price === 'number'
      ? `${product.currency === 'EUR' ? '€' : product.currency === 'USD' ? '$' : '£'}${product.price}`
      : null);
  const buyUrl = product.url || product.searchUrl;

  return (
    <Pressable
      onPress={() => openUrl(buyUrl)}
      style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
      accessibilityRole="link"
      accessibilityLabel={`Buy ${title}`}
    >
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imageFallback, { backgroundColor: theme.border }]}>
          <Feather name="shopping-bag" size={22} color={LuxuryColors.gold} />
        </View>
      )}
      <View style={styles.meta}>
        {roleLabel ? (
          <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: 2 }}>
            {roleLabel}
          </ThemedText>
        ) : null}
        <ThemedText type="body" numberOfLines={2} style={styles.title}>
          {title}
        </ThemedText>
        {product.brand ? (
          <ThemedText type="small" style={{ color: theme.tabIconDefault }} numberOfLines={1}>
            {sanitizeStylistUserText(product.brand)}
            {product.retailer ? ` · ${product.retailer}` : ''}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          {price ? (
            <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
              {price}
            </ThemedText>
          ) : null}
          <View style={styles.buyChip}>
            <Feather name="external-link" size={12} color={LuxuryColors.gold} />
            <ThemedText type="small" style={{ color: LuxuryColors.gold }}>
              Buy
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  image: {
    width: 88,
    height: 110,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  buyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
