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
import { saveGeneratedOutfitToProfile } from '@/utils/saveGeneratedOutfit';

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
};

export function SaveOutfitPromptModal({
  visible,
  intent,
  wardrobeItemIds,
  defaultTitle = 'My Outfit',
  defaultDescription = '',
  occasion = 'custom',
  onClose,
  onSaved,
  onCustomSave,
}: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(defaultTitle);
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
      Alert.alert('Nothing to save', 'This outfit has no wardrobe items linked yet.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: title.trim() || defaultTitle || 'My Outfit',
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
      Alert.alert(
        isLove ? 'Saved to favorites' : 'Outfit saved',
        isLove
          ? 'You can find this look in Profile → Saved Outfits.'
          : 'This outfit is in your Profile under Saved Outfits.',
      );
    } catch {
      Alert.alert('Could not save', 'Please try again in a moment.');
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
            <ThemedText type="body" style={{ color: theme.link }}>Cancel</ThemedText>
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Feather
              name={isLove ? 'heart' : 'bookmark'}
              size={18}
              color={isLove ? LuxuryColors.rose : LuxuryColors.gold}
            />
            <ThemedText type="h3">{isLove ? 'Love this outfit' : 'Save outfit'}</ThemedText>
          </View>
          <Pressable onPress={handleConfirm} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.link} />
            ) : (
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '700' }}>Save</ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="caption" style={[styles.label, { color: secondaryText }]}>
            Give this look a name so you can find it quickly in your saved outfits list.
          </ThemedText>

          <ThemedText type="caption" style={[styles.fieldLabel, { color: secondaryText }]}>
            Title
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Work Friday, Date night look..."
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
            Description (optional)
          </ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Why you love it, when to wear it, styling notes..."
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
