import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
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
import { messageFromOutfitSaveError, saveGeneratedOutfitToProfile } from '@/utils/saveGeneratedOutfit';

export type SaveOutfitIntent = 'save' | 'love';

type Props = {
  visible: boolean;
  intent: SaveOutfitIntent;
  wardrobeItemIds: string[];
  defaultTitle?: string;
  defaultDescription?: string;
  occasion?: string;
  onClose: () => void;
  onSaved?: () => void;
  onCustomSave?: (data: { name: string; description?: string }) => Promise<void>;
  /**
   * When true, render as an absolute overlay (no nested Modal).
   * Required when opening from an already-visible Modal (e.g. Today's Outfit).
   */
  embedded?: boolean;
  /** `replace` fills the parent sheet (preferred). `overlay` dims content above. */
  embeddedLayout?: 'overlay' | 'replace';
};

export function SaveOutfitPromptModal({
  visible,
  intent,
  wardrobeItemIds,
  defaultTitle,
  defaultDescription = '',
  occasion = 'custom',
  onClose,
  onSaved,
  onCustomSave,
  embedded = false,
  embeddedLayout = 'overlay',
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(defaultTitle || t('savedOutfits.defaultTitle'));
  const [description, setDescription] = useState(defaultDescription);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(defaultTitle);
    setDescription(defaultDescription);
  }, [visible, defaultTitle, defaultDescription]);

  const secondaryText = isDark ? '#888' : '#999';
  const isLove = intent === 'love';

  const handleConfirm = async () => {
    if (!onCustomSave && wardrobeItemIds.length === 0) {
      Alert.alert(t('savedOutfits.nothingToSaveTitle'), t('savedOutfits.nothingToSaveMessage'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: title.trim() || defaultTitle || t('savedOutfits.defaultTitle'),
        description: description.trim() || undefined,
      };

      if (onCustomSave) {
        await onCustomSave(payload);
      } else {
        await saveGeneratedOutfitToProfile({
          ...payload,
          occasion,
          wardrobeItemIds,
          loved: isLove,
        });
      }
      onSaved?.();
      onClose();
      // Single-line confirmation — no separate title (avoids stub copy like "Outfit Saved Title")
      const savedCopy = isLove
        ? (t('savedOutfits.savedToFavoritesMessage') || 'Saved to favorites. Find it anytime in Profile → Saved Outfits.')
        : (t('savedOutfits.outfitSavedMessage') || 'Outfit saved. Find it anytime in Profile → Saved Outfits.');
      const cleaned =
        /\b(Title|Message)\s*$/i.test(savedCopy.trim()) || /^(Outfit Saved|Saved To Favorites)\b/i.test(savedCopy.trim())
          ? (isLove
              ? 'Saved to favorites. Find it anytime in Profile → Saved Outfits.'
              : 'Outfit saved. Find it anytime in Profile → Saved Outfits.')
          : savedCopy.trim();
      Alert.alert(cleaned, undefined, [{ text: t('common.ok') || t('common.done') || 'OK' }]);
    } catch (err) {
      Alert.alert(
        messageFromOutfitSaveError(err),
        undefined,
        [{ text: t('common.ok') || t('common.done') || 'OK' }],
      );
    } finally {
      setIsSaving(false);
    }
  };

  const body = (
      <ThemedView style={[styles.container, { paddingTop: embedded ? Spacing.md : insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={isSaving}>
            <ThemedText type="body" style={{ color: theme.link }}>{t('common.cancel')}</ThemedText>
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Feather
              name={isLove ? 'heart' : 'bookmark'}
              size={18}
              color={isLove ? LuxuryColors.rose : LuxuryColors.gold}
            />
            <ThemedText type="h3">{isLove ? t('savedOutfits.loveThisOutfit') : t('savedOutfits.saveOutfit')}</ThemedText>
          </View>
          <Pressable onPress={handleConfirm} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.link} />
            ) : (
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '700' }}>{t('common.save')}</ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="caption" style={[styles.label, { color: secondaryText }]}>
            {t('savedOutfits.namePrompt')}
          </ThemedText>

          <ThemedText type="caption" style={[styles.fieldLabel, { color: secondaryText }]}>
            {t('savedOutfits.titleLabel')}
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('savedOutfits.titlePlaceholder')}
            placeholderTextColor={secondaryText}
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />

          <ThemedText type="caption" style={[styles.fieldLabel, { color: secondaryText }]}>
            {t('savedOutfits.descriptionOptional')}
          </ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('savedOutfits.descriptionPlaceholder')}
            placeholderTextColor={secondaryText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
          />
        </ScrollView>
      </ThemedView>
  );

  if (embedded) {
    if (!visible) return null;
    if (embeddedLayout === 'replace') {
      return <View style={styles.embeddedReplace}>{body}</View>;
    }
    return (
      <View style={styles.embeddedOverlay} pointerEvents="box-none">
        <View style={styles.embeddedSheet}>{body}</View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  embeddedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  embeddedSheet: {
    flex: 1,
    marginTop: 48,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  embeddedReplace: {
    flex: 1,
    minHeight: 360,
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
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
});
