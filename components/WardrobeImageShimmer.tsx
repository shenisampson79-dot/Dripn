import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  style?: StyleProp<ViewStyle>;
  backgroundColor: string;
  isDark?: boolean;
};

export function WardrobeImageShimmer({ style, backgroundColor, isDark = false }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 160],
  });

  const shimmerStops = isDark
    ? (['transparent', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.04)', 'transparent'] as const)
    : (['transparent', 'rgba(0,0,0,0.025)', 'rgba(0,0,0,0.045)', 'rgba(0,0,0,0.025)', 'transparent'] as const);

  const flat = StyleSheet.flatten(style);

  return (
    <View style={[styles.root, { backgroundColor }, flat]}>
      <Animated.View style={[styles.shimmerTrack, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[...shimmerStops]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  shimmerTrack: {
    ...StyleSheet.absoluteFill,
    width: '200%',
  },
  shimmerGradient: {
    flex: 1,
  },
});
