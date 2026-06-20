import React, { useEffect } from "react";
import { Platform, StyleProp, View, ViewStyle, StyleSheet } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

type LoopingBackgroundVideoProps = {
  source: number;
  style?: StyleProp<ViewStyle>;
};

const configureBackgroundPlayer = (videoPlayer: { loop: boolean; muted: boolean; play: () => void }) => {
  videoPlayer.loop = true;
  videoPlayer.muted = true;
  videoPlayer.play();
};

function LoopingBackgroundVideoWeb({ source }: { source: number }) {
  const foregroundPlayer = useVideoPlayer(source, configureBackgroundPlayer);
  const backdropPlayer = useVideoPlayer(source, configureBackgroundPlayer);

  useEffect(() => {
    const retry = setTimeout(() => {
      foregroundPlayer.play();
      backdropPlayer.play();
    }, 500);
    return () => clearTimeout(retry);
  }, [foregroundPlayer, backdropPlayer]);

  return (
    <View style={styles.webContainer} pointerEvents="none">
      <VideoView
        player={backdropPlayer}
        style={styles.webBackdropVideo}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        playsInline
      />
      <VideoView
        player={foregroundPlayer}
        style={styles.webForegroundVideo}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        playsInline
      />
    </View>
  );
}

function LoopingBackgroundVideoNative({
  source,
  style,
}: {
  source: number;
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(source, configureBackgroundPlayer);

  return (
    <View style={[styles.container, style ?? StyleSheet.absoluteFillObject]} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        playsInline
      />
    </View>
  );
}

export function LoopingBackgroundVideo({ source, style }: LoopingBackgroundVideoProps) {
  if (Platform.OS === "web") {
    return <LoopingBackgroundVideoWeb source={source} />;
  }
  return <LoopingBackgroundVideoNative source={source} style={style} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webContainer: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 0,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  webBackdropVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: [{ scale: 1.12 }],
    filter: "blur(32px) saturate(1.15) brightness(0.72)",
  } as ViewStyle,
  webForegroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center center",
    zIndex: 1,
  } as ViewStyle,
});
