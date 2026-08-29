import React, { useState } from 'react';
import { Image, ImageSourcePropType, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ensureShopImage } from '@/utils/ensureShopImage';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';

export type RetailProduct = {
  id?: string;
  title?: string;
  brand?: string;
  price?: number | null;
  currency?: string | null;
  priceFormatted?: string | null;
  priceLabel?: string | null;
  isSearchLink?: boolean;
  image?: string;
  imageKey?: string | null;
  garmentType?: string | null;
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
  gender?: string | null;
};

async function openUrl(url?: string | null) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // best-effort
  }
}

/**
 * Search/category Buy links are not SKUs — never show a fabricated shelf price.
 */
function resolvePriceDisplay(product: RetailProduct): string | null {
  if (product.isSearchLink) return null;
  if (product.priceLabel) return product.priceLabel;
  if (product.priceFormatted) return product.priceFormatted;
  if (typeof product.price === 'number' && Number.isFinite(product.price)) {
    const sym = product.currency === 'EUR' ? '€' : product.currency === 'USD' ? '$' : '£';
    return `${sym}${product.price}`;
  }
  return null;
}

export function ProductCard({ product, roleLabel, gender = null }: Props) {
  const theme = useTheme();
  const title = sanitizeStylistUserText(product.title || product.brand || 'Piece');
  const price = resolvePriceDisplay(product);
  const buyUrl = product.url || product.searchUrl;
  const thumb = ensureShopImage(product, gender);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(thumb) && !imageFailed;

  return (
    <Pressable
      onPress={() => openUrl(buyUrl)}
      style={[styles.card, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
      accessibilityRole="link"
      accessibilityLabel={`Buy ${title}`}
    >
      {showImage ? (
        <Image
          source={thumb as ImageSourcePropType}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
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
        {product.isSearchLink !== true && product.brand ? (
          <ThemedText type="small" style={{ color: theme.tabIconDefault }} numberOfLines={1}>
            {sanitizeStylistUserText(product.brand)}
            {product.retailer ? ` · ${product.retailer}` : ''}
          </ThemedText>
        ) : product.retailer ? (
          <ThemedText type="small" style={{ color: theme.tabIconDefault }} numberOfLines={1}>
            {sanitizeStylistUserText(product.retailer)}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          {price ? (
            <View>
              <ThemedText type="body" style={{ color: LuxuryColors.gold, fontWeight: '600' }}>
                {price}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.tabIconDefault, marginTop: 2 }}>
                Prices may vary at retailer
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              See price in store
            </ThemedText>
          )}
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
