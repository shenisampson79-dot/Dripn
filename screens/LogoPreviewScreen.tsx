import React from "react";
import { StyleSheet, View, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

const logoIcon = require("../assets/images/dripn-logo-icon.png");

export default function LogoPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="h2" style={styles.header}>Dripn Logo Variations</ThemedText>
        
        {/* Option 1: Text Below - Bold Sans */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 1: Text Below (Bold)</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#FFF' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 2: Text Below - Script Style */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 2: Text Below (Elegant)</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextElegant, { color: '#C9A87C' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 3: Text Above */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 3: Text Above (Bold)</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#000' }]}>
            <ThemedText style={[styles.logoTextBold, { color: '#FFF' }]}>Dripn</ThemedText>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
          </View>
        </View>

        {/* Option 4: Horizontal - Icon Left */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 4: Horizontal (Icon Left)</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconMedium} resizeMode="contain" />
            <ThemedText style={[styles.logoTextHorizontal, { color: '#FFF' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 5: Horizontal - Icon Left (Gold Text) */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 5: Horizontal (Gold Text)</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconMedium} resizeMode="contain" />
            <ThemedText style={[styles.logoTextHorizontalGold, { color: '#C9A87C' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 6: Compact Horizontal */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 6: Compact (App Header Style)</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconSmall} resizeMode="contain" />
            <ThemedText style={[styles.logoTextCompact, { color: '#FFF' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 7: White Background Versions */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 7: Light Mode Version</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#FFF' }]}>
            <View style={styles.iconInverted}>
              <Image source={logoIcon} style={[styles.iconMedium, { tintColor: '#000' }]} resizeMode="contain" />
            </View>
            <ThemedText style={[styles.logoTextHorizontal, { color: '#000' }]}>Dripn</ThemedText>
          </View>
        </View>

        {/* Option 8: Stylized with tagline */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 8: With Tagline</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#FFF' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#C9A87C' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 9: Uppercase Bold */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 9: Uppercase Bold</ThemedText>
          <View style={[styles.logoPreviewHorizontal, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconMedium} resizeMode="contain" />
            <ThemedText style={[styles.logoTextUppercase, { color: '#FFF' }]}>DRIPN</ThemedText>
          </View>
        </View>

        {/* Option 10: Minimal Icon Only */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>Option 10: Icon Only (App Icon)</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#000' }]}>
            <Image source={logoIcon} style={styles.iconXLarge} resizeMode="contain" />
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
    marginBottom: Spacing.xl,
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
  iconInverted: {
    backgroundColor: '#FFF',
  },
  logoTextBold: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoTextElegant: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 6,
    fontStyle: 'italic',
  },
  logoTextHorizontal: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  logoTextHorizontalGold: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 3,
  },
  logoTextCompact: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  logoTextUppercase: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});
