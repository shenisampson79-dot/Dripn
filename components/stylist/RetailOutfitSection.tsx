import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ProductCard, type RetailProduct } from '@/components/stylist/ProductCard';
import { Spacing } from '@/constants/theme';
import { apiService } from '@/services/ApiService';
import { formatOutfitPieceRoleLabel } from '@/utils/sanitizeStylistUserText';
import { filterShopItemsForUi } from '@/utils/shopDressCodeFilters';
import { resolveShopThumb } from '@/utils/shopThumbAssets';

/** Cap AI look-preview wait — never sit on a generating spinner for a minute. */
const PREVIEW_TIMEOUT_MS = 10_000;

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
  /** When true, try AI full-look preview once in the background. */
  requestPreview?: boolean;
  fallbackHeroSource?: number;
  headline?: string;
  /** Label under editorial hero — clarifies photo ≠ product SKUs. */
  heroCaption?: string | null;
  /** Optional copy block rendered between hero and product cards */
  lead?: ReactNode;
  /** Optional disclosure under product cards (e.g. no commission). */
  footerNote?: ReactNode;
};

/**
 * SHOP_REQUIRED retail look: stable editorial/collage hero first.
 * Product cards are role suggestions to recreate the look — matched by style/fit,
 * not claims of exact SKUs in the hero.
 */
