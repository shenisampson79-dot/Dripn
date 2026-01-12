import React, { useState, useCallback } from "react";
import { StyleSheet, View, Pressable, TextInput, ActivityIndicator, Share } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type StyleStoriesScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "StyleStories">;
};

interface StoryTemplate {
  id: string;
  name: string;
  description: string;
}

interface GeneratedStory {
  title: string;
  story: string;
  voiceScript: string;
  soundtrackMood: string;
  socialCaptions: {
    instagram: string;
    twitter: string;
    linkedin: string;
  };
  keyMoment: string;
}

const STORY_TEMPLATES: StoryTemplate[] = [
  { id: "origin", name: "The Outfit That Started It All", description: "The moment fashion clicked for you" },
  { id: "confidence", name: "The Day You Owned the Room", description: "When your outfit gave you superpowers" },
  { id: "journey", name: "Your Style Journey", description: "How your fashion evolved over time" },
  { id: "signature", name: "Your Signature", description: "What makes your style uniquely yours" },
  { id: "transformation", name: "The Transformation", description: "A style moment that changed everything" },
];

const TEMPLATE_ICONS: Record<string, string> = {
  origin: "star",
  confidence: "award",
  journey: "map",
  signature: "edit-3",
  transformation: "refresh-cw",
};

const MOOD_COLORS: Record<string, string> = {
  cinematic: "#6366F1",
  uplifting: "#F59E0B",
  reflective: "#8B5CF6",
  powerful: "#EF4444",
};

