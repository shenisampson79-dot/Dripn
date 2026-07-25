import React, { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ProductCard, type RetailProduct } from '@/components/stylist/ProductCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiService } from '@/services/ApiService';
import { formatOutfitPieceRoleLabel } from '@/utils/sanitizeStylistUserText';
import { filterShopItemsForUi } from '@/utils/shopDressCodeFilters';
import { resolveShopThumb } from '@/utils/shopThumbAssets';

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
  /** Optional disclosure under product cards (e.g. no commission). */
  footerNote?: ReactNode;
};

/**
 * SHOP_REQUIRED retail look: optional AI hero + ranked product cards.
 * Never reserves a blank 280px slot — hide hero until a real image loads.
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
  footerNote,
}: Props) {
  const theme = useTheme();
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [confirmedPreviewUrl, setConfirmedPreviewUrl] = useState<string | null>(
    retailOutfit?.previewImageUrl || null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [liveProducts, setLiveProducts] = useState<RetailProduct[]>(
    retailOutfit?.products || Object.values(retailOutfit?.outfit || {}),
  );

  useEffect(() => {
    setLiveProducts(retailOutfit?.products || Object.values(retailOutfit?.outfit || {}));
    if (retailOutfit?.previewImageUrl) {
      setPendingPreviewUrl(retailOutfit.previewImageUrl);
      setConfirmedPreviewUrl(null);
    }
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

        if (!requestPreview || confirmedPreviewUrl || pendingPreviewUrl) return;
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
        if (!cancelled && preview?.imageUrl) setPendingPreviewUrl(preview.imageUrl);
      } catch {
        // keep editorial / collage fallback
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    confirmedPreviewUrl,
    dressCode,
    gender,
    pendingPreviewUrl,
    recommendedOutfit,
    requestPreview,
    retailOutfit,
  ]);

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

  const collageUris = useMemo(
    () => safeCards
      .map(({ product }) => {
        const local = resolveShopThumb(product);
        if (typeof local === 'number') return null;
        return product.image || null;
      })
      .filter(Boolean)
      .slice(0, 4) as string[],
    [safeCards],
  );

  const showPreview = Boolean(confirmedPreviewUrl);
  const showFallback = !showPreview && Boolean(fallbackHeroSource) && !fallbackFailed;
  const showCollage = !showPreview && !showFallback && collageUris.length >= 2;
  const showHero = showPreview || showFallback || showCollage || (previewLoading && showFallback);

  if (!safeCards.length && !showHero && !previewLoading) return null;

  return (
    <View style={styles.wrap}>
      {showHero || (previewLoading && fallbackHeroSource && !fallbackFailed) ? (
        <View style={styles.heroWrap}>
          {showPreview ? (
            <Image
              source={{ uri: confirmedPreviewUrl as string }}
              style={styles.hero}
              resizeMode="cover"
              onError={() => {
                setConfirmedPreviewUrl(null);
                setPendingPreviewUrl(null);
              }}
            />
          ) : showFallback ? (
            <Image
              source={fallbackHeroSource}
              style={styles.hero}
              resizeMode="cover"
              onError={() => setFallbackFailed(true)}
            />
          ) : showCollage ? (
            <View style={[styles.hero, styles.collage]}>
              {collageUris.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.collageCell} resizeMode="cover" />
              ))}
            </View>
          ) : null}

          {/* Confirm remote preview off-screen before swapping — avoids blank white hero */}
          {pendingPreviewUrl && !confirmedPreviewUrl ? (
            <Image
              source={{ uri: pendingPreviewUrl }}
              style={styles.preload}
              onLoad={() => {
                setConfirmedPreviewUrl(pendingPreviewUrl);
                setPendingPreviewUrl(null);
              }}
              onError={() => setPendingPreviewUrl(null)}
            />
          ) : null}

          {previewLoading && (showFallback || showCollage || showPreview) ? (
            <View style={styles.heroOverlay}>
              <ActivityIndicator color="#fff" />
              <ThemedText type="small" style={{ color: '#fff', marginTop: Spacing.xs }}>
                Generating look…
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : previewLoading ? (
        <View style={[styles.loadingRow, { backgroundColor: theme.backgroundSecondary }]}>
          <ActivityIndicator color={theme.tabIconDefault} />
          <ThemedText type="small" style={{ color: theme.tabIconDefault, marginLeft: Spacing.sm }}>
            Building look preview…
          </ThemedText>
        </View>
      ) : null}

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

      {footerNote}
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
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collageCell: {
    width: '50%',
    height: 140,
  },
  preload: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
});
