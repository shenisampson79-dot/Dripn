import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';

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

type Props = {
  missing?: FallbackMissingItem[] | null;
  headline?: string;
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
 * "Get the missing piece" — curated retailer search + nearby maps deep links.
 */
export function FallbackShopSection({
  missing,
  headline = 'Get the missing piece',
}: Props) {
  const theme = useTheme();
  const items = Array.isArray(missing) ? missing.filter(Boolean) : [];
  if (!items.length) return null;

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
                    style={[styles.chip, { borderColor: LuxuryColors.gold }]}
                    accessibilityRole="link"
                  >
                    <Feather name="shopping-bag" size={12} color={LuxuryColors.gold} />
                    <ThemedText type="small" style={{ color: LuxuryColors.gold }}>
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
                      style={[styles.chip, { borderColor: theme.border }]}
                    >
                      <Feather name="map-pin" size={12} color={theme.text} />
                      <ThemedText type="small">{b.brand} near you</ThemedText>
                    </Pressable>
                  );
                })}
                {nearbyBrands.length === 0 && generalNearby ? (
                  <Pressable
                    onPress={() => openUrl(generalNearby)}
                    style={[styles.chip, { borderColor: theme.border }]}
                  >
                    <Feather name="map-pin" size={12} color={theme.text} />
                    <ThemedText type="small">Stores near you</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
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
