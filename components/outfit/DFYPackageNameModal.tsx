import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';

type Props = {
  visible: boolean;
  defaultName: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export function DFYPackageNameModal({
  visible,
  defaultName,
  title,
  subtitle,
  onClose,
  onSave,
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(defaultName);
  }, [visible, defaultName]);

  const secondaryText = isDark ? '#888' : '#999';

  const handleConfirm = async () => {
    const trimmed = name.trim() || defaultName;
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // Caller surfaces errors; keep modal open
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={isSaving}>
            <ThemedText type="body" style={{ color: theme.link }}>
              {t('common.cancel') || 'Cancel'}
            </ThemedText>
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Feather name="edit-3" size={18} color={LuxuryColors.gold} />
            <ThemedText type="h3">
              {title || t('dfy.package.nameTitle') || 'Name your style plan'}
            </ThemedText>
          </View>
          <Pressable onPress={handleConfirm} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.link} />
            ) : (
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '700' }}>
                {t('common.save') || 'Save'}
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.content}>
          <ThemedText type="caption" style={[styles.label, { color: secondaryText }]}>
            {subtitle ||
              t('dfy.package.nameSubtitle') ||
              'This name appears on your Profile so you can reopen this plan later.'}
          </ThemedText>

          <ThemedText type="caption" style={[styles.fieldLabel, { color: secondaryText }]}>
            {t('savedOutfits.titleLabel') || 'Title'}
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={defaultName}
            placeholderTextColor={secondaryText}
            autoFocus
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
});
