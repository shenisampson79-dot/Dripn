import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { useVoiceSettings, SUPPORTED_LANGUAGES } from "@/contexts/VoiceSettingsContext";
import { STYLIST_LANGUAGES } from "@/services/PersonalStylistService";
import { selectableAppUiLanguages } from "@/utils/appUiLanguage";
import {
  resolveStylistSpeakLanguage,
  stylistLanguageCodeToName,
  stylistLanguageNameToCode,
} from "@/utils/stylistLanguage";

type LanguagePickerMode = "app" | "stylist";

type LanguagePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** `app` = UI chrome only. `stylist` = chat + voice speak language only. */
  mode?: LanguagePickerMode;
  /**
   * Pre-auth Welcome / Get Styled: changing app language also sets stylist speak language
   * (voice preferredLanguage + logged-in stylistPreferences when present).
   */
  alsoSetStylistLanguage?: boolean;
};

/**
 * Shared language picker for Welcome / Settings.
 * App mode normally never changes stylist speak language; stylist mode never changes UI language.
 * Pass alsoSetStylistLanguage on Welcome so Get Styled stylists reply in the chosen language.
 */
export function LanguagePickerModal({
  visible,
  onClose,
  mode = "app",
  alsoSetStylistLanguage = false,
}: LanguagePickerModalProps) {
  const { theme, isDark } = useTheme();
  const { t, setLanguage, currentLanguage, availableLanguages, isLoading } = useTranslations();
  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();
  const { user, updateProfile } = useAuth();
  const [selectingCode, setSelectingCode] = useState<string | null>(null);

  const isStylistMode = mode === "stylist";

  const stylistSpeakCode = resolveStylistSpeakLanguage({
    stylistLanguageName: user?.stylistPreferences?.language,
    preferredLanguageCode: voiceSettings.preferredLanguage,
    uiLanguageCode: currentLanguage,
  });

  const languageOptions = useMemo(() => {
    if (isStylistMode) {
      return STYLIST_LANGUAGES.map((name) => {
        const code = stylistLanguageNameToCode(name);
        const supported = SUPPORTED_LANGUAGES.find((l) => l.code === code);
        return {
          code,
          name,
          nativeName: supported?.nativeName || name,
          direction: (code === "ar" ? "rtl" : "ltr") as "ltr" | "rtl",
        };
      });
    }
    return selectableAppUiLanguages(availableLanguages);
  }, [availableLanguages, isStylistMode]);

  const selectedCode = isStylistMode ? stylistSpeakCode : currentLanguage;

  const handleSelect = async (langCode: string) => {
    if (selectingCode) return;
    if (langCode === selectedCode) {
      onClose();
      return;
    }

    setSelectingCode(langCode);
    try {
      if (isStylistMode) {
        const languageName = stylistLanguageCodeToName(langCode);
        await updateVoiceSettings({ preferredLanguage: langCode });
        if (user) {
          await updateProfile({
            stylistPreferences: {
              ...user.stylistPreferences,
              language: languageName,
            },
          });
        }
      } else {
        await setLanguage(langCode);
        if (alsoSetStylistLanguage) {
          const languageName = stylistLanguageCodeToName(langCode);
          await updateVoiceSettings({ preferredLanguage: langCode });
          if (user) {
            await updateProfile({
              stylistPreferences: {
                ...user.stylistPreferences,
                language: languageName,
              },
            });
          }
        }
      }
      onClose();
    } catch {
      // Error toast is shown by TranslationContext for app mode
    } finally {
      setSelectingCode(null);
    }
  };

  const showInitialLoading = !isStylistMode && isLoading && languageOptions.length === 0;
  const title = isStylistMode
    ? t("settings.selectStylistLanguage") || "Select stylist language"
    : t("settings.selectLanguage") || "Language / Idioma / Langue";

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
                {title}
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
                const isSelected = selectedCode === lang.code;
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
      accessibilityLabel={t("settings.appLanguage") || t("settings.language") || "App language"}
    >
      <Feather name="globe" size={16} color={color} />
      <ThemedText type="small" style={[styles.entryButtonText, { color }]}>
        {t("settings.appLanguage") || t("settings.language") || "Language"} · {label}
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
