import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
import { useVoiceSettings, SUPPORTED_LANGUAGES } from "@/contexts/VoiceSettingsContext";

type LanguagePickerModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Shared language picker used by Settings and early auth/onboarding screens.
 * Updates UI language via TranslationContext and syncs preferredLanguage for AI/voice.
 */
export function LanguagePickerModal({ visible, onClose }: LanguagePickerModalProps) {
  const { theme, isDark } = useTheme();
  const { t, setLanguage, currentLanguage, availableLanguages, isLoading } = useTranslations();
  const { updateSettings: updateVoiceSettings } = useVoiceSettings();
  const [selectingCode, setSelectingCode] = useState<string | null>(null);

  const languageOptions = useMemo(
    () =>
      availableLanguages.length > 0
        ? availableLanguages
        : SUPPORTED_LANGUAGES.map((lang) => ({
            ...lang,
            direction: (lang.code === "ar" ? "rtl" : "ltr") as "ltr" | "rtl",
          })),
    [availableLanguages]
  );

  const handleSelect = async (langCode: string) => {
    if (selectingCode) return;
    if (langCode === currentLanguage) {
      onClose();
      return;
    }

    setSelectingCode(langCode);
    try {
      // UI chrome first — local bundles apply immediately
      await setLanguage(langCode);
      try {
        await updateVoiceSettings({ preferredLanguage: langCode });
      } catch (voiceError) {
        // Voice preference sync must not undo a successful UI language change
        console.warn("Failed to sync preferredLanguage to voice settings:", voiceError);
      }
      onClose();
    } catch {
      // Error toast is shown by TranslationContext
    } finally {
      setSelectingCode(null);
    }
  };

  const showInitialLoading = isLoading && languageOptions.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={selectingCode ? undefined : onClose}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? LuxuryColors.midnight : "#FFFFFF" },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={
              isDark
                ? [LuxuryColors.violet + "30", "transparent"]
                : [LuxuryColors.violet + "15", "transparent"]
            }
            style={styles.modalHeaderGradient}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={styles.modalTitle}>
                {t("settings.selectLanguage") || "Language / Idioma / Langue"}
              </ThemedText>
              <Pressable
                onPress={onClose}
                disabled={!!selectingCode}
                style={[
                  styles.modalCloseButton,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                ]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
          </LinearGradient>

          {showInitialLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={LuxuryColors.violet} />
            </View>
          ) : (
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {languageOptions.map((lang) => {
                const isSelecting = selectingCode === lang.code;
                const isSelected = currentLanguage === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    disabled={!!selectingCode}
                    style={({ pressed }) => [
                      styles.modalOption,
                      {
                        backgroundColor: pressed
                          ? isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.03)"
                          : "transparent",
                      },
                      isSelected && {
                        backgroundColor: LuxuryColors.violet + "20",
                      },
                    ]}
                    onPress={() => handleSelect(lang.code)}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={styles.modalOptionText}>
                        {lang.nativeName}
                      </ThemedText>
                      <ThemedText type="small" style={styles.modalOptionSubtext}>
                        {lang.name}
                      </ThemedText>
                    </View>
                    {isSelecting ? (
                      <ActivityIndicator size="small" color={LuxuryColors.violet} />
                    ) : isSelected ? (
                      <Feather name="check" size={20} color={LuxuryColors.violet} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

/** Compact globe control for Welcome / Auth entry screens */
export function LanguageEntryButton({
  onPress,
  light = true,
}: {
  onPress: () => void;
  light?: boolean;
}) {
  const { theme } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const label =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName ||
    currentLanguage.toUpperCase();
  const color = light ? "#FFFFFF" : theme.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.entryButton,
        !light && styles.entryButtonDark,
        { opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("settings.language") || "Language"}
    >
      <Feather name="globe" size={16} color={color} />
      <ThemedText type="small" style={[styles.entryButtonText, { color }]}>
        {t("settings.language") || "Language"} · {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
    paddingBottom: Spacing.xl,
  },
  modalHeaderGradient: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    flex: 1,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    paddingHorizontal: Spacing.md,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  modalOptionText: {
    fontWeight: "600",
  },
  modalOptionSubtext: {
    opacity: 0.6,
    marginTop: 2,
  },
  loadingWrap: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  entryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  entryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  entryButtonDark: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderColor: "rgba(0,0,0,0.12)",
  },
});