export function RetailOutfitSection({
  retailOutfit,
  recommendedOutfit,
  dressCode,
  gender,
  requestPreview = true,
  fallbackHeroSource,
  headline = 'Pieces to match this style',
  heroCaption = null,
  lead,
  footerNote,
}: Props) {
  const [confirmedPreviewUrl, setConfirmedPreviewUrl] = useState<string | null>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [liveProducts, setLiveProducts] = useState<RetailProduct[]>(
    retailOutfit?.products || Object.values(retailOutfit?.outfit || {}),
  );

  /** One-shot guards — refs so effect deps don't re-fire generation. */
  const previewAttemptedRef = useRef(false);
  const previewFetchIdRef = useRef(0);
  const lastOutfitKeyRef = useRef<string>('');
  const preloadUrlRef = useRef<string | null>(null);
  const [preloadUrl, setPreloadUrl] = useState<string | null>(null);

  const outfitKey = useMemo(() => {
    const products = retailOutfit?.products || Object.values(retailOutfit?.outfit || {});
    const ids = products.map((p) => p?.id || p?.title || '').join('|');
    return [
      retailOutfit?.dressCodeKey || dressCode || '',
      gender || '',
      ids,
      retailOutfit?.previewImageUrl || '',
    ].join('::');
  }, [retailOutfit, dressCode, gender]);

  useEffect(() => {
    setLiveProducts(retailOutfit?.products || Object.values(retailOutfit?.outfit || {}));
  }, [retailOutfit]);

  // Reset one-shot only when the shop look identity actually changes
  useEffect(() => {
    if (outfitKey === lastOutfitKeyRef.current) return;
    lastOutfitKeyRef.current = outfitKey;
    previewAttemptedRef.current = false;
    previewFetchIdRef.current += 1;
    preloadUrlRef.current = null;
    setPreloadUrl(null);
    setConfirmedPreviewUrl(null);
    setFallbackFailed(false);

    const seeded = retailOutfit?.previewImageUrl;
    if (seeded && /^https?:\/\//i.test(seeded)) {
      previewAttemptedRef.current = true;
      preloadUrlRef.current = seeded;
      setPreloadUrl(seeded);
    }
  }, [outfitKey, retailOutfit?.previewImageUrl]);

  // Optional AI preview: once, background, hard timeout. Never blocks stable hero.
  useEffect(() => {
    if (!requestPreview) return undefined;
    if (previewAttemptedRef.current) return undefined;
    if (confirmedPreviewUrl) return undefined;

    const products = retailOutfit?.products || Object.values(retailOutfit?.outfit || {});
    previewAttemptedRef.current = true;
    const fetchId = ++previewFetchIdRef.current;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        if (products.length === 0) {
          const res = await apiService.getShopOutfit({
            dressCode: dressCode || retailOutfit?.dressCodeKey || undefined,
            recommendedOutfit: recommendedOutfit || undefined,
            gender: gender || undefined,
            generatePreview: false,
          });
          if (cancelled || fetchId !== previewFetchIdRef.current) return;
          if (res?.success) {
            const next = res.products || Object.values(res.outfit || {});
            setLiveProducts(next);
          }
        }

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

        const previewPromise = apiService.getOutfitPreview({
          ...rec,
          dressCode: dressCode || retailOutfit?.dressCodeKey || undefined,
          gender: gender || undefined,
        });

        const timed = await Promise.race([
          previewPromise.then((r) => ({ kind: 'ok' as const, r })),
          new Promise<{ kind: 'timeout' }>((resolve) => {
            timeoutId = setTimeout(() => resolve({ kind: 'timeout' }), PREVIEW_TIMEOUT_MS);
          }),
        ]);

        if (cancelled || fetchId !== previewFetchIdRef.current) return;
        if (timed.kind === 'timeout') return;

        const imageUrl = timed.r?.imageUrl;
        if (
          imageUrl
          && /^https?:\/\//i.test(imageUrl)
          && imageUrl !== confirmedPreviewUrl
          && imageUrl !== preloadUrlRef.current
        ) {
          preloadUrlRef.current = imageUrl;
          setPreloadUrl(imageUrl);
        }
      } catch {
        // Keep editorial / collage silently
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // Intentionally omit confirmedPreviewUrl / preloadUrl — one-shot via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outfitKey gates identity
  }, [outfitKey, requestPreview, dressCode, gender, recommendedOutfit, retailOutfit]);

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

  const collageSources = useMemo(() => {
    const out: Array<{ key: string; source: number | { uri: string } }> = [];
    for (const { role, product } of safeCards) {
      if (out.length >= 4) break;
      const local = resolveShopThumb(product, gender);
      if (typeof local === 'number') {
        out.push({ key: `local-${product.id || role}`, source: local });
      } else if (local && typeof local === 'object' && 'uri' in local && local.uri) {
        out.push({ key: `uri-${product.id || role}`, source: local });
      } else if (product.image && /^https?:\/\//i.test(product.image)) {
        out.push({ key: `img-${product.id || role}`, source: { uri: product.image } });
      }
    }
    return out;
  }, [safeCards, gender]);

  const showPreview = Boolean(confirmedPreviewUrl);
  const showFallback = !showPreview && Boolean(fallbackHeroSource) && !fallbackFailed;
  const showCollage = !showPreview && !showFallback && collageSources.length >= 2;
  const showHero = showPreview || showFallback || showCollage;

  if (!safeCards.length && !showHero) return null;

  return (
    <View style={styles.wrap}>
      {showHero ? (
        <View style={styles.heroWrap}>
          {showPreview ? (
            <Image
              key="hero-ai"
              source={{ uri: confirmedPreviewUrl as string }}
              style={styles.hero}
              resizeMode="cover"
              onError={() => {
                // Fall back silently — do NOT clear in a way that re-triggers generation
                setConfirmedPreviewUrl(null);
                preloadUrlRef.current = null;
                setPreloadUrl(null);
              }}
            />
          ) : showFallback ? (
            <Image
              key="hero-editorial"
              source={fallbackHeroSource}
              style={styles.hero}
              resizeMode="cover"
              onError={() => setFallbackFailed(true)}
            />
          ) : (
            <View key="hero-collage" style={[styles.hero, styles.collage]}>
              {collageSources.map((cell) => (
                <Image
                  key={cell.key}
                  source={cell.source}
                  style={styles.collageCell}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          {/* Off-screen preload — swap only after confirmed decode */}
          {preloadUrl && preloadUrl !== confirmedPreviewUrl ? (
            <Image
              key={`preload-${preloadUrl}`}
              source={{ uri: preloadUrl }}
              style={styles.preload}
              onLoad={() => {
                if (preloadUrlRef.current !== preloadUrl) return;
                if (preloadUrl === confirmedPreviewUrl) return;
                setConfirmedPreviewUrl(preloadUrl);
                setPreloadUrl(null);
              }}
              onError={() => {
                if (preloadUrlRef.current === preloadUrl) {
                  preloadUrlRef.current = null;
                }
                setPreloadUrl(null);
              }}
            />
          ) : null}
        </View>
      ) : null}

      {heroCaption && showHero ? (
        <ThemedText type="small" style={styles.heroCaption}>
          {heroCaption}
        </ThemedText>
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
          gender={gender}
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
    marginBottom: Spacing.xs,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCaption: {
    marginBottom: Spacing.md,
    opacity: 0.75,
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
});
