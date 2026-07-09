import React, { useState } from "react";
import { StyleSheet, View, Modal, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiService } from "@/services/ApiService";
import { useTranslations } from "@/contexts/TranslationContext";

const REPORT_REASON_FALLBACKS: Record<string, string> = {
  spam: 'Spam or misleading',
  inappropriate: 'Inappropriate content',
  harassment: 'Harassment or bullying',
  copyright: 'Copyright violation',
  impersonation: 'Impersonation',
  other: 'Other',
};

const REPORT_REASONS = [
  { id: "spam", labelKey: "reportSpam", icon: "alert-circle" as const },
  { id: "inappropriate", labelKey: "reportInappropriate", icon: "eye-off" as const },
  { id: "harassment", labelKey: "reportHarassment", icon: "user-x" as const },
  { id: "copyright", labelKey: "reportCopyright", icon: "shield-off" as const },
  { id: "impersonation", labelKey: "reportImpersonation", icon: "user-minus" as const },
  { id: "other", labelKey: "reportOther", icon: "more-horizontal" as const },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: "post" | "comment" | "user";
  contentId: string;
}

export function ReportModal({ visible, onClose, contentType, contentId }: ReportModalProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert(
        t('community.selectReason') || 'Select a reason',
        t('community.selectReasonMessage') || 'Please select a reason for your report.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await apiService.reportContent({
        contentType,
        contentId,
        reason: selectedReason,
      });

      setSelectedReason(null);
      onClose();

      Alert.alert(
        t('community.reportSubmitted') || 'Report Submitted',
        t('community.reportSubmittedMessage') || 'Thank you for helping keep Dripn safe. Our team will review this content.',
        [{ text: t('common.done') || 'OK' }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : (t('community.reportFailedMessage') || 'Could not submit your report. Please try again.');
      Alert.alert(t('community.reportFailed') || 'Report Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <BlurView intensity={20} style={styles.blurContainer}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.header}>
              <ThemedText type="h2">{t('community.reportContent') || 'Report'} {contentType}</ThemedText>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="body" style={styles.description}>
              {t('community.whyReporting') || `Why are you reporting this ${contentType}?`}
            </ThemedText>

            <View style={styles.reasonsList}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  onPress={() => setSelectedReason(reason.id)}
                  style={({ pressed }) => [
                    styles.reasonItem,
                    {
                      backgroundColor:
                        selectedReason === reason.id
                          ? theme.link + "20"
                          : theme.backgroundDefault,
                      borderColor:
                        selectedReason === reason.id
                          ? theme.link
                          : theme.tabIconDefault + "40",
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={reason.icon}
                    size={20}
                    color={selectedReason === reason.id ? theme.link : theme.text}
                  />
                  <ThemedText
                    type="body"
                    style={{
                      color: selectedReason === reason.id ? theme.link : theme.text,
                      fontWeight: selectedReason === reason.id ? "600" : "400",
                    }}
                  >
                    {t(`community.${reason.labelKey}`) || REPORT_REASON_FALLBACKS[reason.id]}
                  </ThemedText>
                  {selectedReason === reason.id ? (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={theme.link}
                      style={styles.checkIcon}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.tabIconDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor:
                      !selectedReason || isSubmitting
                        ? theme.tabIconDefault
                        : theme.error || "#FF3B30",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  {isSubmitting ? (t('community.submitting') || 'Submitting...') : (t('community.submitReport') || 'Submit Report')}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  description: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  reasonsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkIcon: {
    marginLeft: "auto",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    borderWidth: 1,
  },
  submitButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
});
