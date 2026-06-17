import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, ImageStyle, View, ViewStyle } from 'react-native';
import { Image, ImageSource } from 'expo-image';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { apiService } from '@/services/ApiService';
import {
  isProxyWardrobeImageUri,
  resolveWardrobeFallbackUri,
  resolveWardrobeImageUri,
  wardrobeImageContentFit,
} from '@/utils/wardrobeImage';

function useAuthenticatedImageSource(uri: string): {
  source: ImageSource | null;
  ready: boolean;
} {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!uri) {
        if (mounted) {
          setSource(null);
          setReady(true);
        }
        return;
      }

      const needsAuth = isProxyWardrobeImageUri(uri);
      if (!needsAuth) {
        if (mounted) {
          setSource({ uri });
          setReady(true);
        }
        return;
      }

      const token = await apiService.getToken();
      if (!mounted) return;
      setSource(
        token
          ? { uri, headers: { Authorization: `Bearer ${token}` } }
          : null,
      );
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [uri]);

  return { source, ready };
}

type Props = {
  item: Pick<
    WardrobeItem,
    'id' | 'imageUri' | 'enhancedImageUri' | 'originalImageUri' | 'imageProcessed' | 'aiAnalyzed'
  >;
  style?: StyleProp<ImageStyle>;
  processed?: boolean;
  contentFit?: 'contain' | 'cover';
  transition?: number;
  preferCover?: boolean;
  showLoading?: boolean;
};

export function WardrobeItemImage({
  item,
  style,
  processed,
  contentFit,
  transition = 200,
  preferCover = false,
  showLoading = false,
}: Props) {
  const primaryUri = resolveWardrobeImageUri(item);
  const fallbackUri = resolveWardrobeFallbackUri(item, primaryUri);
  const [activeUri, setActiveUri] = useState(primaryUri);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    setActiveUri(primaryUri);
    setUsingFallback(false);
  }, [primaryUri]);

  const handleError = useCallback(() => {
    if (!usingFallback && fallbackUri) {
      setUsingFallback(true);
      setActiveUri(fallbackUri);
    }
  }, [fallbackUri, usingFallback]);

  const { source, ready } = useAuthenticatedImageSource(activeUri || '');

  if (!activeUri) return null;

  if (!ready || !source) {
    if (!showLoading) return null;
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style}
      contentFit={
        contentFit ?? wardrobeImageContentFit(item, usingFallback, preferCover)
      }
      transition={transition}
      onError={handleError}
      recyclingKey={`${activeUri}:${usingFallback ? 'fb' : 'primary'}`}
      cachePolicy={activeUri.startsWith('http') ? 'memory-disk' : undefined}
    />
  );
}

export function WardrobeItemImageFrame({
  children,
  backgroundColor,
  style,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[style, backgroundColor ? { backgroundColor } : null]}>
      {children}
    </View>
  );
}
