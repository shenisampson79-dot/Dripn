import React, { useState } from "react";
import { StyleSheet, View, Modal, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

const REPORT_REASONS = [
  { id: "spam", label: "Spam or misleading", icon: "alert-circle" as const },
  { id: "inappropriate", label: "Inappropriate content", icon: "eye-off" as const },
  { id: "harassment", label: "Harassment or bullying", icon: "user-x" as const },
  { id: "copyright", label: "Copyright violation", icon: "shield-off" as const },
  { id: "impersonation", label: "Impersonation", icon: "user-minus" as const },
  { id: "other", label: "Other", icon: "more-horizontal" as const },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: "post" | "comment" | "user";
  contentId: string;
}

export function ReportModal({ visible, onClose, contentType, contentId }: ReportModalProps) {
  const { theme } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Select a reason", "Please select a reason for your report.");
      return;
    }

    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setSelectedReason(null);
    onClose();
    
    Alert.alert(
      "Report Submitted",
      "Thank you for helping keep Dripn safe. Our team will review this content.",
      [{ text: "OK" }]
    );
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
              <ThemedText type="h2">Report {contentType}</ThemedText>
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
              Why are you reporting this {contentType}?
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
                          : theme.background,
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
                    {reason.label}
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
                    backgroundColor: theme.background,
                    borderColor: theme.tabIconDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Cancel
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
                  {isSubmitting ? "Submitting..." : "Submit Report"}
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
