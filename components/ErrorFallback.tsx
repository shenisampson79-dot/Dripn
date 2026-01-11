import React, { useState } from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { OnboardingService } from "@/services/OnboardingService";
import { CommonActions, NavigationContainerRef } from "@react-navigation/native";

let navigationRef: NavigationContainerRef<any> | null = null;
let currentOnboardingStep: number | null = null;

export function setNavigationRef(ref: NavigationContainerRef<any> | null) {
  navigationRef = ref;
}

export function setCurrentOnboardingStep(step: number | null) {
  currentOnboardingStep = step;
}

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const { theme } = useTheme();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      if (navigationRef && navigationRef.isReady()) {
        if (currentOnboardingStep !== null) {
          resetError();
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ 
                name: 'Onboarding' as never, 
                params: { initialStep: currentOnboardingStep } 
              }],
            })
          );
        } else {
          const progress = await OnboardingService.getOnboardingProgress();
          
          if (progress.onboardingComplete) {
            resetError();
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' as never }],
              })
            );
          } else {
            resetError();
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ 
                  name: 'Onboarding' as never, 
                  params: { initialStep: progress.onboardingStep } 
                }],
              })
            );
          }
        }
      } else {
        resetError();
        try {
          await reloadAppAsync();
        } catch (reloadError) {
          console.error("Failed to reload app:", reloadError);
        }
      }
    } catch (restartError) {
      console.error("Failed to restore progress, reloading app:", restartError);
      try {
        await reloadAppAsync();
      } catch (reloadError) {
        console.error("Failed to reload app:", reloadError);
        resetError();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  return (
    <ThemedView style={styles.container}>
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          style={({ pressed }) => [
            styles.topButton,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="alert-circle" size={20} color={theme.text} />
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="frown" size={48} color={theme.link} />
        </View>

        <ThemedText type="h1" style={styles.title}>
          Oops! Dripn hit a snag
        </ThemedText>

        <ThemedText type="body" style={styles.message}>
          Something went wrong, but don't worry - your style journey isn't over. Let's get you back on track!
        </ThemedText>

        <Pressable
          onPress={handleRestart}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.link,
              opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && !isLoading ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="refresh-cw" size={20} color="#FFFFFF" />
          )}
          <ThemedText
            type="body"
            style={[styles.buttonText, { color: theme.buttonText }]}
          >
            {isLoading ? "Restoring..." : "Refresh My Look"}
          </ThemedText>
        </Pressable>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <ThemedText type="h2" style={styles.modalTitle}>
                  Error Details
                </ThemedText>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.errorContainer,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <Text
                    style={[
                      styles.errorText,
                      {
                        color: theme.text,
                        fontFamily: Fonts?.mono || "monospace",
                      },
                    ]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </ThemedView>
          </View>
        </Modal>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    width: "100%",
    maxWidth: 600,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    opacity: 0.7,
  },
  topButton: {
    position: "absolute",
    top: Spacing["2xl"] + Spacing.lg,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing["2xl"],
    minWidth: 200,
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.2)",
  },
  modalTitle: {
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
  },
  errorContainer: {
    width: "100%",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
  },
});
