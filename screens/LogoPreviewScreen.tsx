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
        <ThemedText type="h2" style={styles.header}>Dripn Logo - Color Variations</ThemedText>
        <ThemedText type="small" style={styles.subheader}>Option 8 with Tagline in Different Colors</ThemedText>
        
        {/* Option 8A: Gold/Champagne */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8A: Champagne Gold</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#C9A87C' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#E8D5B7' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8B: Rose Pink */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8B: Rose Pink</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#E891B0' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#F5C6D6' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8C: Electric Blue */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8C: Electric Blue</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#4DA8FF' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#8DC8FF' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8D: Mint Green */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8D: Mint Green</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#5CE5C5' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#A8F0DC' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8E: Lavender Purple */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8E: Lavender Purple</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#B89AE8' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#D4C4F5' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8F: Coral Orange */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8F: Coral Orange</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#FF7F6B' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#FFB3A7' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8G: Silver Chrome */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8G: Silver Chrome</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#C0C0C0' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#E0E0E0' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8H: Burgundy Wine */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8H: Burgundy Wine</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#9B3D5D' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#C77A94' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8I: Teal */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8I: Ocean Teal</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#2DB3A8' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#7DD4CC' }]}>Style that flows</ThemedText>
          </View>
        </View>

        {/* Option 8J: Sunset Gradient Look */}
        <View style={[styles.logoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={styles.label}>8J: Sunset Peach</ThemedText>
          <View style={[styles.logoPreview, { backgroundColor: '#0D0B09' }]}>
            <Image source={logoIcon} style={styles.iconLarge} resizeMode="contain" />
            <ThemedText style={[styles.logoTextBold, { color: '#FFAB76' }]}>Dripn</ThemedText>
            <ThemedText style={[styles.tagline, { color: '#FFCDB2' }]}>Style that flows</ThemedText>
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
  iconLarge: {
    width: 80,
    height: 80,
    marginBottom: Spacing.sm,
  },
  logoTextBold: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 2,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});
