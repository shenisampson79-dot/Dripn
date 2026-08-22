import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';
import { filterSuggestionStringsForUi } from '@/utils/shopDressCodeFilters';

export type FallbackMissingItem = {
  role?: string;
  label?: string;
  name?: string;
  reason?: string;
  color?: string;
  formality?: string;
  products?: Array<{
    retailerId?: string;
    retailer?: string;
    url?: string;
    searchUrl?: string;
  }>;
  retail?: {
    query?: string;
    online?: Array<{
      retailerId?: string;
      retailer?: string;
      url?: string;
      searchUrl?: string;
    }>;
    nearby?: { appleMaps?: string; googleMaps?: string; query?: string };
    nearbyByBrand?: Array<{
      brand?: string;
      appleMaps?: string;
      googleMaps?: string;
    }>;
    country?: string;
    retailRegion?: string;
    market?: string;
  };
};

export type NearbyStore = {
  name?: string;
  url?: string;
  website?: string;
  place_id?: string | null;
  source?: string;
  address?: string | null;
};

type Props = {
  missing?: FallbackMissingItem[] | null;
  headline?: string;
  gender?: string | null;
  dressCode?: string | null;
  nearbyStores?: NearbyStore[] | null;
};

async function openUrl(url?: string | null) {
  if (!url) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(url);
  } catch {
    // ignore — shop links are best-effort
  }
}

/** Prefer the platform maps app; one nearby chip, not Google + Apple together. */
function preferredMapsUrl(links?: { appleMaps?: string; googleMaps?: string } | null): string | null {
  if (!links) return null;
  if (Platform.OS === 'ios') return links.appleMaps || links.googleMaps || null;
  return links.googleMaps || links.appleMaps || null;
}

/**
 * Role suggestions to recreate a look — curated retailer search + nearby maps.
 */
export function FallbackShopSection({
  missing,
  headline = 'Pieces to match this style',
  gender = null,
  dressCode = 'formal',
  nearbyStores = null,
}: Props) {
  const { theme, isDark } = useTheme();
  const rawItems = Array.isArray(missing) ? missing.filter(Boolean) : [];
  const labels = filterSuggestionStringsForUi(
    rawItems.map((i) => i.label || i.name || i.role || 'Upgrade'),
    { gender, dressCode },
  );
  const labelSet = new Set(labels.map((l) => l.toLowerCase()));
  const items = rawItems.filter((i) => {
    const title = (i.label || i.name || i.role || '').toLowerCase();
    if (!title) return true;
    return labelSet.has(title);
  });
  const stores = Array.isArray(nearbyStores) ? nearbyStores.filter((s) => s?.name && (s.url || s.website)) : [];
  if (!items.length && !stores.length) return null;

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText type="h3" style={styles.headline}>
        {headline}
      </ThemedText>
      {items.map((item, index) => {
        const title = sanitizeStylistUserText(item.label || item.name || item.role || 'Upgrade');
        const products = item.products || item.retail?.online || [];
        const nearby = item.retail?.nearby;
        const nearbyBrands = item.retail?.nearbyByBrand || [];
        const generalNearby = preferredMapsUrl(nearby);
        // Night mode: never black-on-dark — light chip fill + high-contrast label/icon.
        const chipFg = isDark ? '#F5F0E8' : LuxuryColors.gold;
        const chipBg = isDark ? 'rgba(255,255,255,0.12)' : 'transparent';
        const chipBorder = isDark ? 'rgba(245,240,232,0.45)' : LuxuryColors.gold;
        const mapFg = isDark ? '#F5F0E8' : theme.text;
        const mapBorder = isDark ? 'rgba(245,240,232,0.35)' : theme.border;
        const mapBg = isDark ? 'rgba(255,255,255,0.1)' : 'transparent';
        return (
          <View key={`${title}-${index}`} style={styles.itemBlock}>
            <ThemedText type="body" style={styles.itemTitle}>
              {title}
            </ThemedText>
            {item.reason ? (
              <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                {sanitizeStylistUserText(item.reason)}
              </ThemedText>
            ) : null}

            {products.length > 0 ? (
              <View style={styles.linkRow}>
                {products.slice(0, 5).map((p) => (
                  <Pressable
                    key={`${p.retailerId || p.retailer}-${p.url}`}
                    onPress={() => openUrl(p.url || p.searchUrl)}
                    style={[styles.chip, { borderColor: chipBorder, backgroundColor: chipBg }]}
                    accessibilityRole="link"
                  >
                    <Feather name="shopping-bag" size={12} color={chipFg} />
                    <ThemedText type="small" style={{ color: chipFg }}>
                      {p.retailer || 'Shop'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {(generalNearby || nearbyBrands.length > 0) ? (
              <View style={[styles.linkRow, { marginTop: Spacing.xs }]}>
                {nearbyBrands.slice(0, 3).map((b) => {
                  const url = preferredMapsUrl(b);
                  if (!url) return null;
                  return (
                    <Pressable
                      key={b.brand}
                      onPress={() => openUrl(url)}
                      style={[styles.chip, { borderColor: mapBorder, backgroundColor: mapBg }]}
                    >
                      <Feather name="map-pin" size={12} color={mapFg} />
                      <ThemedText type="small" style={{ color: mapFg }}>{b.brand} near you</ThemedText>
                    </Pressable>
                  );
                })}
                {nearbyBrands.length === 0 && generalNearby ? (
                  <Pressable
                    onPress={() => openUrl(generalNearby)}
                    style={[styles.chip, { borderColor: mapBorder, backgroundColor: mapBg }]}
                  >
                    <Feather name="map-pin" size={12} color={mapFg} />
                    <ThemedText type="small" style={{ color: mapFg }}>Stores near you</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {stores.length > 0 ? (
        <View style={{ marginTop: items.length ? Spacing.sm : 0 }}>
          {items.length > 0 ? (
            <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
              Nearby & curated
            </ThemedText>
          ) : null}
          <View style={styles.linkRow}>
            {stores.slice(0, 4).map((s) => {
              const chipFg = isDark ? '#F5F0E8' : LuxuryColors.gold;
              const chipBg = isDark ? 'rgba(255,255,255,0.12)' : 'transparent';
              const chipBorder = isDark ? 'rgba(245,240,232,0.45)' : LuxuryColors.gold;
              return (
              <Pressable
                key={`${s.name}-${s.url || s.website}`}
                onPress={() => openUrl(s.url || s.website)}
                style={[styles.chip, { borderColor: chipBorder, backgroundColor: chipBg }]}
                accessibilityRole="link"
              >
                <Feather name="shopping-bag" size={12} color={chipFg} />
                <ThemedText type="small" style={{ color: chipFg }}>
                  {s.name}
                </ThemedText>
              </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headline: {
    marginBottom: Spacing.md,
  },
  itemBlock: {
    marginBottom: Spacing.md,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
});
