/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, ActivityIndicator, Image, ScrollView, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type DreamOutfitGeneratorScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "DreamOutfitGenerator">;
};

interface GeneratedOutfit {
  id: string;
  prompt: string;
  imageUrl: string;
  description: string;
  pieces: string[];
  estimatedCost: string;
  generatedAt: Date;
}

const STYLE_PRESETS = [
  { id: "casual", label: "Casual Chic", icon: "coffee" as const },
  { id: "formal", label: "Formal Elegance", icon: "briefcase" as const },
  { id: "streetwear", label: "Street Style", icon: "zap" as const },
  { id: "boho", label: "Bohemian", icon: "sun" as const },
  { id: "sporty", label: "Athleisure", icon: "activity" as const },
  { id: "date", label: "Date Night", icon: "heart" as const },
];

const OCCASION_OPTIONS = [
  "Work meeting",
  "Weekend brunch",
  "Evening date",
  "Casual Friday",
  "Beach vacation",
  "Wedding guest",
  "Job interview",
  "Night out",
];

export default function DreamOutfitGeneratorScreen({ navigation }: DreamOutfitGeneratorScreenProps) {
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const { user } = useAuth();
  const gender = user?.gender || "female";
  
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutfits, setGeneratedOutfits] = useState<GeneratedOutfit[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const isPremium = tier === "premium" || tier === "vip";

  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedStyle) return;
    
    setIsGenerating(true);
    
    try {
      const fullPrompt = prompt || `${selectedStyle} style for ${selectedOccasion || "any occasion"}`;
      
      const response = await apiService.generateDreamOutfit({
        prompt: fullPrompt,
        style: selectedStyle || undefined,
        occasion: selectedOccasion || undefined,
        gender,
      });

      if (response.success && response.outfit) {
        const newOutfit: GeneratedOutfit = {
          id: Date.now().toString(),
          prompt: fullPrompt,
          imageUrl: response.outfit.imageUrl,
          description: response.outfit.description,
          pieces: response.outfit.pieces,
          estimatedCost: response.outfit.estimatedCost,
          generatedAt: new Date(),
        };

        setGeneratedOutfits(prev => [newOutfit, ...prev]);
        setPrompt("");
        setSelectedStyle(null);
        setSelectedOccasion(null);
      } else {
        Alert.alert('Generation Failed', 'Could not generate the outfit. Please try again.');
      }
    } catch (error: any) {
      console.error('Dream outfit generation error:', error);
      Alert.alert('Error', error.message || 'Failed to generate outfit. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderGeneratedOutfit = (outfit: GeneratedOutfit) => (
    <Card key={outfit.id} style={styles.outfitCard}>
      <Image source={{ uri: outfit.imageUrl }} style={styles.outfitImage} />
      
      <View style={styles.outfitContent}>
        <ThemedText type="h3" style={styles.outfitPrompt}>
          {outfit.prompt}
        </ThemedText>
        
        <ThemedText style={[styles.outfitDescription, { color: theme.tabIconDefault }]}>
          {outfit.description}
        </ThemedText>

        <View style={styles.piecesSection}>
          <ThemedText type="small" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
            Key Pieces:
          </ThemedText>
          {outfit.pieces.map((piece, index) => (
            <View key={index} style={styles.pieceItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText type="small">{piece}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.costRow}>
          <Feather name="tag" size={14} color={theme.link} />
          <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
            Estimated: {outfit.estimatedCost}
          </ThemedText>
        </View>

        <View style={styles.outfitActions}>
          <Pressable
            style={({ pressed }) => [
              styles.outfitActionButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="shopping-bag" size={14} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 }}>
              Shop Similar
            </ThemedText>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.outfitActionButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="bookmark" size={14} color={theme.text} />
            <ThemedText style={{ fontWeight: "600", fontSize: 12 }}>Save</ThemedText>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.outfitActionButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="share-2" size={14} color={theme.text} />
            <ThemedText style={{ fontWeight: "600", fontSize: 12 }}>Share</ThemedText>
          </Pressable>
        </View>
      </View>
    </Card>
  );

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#f093fb", "#f5576c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="image" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Dream Outfit Generator</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Describe your perfect outfit and watch AI bring it to life
        </ThemedText>
      </View>

      {!isPremium ? (
        <Card style={styles.premiumCard}>
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBadge}
          >
            <Feather name="star" size={16} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h3" style={styles.premiumTitle}>
            Premium Feature
          </ThemedText>
          <ThemedText style={[styles.premiumDescription, { color: theme.tabIconDefault }]}>
            Upgrade to Premium or VIP to generate unlimited AI-powered outfit visualizations using DALL-E
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.upgradeButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeButtonGradient}
            >
              <ThemedText style={styles.upgradeButtonText}>Upgrade Now</ThemedText>
            </LinearGradient>
          </Pressable>
        </Card>
      ) : (
        <>
          <Card style={styles.generatorCard}>
            <ThemedText type="h4" style={styles.sectionLabel}>
              Describe Your Dream Outfit
            </ThemedText>
            <TextInput
              style={[
                styles.promptInput,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="E.g., A sophisticated cocktail dress with modern edge..."
              placeholderTextColor={theme.tabIconDefault}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={3}
            />

            <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
              Or Choose a Style
            </ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {STYLE_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => setSelectedStyle(selectedStyle === preset.id ? null : preset.id)}
                  style={({ pressed }) => [
                    styles.presetButton,
                    {
                      backgroundColor: selectedStyle === preset.id ? theme.link : theme.backgroundSecondary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Feather 
                    name={preset.icon} 
                    size={16} 
                    color={selectedStyle === preset.id ? "#FFFFFF" : theme.text} 
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: selectedStyle === preset.id ? "#FFFFFF" : theme.text,
                      fontWeight: "500",
                    }}
                  >
                    {preset.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
              Occasion (Optional)
            </ThemedText>
            <View style={styles.occasionGrid}>
              {OCCASION_OPTIONS.map((occasion) => (
                <Pressable
                  key={occasion}
                  onPress={() => setSelectedOccasion(selectedOccasion === occasion ? null : occasion)}
                  style={({ pressed }) => [
                    styles.occasionChip,
                    {
                      backgroundColor: selectedOccasion === occasion 
                        ? theme.link + "20" 
                        : theme.backgroundSecondary,
                      borderColor: selectedOccasion === occasion ? theme.link : "transparent",
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{
                      color: selectedOccasion === occasion ? theme.link : theme.text,
                      fontWeight: selectedOccasion === occasion ? "600" : "400",
                    }}
                  >
                    {occasion}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating || (!prompt.trim() && !selectedStyle)}
              style={({ pressed }) => [
                styles.generateButton,
                { opacity: pressed || isGenerating || (!prompt.trim() && !selectedStyle) ? 0.6 : 1 },
              ]}
            >
              <LinearGradient
                colors={["#f093fb", "#f5576c"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.generateButtonGradient}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <ThemedText style={styles.generateButtonText}>Generating Your Dream Outfit...</ThemedText>
                  </>
                ) : (
                  <>
                    <Feather name="star" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.generateButtonText}>Generate Outfit</ThemedText>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Card>

          {generatedOutfits.length > 0 ? (
            <View style={styles.resultsSection}>
              <View style={styles.resultsHeader}>
                <ThemedText type="h3">Generated Outfits</ThemedText>
                <Pressable
                  onPress={() => setShowHistory(!showHistory)}
                  style={styles.historyToggle}
                >
                  <ThemedText type="small" style={{ color: theme.link }}>
                    {showHistory ? "Hide History" : `Show All (${generatedOutfits.length})`}
                  </ThemedText>
                </Pressable>
              </View>

              {(showHistory ? generatedOutfits : generatedOutfits.slice(0, 2)).map(renderGeneratedOutfit)}
            </View>
          ) : null}
        </>
      )}
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  premiumCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  premiumBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  premiumTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  premiumDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    width: "100%",
  },
  upgradeButtonGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  generatorCard: {
    padding: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
  },
  promptInput: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.body.fontSize,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
  },
  presetRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  presetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  occasionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  occasionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  generateButton: {
    marginTop: Spacing.xl,
  },
  generateButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  resultsSection: {
    gap: Spacing.md,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  outfitCard: {
    overflow: "hidden",
    padding: 0,
  },
  outfitImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#E0E0E0",
  },
  outfitContent: {
    padding: Spacing.md,
  },
  outfitPrompt: {
    marginBottom: Spacing.sm,
  },
  outfitDescription: {
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  piecesSection: {
    marginBottom: Spacing.md,
  },
  pieceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  outfitActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  outfitActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
});
