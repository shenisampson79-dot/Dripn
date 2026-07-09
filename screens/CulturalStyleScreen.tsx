import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LinearGradient } from "expo-linear-gradient";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type CulturalStyleScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "CulturalStyle">;
};

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

interface CulturalStyleData {
  name: string;
  dressCodes: Record<string, string>;
  taboos: string[];
  currentTrends: string[];
  packingEssentials: string[];
}

const COUNTRY_FLAGS: Record<string, string> = {
  JP: "JP",
  FR: "FR",
  AE: "AE",
  US: "US",
  GB: "GB",
};

const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  FR: "France",
  AE: "UAE",
  US: "United States",
  GB: "United Kingdom",
};

const FEATURED_COUNTRIES: CountryOption[] = [
  { code: "JP", name: "Japan", flag: "JP" },
  { code: "FR", name: "France", flag: "FR" },
  { code: "AE", name: "UAE", flag: "AE" },
  { code: "US", name: "USA", flag: "US" },
  { code: "GB", name: "UK", flag: "GB" },
];

const DRESS_CODE_ICONS: Record<string, string> = {
  business: "briefcase",
  restaurants: "coffee",
  temples: "home",
  churches: "home",
  mosques: "home",
  "religious sites": "home",
  weddings: "heart",
  beaches: "sun",
};

export default function CulturalStyleScreen({ navigation }: CulturalStyleScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [styleData, setStyleData] = useState<CulturalStyleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCountryStyle = useCallback(async (countryCode: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.get<CulturalStyleData>(`/api/cultural-style/${countryCode}`);
      setStyleData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load cultural style guide");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectCountry = (code: string) => {
    setSelectedCountry(code);
    loadCountryStyle(code);
  };

  const renderCountrySelector = () => (
    <View style={styles.countryGrid}>
      {FEATURED_COUNTRIES.map((country) => (
        <Pressable
          key={country.code}
          onPress={() => handleSelectCountry(country.code)}
          style={[
            styles.countryCard,
            selectedCountry === country.code && { borderColor: theme.link, borderWidth: 2 },
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>{country.flag}</ThemedText>
          <ThemedText type="caption" style={{ textAlign: "center" }}>{country.name}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenScrollView style={styles.container}>
      <Card style={styles.introCard}>
        <View style={styles.introHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.link + "20" }]}>
            <Feather name="globe" size={28} color={theme.link} />
          </View>
          <View style={styles.introText}>
            <ThemedText type="h3">Style Diplomat</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              Cultural dress codes and fashion etiquette
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText type="body" style={styles.sectionTitle}>Select a Destination</ThemedText>
        {renderCountrySelector()}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md }}>
            Loading style guide for {COUNTRY_NAMES[selectedCountry || ""] || selectedCountry}...
          </ThemedText>
        </View>
      )}

      {error && (
        <Card style={[styles.errorCard, { borderColor: theme.error }]}>
          <ThemedText type="body" style={{ color: theme.error }}>{error}</ThemedText>
        </Card>
      )}

      {styleData && !isLoading && (
        <>
          <Card style={styles.sectionCard}>
            <View style={styles.countryHeader}>
              <ThemedText type="h2">{selectedCountry}</ThemedText>
              <ThemedText type="h3" style={{ marginLeft: Spacing.md }}>{styleData.name}</ThemedText>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              <Feather name="book-open" size={18} /> Dress Codes
            </ThemedText>
            {Object.entries(styleData.dressCodes).map(([occasion, description]) => (
              <View key={occasion} style={[styles.dressCodeItem, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={styles.dressCodeHeader}>
                  <Feather
                    name={(DRESS_CODE_ICONS[occasion.toLowerCase()] || "info") as any}
                    size={18}
                    color={theme.link}
                  />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600", textTransform: "capitalize" }}>
                    {occasion}
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ marginTop: Spacing.xs, color: theme.tabIconDefault }}>
                  {description}
                </ThemedText>
              </View>
            ))}
          </Card>

          <Card style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: "#F44336" }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              <Feather name="alert-triangle" size={18} /> Avoid These
            </ThemedText>
            {styleData.taboos.map((taboo, i) => (
              <View key={i} style={styles.tabooItem}>
                <Feather name="x-circle" size={16} color="#F44336" />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{taboo}</ThemedText>
              </View>
            ))}
          </Card>

          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              <Feather name="trending-up" size={18} /> Current Trends
            </ThemedText>
            <View style={styles.trendGrid}>
              {styleData.currentTrends.map((trend, i) => (
                <View key={i} style={[styles.trendTag, { backgroundColor: theme.link + "15" }]}>
                  <ThemedText type="caption" style={{ color: theme.link }}>{trend}</ThemedText>
                </View>
              ))}
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              <Feather name="briefcase" size={18} /> Packing Checklist
            </ThemedText>
            {styleData.packingEssentials.map((item, i) => (
              <View key={i} style={styles.checklistItem}>
                <View style={[styles.checkbox, { borderColor: theme.link }]}>
                  <Feather name="check" size={14} color={theme.link} />
                </View>
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{item}</ThemedText>
              </View>
            ))}
          </Card>

          <View style={styles.disclaimer}>
            <Feather name="info" size={14} color={theme.tabIconDefault} />
            <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.tabIconDefault, flex: 1 }}>
              These are general guidelines. Local customs may vary by region and occasion. When in doubt, dress conservatively.
            </ThemedText>
          </View>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  introCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  introText: {
    flex: 1,
  },
  section: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  countryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  countryCard: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
  },
  loadingContainer: {
    padding: Spacing.xl * 2,
    alignItems: "center",
  },
  errorCard: {
    margin: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  sectionCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  countryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dressCodeItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  dressCodeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabooItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  trendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  trendTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.lg,
    padding: Spacing.md,
  },
});
