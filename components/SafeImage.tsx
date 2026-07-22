import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/hooks/useTheme';
import { logInvalidRender } from '@/utils/safeRender';
import { wardrobeTileBackground } from '@/utils/wardrobeImage';

type Props = {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  contentFit?: 'contain' | 'cover';
  transition?: number;
  accessibilityLabel?: string;
};

/**
 * Image that never crashes on missing/bad URIs — shows a soft tile fallback.
 */
export function SafeImage({
  uri,
  style,
  containerStyle,
  contentFit = 'contain',
  transition = 200,
  accessibilityLabel,
}: Props) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  const usable = trimmed.length > 0 && !failed;

  const onError = useCallback(() => {
    setFailed(true);
    logInvalidRender('safe_image', { uri: trimmed.slice(0, 120) }, { reason: 'onError' });
  }, [trimmed]);

  if (!usable) {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: wardrobeTileBackground(isDark) },
          style as StyleProp<ViewStyle>,
          containerStyle,
        ]}
        accessibilityLabel={accessibilityLabel || 'Image unavailable'}
      >
        <Feather
          name="image"
          size={22}
          color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)'}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: trimmed }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      onError={onError}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
