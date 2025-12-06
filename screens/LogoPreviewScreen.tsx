import React from "react";
import { StyleSheet, View, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

const logoIconWhite = require("../assets/images/dripn-logo-icon.png");
const logoIconGold = require("../assets/images/dripn-logo-gold.png");
const logoIconGoldCream = require("../assets/images/dripn-logo-gold-exact-cream.png");

export default function LogoPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="h2" style={styles.header}>Dripn Logo Variations</ThemedText>
        <ThemedText type="small" style={styles.subheader}>Gold Hanger on Cream - Seamless</ThemedText>
        
        {/* MAIN CHOICE: Gold Icon on Cream + Black Text on Cream */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>YOUR CHOICE: Seamless Cream</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#FFF9F0' }]}>
            <Image source={logoIconGoldCream} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#000000' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#C9A87C' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Horizontal Layout on Cream */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Horizontal Layout</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#FFF9F0' }]}>
            <Image source={logoIconGoldCream} style={styles.iconMedium} resizeMode="contain" />
            <ThemedText style={[styles.logoTextHorizontal, { color: '#000000' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* App Header Style */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>App Header Style (Compact)</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#FFF9F0' }]}>
            <Image source={logoIconGoldCream} style={styles.iconSmall} resizeMode="contain" />
            <ThemedText style={[styles.logoTextCompact, { color: '#000000' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* App Icon */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>App Icon</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#FFF9F0' }]}>
            <Image source={logoIconGoldCream} style={styles.iconXLarge} resizeMode="contain" />
          </View>
        </View>

        {/* Dark Mode Version */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Dark Mode Version</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIconGold} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#C9A87C' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#E8D5B7' }]}>Style that flows</ThemedText>
          </View>
        </View>

        <View style={{ height: Spacing["2xl"] * 2 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subheader: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
    opacity: 0.6,
  },
  logoCard: {
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    opacity: 0.7,
  },
  logoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
  },
  logoPreviewHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    gap: Spacing.md,
  },
  iconXLarge: {
    width: 120,
    height: 120,
  },
  iconLarge: {
    width: 80,
    height: 80,
    marginBottom: Spacing.sm,
  },
  iconMedium: {
    width: 50,
    height: 50,
  },
  iconSmall: {
    width: 36,
    height: 36,
  },
  logoTextBold: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoTextHorizontal: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  logoTextCompact: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});