export default function StyleStoriesScreen({ navigation }: StyleStoriesScreenProps) {
  const { theme, isDark } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) {
      setError("Please select a story template");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const data = await apiService.post<GeneratedStory>("/api/style-stories/generate", {
        templateId: selectedTemplate,
        userInput: userInput.trim() || undefined,
        includeVoice: true,
      });
      setStory(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate story");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, userInput]);

  const handleShare = async (platform: "instagram" | "twitter" | "linkedin") => {
    if (!story) return;
    try {
      await Share.share({
        message: story.socialCaptions[platform],
      });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleReset = () => {
    setStory(null);
    setSelectedTemplate(null);
    setUserInput("");
  };

  return (
    <ScreenScrollView style={styles.container}>
      <Card style={styles.introCard}>
        <View style={styles.introHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.link + "20" }]}>
            <Feather name="book" size={28} color={theme.link} />
          </View>
          <View style={styles.introText}>
            <ThemedText type="h3">Style Stories</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              Create cinematic narratives about your fashion journey
            </ThemedText>
          </View>
        </View>
      </Card>

      {!story ? (
        <>
          <View style={styles.section}>
            <ThemedText type="body" style={styles.sectionTitle}>Choose Your Story</ThemedText>
            {STORY_TEMPLATES.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => setSelectedTemplate(template.id)}
                style={[
                  styles.templateCard,
                  { backgroundColor: theme.backgroundSecondary },
                  selectedTemplate === template.id && { borderColor: theme.link, borderWidth: 2 },
                ]}
              >
                <View style={[styles.templateIcon, { backgroundColor: theme.link + "20" }]}>
                  <Feather name={TEMPLATE_ICONS[template.id] as any} size={24} color={theme.link} />
                </View>
                <View style={styles.templateContent}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{template.name}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>{template.description}</ThemedText>
                </View>
                {selectedTemplate === template.id && (
                  <Feather name="check-circle" size={24} color={theme.link} />
                )}
              </Pressable>
            ))}
          </View>

          <Card style={styles.inputCard}>
            <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
              Add Your Personal Touch (Optional)
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
              Share details to make your story more personal
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="e.g., That red dress I wore to my graduation, the vintage jacket from my grandmother..."
              placeholderTextColor={theme.tabIconDefault}
              multiline
              numberOfLines={3}
              value={userInput}
              onChangeText={setUserInput}
              textAlignVertical="top"
            />

            {error && (
              <ThemedText type="caption" style={{ color: theme.error, marginTop: Spacing.sm }}>
                {error}
              </ThemedText>
            )}

            <Button
              onPress={handleGenerate}
              disabled={isGenerating || !selectedTemplate}
              style={{ marginTop: Spacing.md }}
            >
              {isGenerating ? "Creating Your Story..." : "Generate Story"}
            </Button>
          </Card>

          {isGenerating && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.link} />
              <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                Crafting your fashion narrative...
              </ThemedText>
            </View>
          )}
        </>
      ) : (
        <>
          <Card style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <ThemedText type="h2">{story.title}</ThemedText>
              <View style={[styles.moodTag, { backgroundColor: MOOD_COLORS[story.soundtrackMood] || theme.link }]}>
                <Feather name="music" size={12} color="#FFF" />
                <ThemedText type="small" style={{ color: "#FFF", marginLeft: 4 }}>{story.soundtrackMood}</ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={styles.storyText}>{story.story}</ThemedText>
          </Card>

          <Card style={[styles.keyMomentCard, { backgroundColor: theme.link + "10" }]}>
            <Feather name="bookmark" size={20} color={theme.link} style={{ alignSelf: "center", marginBottom: Spacing.sm }} />
            <ThemedText type="caption" style={{ color: theme.link, textAlign: "center", fontWeight: "600" }}>
              Key Moment
            </ThemedText>
            <ThemedText type="body" style={{ textAlign: "center", fontStyle: "italic", marginTop: Spacing.sm }}>
              "{story.keyMoment}"
            </ThemedText>
          </Card>

          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Voice Script</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.sm }}>
              Perfect for voice-over or podcast narration
            </ThemedText>
            <View style={[styles.scriptBox, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="body">{story.voiceScript}</ThemedText>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Share Your Story</ThemedText>
            
            <View style={styles.socialSection}>
              <View style={styles.socialHeader}>
                <View style={[styles.socialIcon, { backgroundColor: "#E1306C" }]}>
                  <Feather name="instagram" size={16} color="#FFF" />
                </View>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Instagram</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginVertical: Spacing.sm }}>
                {story.socialCaptions.instagram}
              </ThemedText>
              <Pressable onPress={() => handleShare("instagram")} style={[styles.shareBtn, { borderColor: theme.link }]}>
                <Feather name="share" size={16} color={theme.link} />
                <ThemedText type="caption" style={{ color: theme.link, marginLeft: Spacing.xs }}>Share</ThemedText>
              </Pressable>
            </View>

            <View style={[styles.socialSection, { marginTop: Spacing.md }]}>
              <View style={styles.socialHeader}>
                <View style={[styles.socialIcon, { backgroundColor: "#1DA1F2" }]}>
                  <Feather name="twitter" size={16} color="#FFF" />
                </View>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Twitter</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginVertical: Spacing.sm }}>
                {story.socialCaptions.twitter}
              </ThemedText>
              <Pressable onPress={() => handleShare("twitter")} style={[styles.shareBtn, { borderColor: theme.link }]}>
                <Feather name="share" size={16} color={theme.link} />
                <ThemedText type="caption" style={{ color: theme.link, marginLeft: Spacing.xs }}>Share</ThemedText>
              </Pressable>
            </View>

            <View style={[styles.socialSection, { marginTop: Spacing.md }]}>
              <View style={styles.socialHeader}>
                <View style={[styles.socialIcon, { backgroundColor: "#0077B5" }]}>
                  <Feather name="linkedin" size={16} color="#FFF" />
                </View>
                <ThemedText type="body" style={{ fontWeight: "600" }}>LinkedIn</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginVertical: Spacing.sm }}>
                {story.socialCaptions.linkedin}
              </ThemedText>
              <Pressable onPress={() => handleShare("linkedin")} style={[styles.shareBtn, { borderColor: theme.link }]}>
                <Feather name="share" size={16} color={theme.link} />
                <ThemedText type="caption" style={{ color: theme.link, marginLeft: Spacing.xs }}>Share</ThemedText>
              </Pressable>
            </View>
          </Card>

          <Pressable 
            onPress={handleReset} 
            style={[styles.secondaryButton, { borderColor: theme.link }]}
          >
            <ThemedText type="body" style={{ color: theme.link }}>Create Another Story</ThemedText>
          </Pressable>
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
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  templateContent: {
    flex: 1,
  },
  inputCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    fontSize: 16,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  storyCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  storyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  moodTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  storyText: {
    lineHeight: 24,
  },
  keyMomentCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  sectionCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  scriptBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  socialSection: {
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  socialHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  socialIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  secondaryButton: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
});
