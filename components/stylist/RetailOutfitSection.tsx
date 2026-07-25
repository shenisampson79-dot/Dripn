import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ProductCard, type RetailProduct } from '@/components/stylist/ProductCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiService } from '@/services/ApiService';
import { formatOutfitPieceRoleLabel } from '@/utils/sanitizeStylistUserText';
import { filterShopItemsForUi } from '@/utils/shopDressCodeFilters';

type RetailOutfitPayload = {
  outfit?: Record<string, RetailProduct>;
  products?: RetailProduct[];
  previewImageUrl?: string | null;
  dressCodeKey?: string;
  dressCodeLabel?: string;
};

type Props = {
  retailOutfit?: RetailOutfitPayload | null;
  recommendedOutfit?: Record<string, string> | null;
  dressCode?: string | null;
  gender?: string | null;
  /** When true, request AI full-look preview (cost-metered server-side). */
  requestPreview?: boolean;
  fallbackHeroSource?: number;
  headline?: string;
  /** Optional copy block rendered between hero and product cards */
  lead?: ReactNode;
};

/**
 * SHOP_REQUIRED retail look: optional AI hero + ranked product cards.
 */
export function RetailOutfitSection({
  retailOutfit,
  recommendedOutfit,
  dressCode,
  gender,
  requestPreview = true,
  fallbackHeroSource,
  headline = 'Shop this look',
  lead,
}: Props) {
  const theme = useTheme();
  const [previewUrl, setPreviewUrl] = useState<string | null>(retailOutfit?.previewImageUrl || null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [liveProducts, setLiveProducts] = useState<RetailProduct[]>(
    retailOutfit?.products || Object.values(retailOutfit?.outfit || {}),
  );

  useEffect(() => {
    setLiveProducts(retailOutfit?.products || Object.values(retailOutfit?.outfit || {}));
    if (retailOutfit?.previewImageUrl) setPreviewUrl(retailOutfit.previewImageUrl);
  }, [retailOutfit]);

  useEffect(() => {
    let cancelled = false;
    const products = retailOutfit?.products || Object.values(retailOutfit?.outfit || {});
    if (products.length > 0 && !requestPreview) return undefined;

    (async () => {
      try {
        if (products.length === 0) {
          const res = await apiService.getShopOutfit({
            dressCode: dressCode || retailOutfit?.dressCodeKey || undefined,
            recommendedOutfit: recommendedOutfit || undefined,
            gender: gender || undefined,
            generatePreview: false,
          });
          if (cancelled || !res?.success) return;
          const next = res.products || Object.values(res.outfit || {});
          setLiveProducts(next);
        }

        if (!requestPreview || previewUrl) return;
        setPreviewLoading(true);
        const rec = recommendedOutfit || retailOutfit?.outfit
          ? {
            top: recommendedOutfit?.top
              || (typeof retailOutfit?.outfit?.top === 'object' ? retailOutfit?.outfit?.top?.title : undefined),
            bottom: recommendedOutfit?.bottom
              || (typeof retailOutfit?.outfit?.bottom === 'object' ? retailOutfit?.outfit?.bottom?.title : undefined),
            shoes: recommendedOutfit?.shoes
              || (typeof retailOutfit?.outfit?.shoes === 'object' ? retailOutfit?.outfit?.shoes?.title : undefined),
            outerwear: recommendedOutfit?.outerwear
              || (typeof retailOutfit?.outfit?.outerwear === 'object'
                ? retailOutfit?.outfit?.outerwear?.title
                : undefined),
          }
          : undefined;
        const preview = await apiService.getOutfitPreview({
          ...rec,
          dressCode: dressCode || retailOutfit?.dressCodeKey || undefined,
          gender: gender || undefined,
        });
        if (!cancelled && preview?.imageUrl) setPreviewUrl(preview.imageUrl);
      } catch {
        // keep editorial fallback
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dressCode, gender, previewUrl, recommendedOutfit, requestPreview, retailOutfit]);

  const roleOrder = ['top', 'bottom', 'shoes', 'outerwear', 'accessory'];
  const cards: Array<{ role: string; product: RetailProduct }> = [];
  if (retailOutfit?.outfit) {
    for (const role of roleOrder) {
      const p = retailOutfit.outfit[role];
      if (p) cards.push({ role, product: p });
    }
  }
  if (!cards.length && liveProducts.length) {
    liveProducts.forEach((p, i) => cards.push({ role: p.category || `piece-${i}`, product: p }));
  }

  const safeCards = cards.filter(({ product }) =>
    filterShopItemsForUi([product], { gender, dressCode: dressCode || retailOutfit?.dressCodeKey }).length > 0,
  );

  if (!safeCards.length && !previewUrl && !previewLoading) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.heroWrap}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.hero} resizeMode="cover" />
        ) : fallbackHeroSource ? (
          <Image source={fallbackHeroSource} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, { backgroundColor: theme.backgroundSecondary }]} />
        )}
        {previewLoading ? (
          <View style={styles.heroOverlay}>
            <ActivityIndicator color="#fff" />
            <ThemedText type="small" style={{ color: '#fff', marginTop: Spacing.xs }}>
              Generating look…
            </ThemedText>
          </View>
        ) : null}
      </View>

      {lead}

      <ThemedText type="h3" style={styles.headline}>
        {headline}
      </ThemedText>

      {safeCards.map(({ role, product }) => (
        <ProductCard
          key={product.id || `${role}-${product.title}`}
          product={product}
          roleLabel={formatOutfitPieceRoleLabel(role)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 0,
  },
  headline: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  heroWrap: {
    marginBottom: Spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  hero: {
    width: '100%',
    height: 280,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
