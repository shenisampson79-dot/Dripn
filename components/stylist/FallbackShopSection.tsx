import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

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
    nearby?: { appleMaps?: string; googleMaps?: string; query?: string };
    nearbyByBrand?: Array<{
      brand?: string;
      appleMaps?: string;
      googleMaps?: string;
    }>;
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
        const title = item.label || item.name || item.role || 'Upgrade';
        const products = item.products || item.retail?.online || [];
        const nearby = item.retail?.nearby;
        const nearbyBrands = item.retail?.nearbyByBrand || [];
        return (
          <View key={`${title}-${index}`} style={styles.itemBlock}>
            <ThemedText type="body" style={styles.itemTitle}>
              {title}
            </ThemedText>
            {item.reason ? (
              <ThemedText type="small" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
                {item.reason}
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

            {(nearby?.googleMaps || nearby?.appleMaps || nearbyBrands.length > 0) ? (
              <View style={[styles.linkRow, { marginTop: Spacing.xs }]}>
                {nearby?.googleMaps ? (
                  <Pressable
                    onPress={() => openUrl(nearby.googleMaps)}
                    style={[styles.chip, { borderColor: theme.border }]}
                  >
                    <Feather name="map-pin" size={12} color={theme.text} />
                    <ThemedText type="small">Nearby (Google)</ThemedText>
                  </Pressable>
                ) : null}
                {nearby?.appleMaps ? (
                  <Pressable
                    onPress={() => openUrl(nearby.appleMaps)}
                    style={[styles.chip, { borderColor: theme.border }]}
                  >
                    <Feather name="map" size={12} color={theme.text} />
                    <ThemedText type="small">Nearby (Apple)</ThemedText>
                  </Pressable>
                ) : null}
                {nearbyBrands.slice(0, 2).map((b) => (
                  <Pressable
                    key={b.brand}
                    onPress={() => openUrl(b.googleMaps || b.appleMaps)}
                    style={[styles.chip, { borderColor: theme.border }]}
                  >
                    <Feather name="map-pin" size={12} color={theme.text} />
                    <ThemedText type="small">{b.brand} near you</ThemedText>
                  </Pressable>
                ))}
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
