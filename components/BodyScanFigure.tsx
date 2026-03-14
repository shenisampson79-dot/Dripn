import React from "react";
import { View, StyleSheet } from "react-native";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

export function BodyScanFigure({ color, size = 190 }: BodyScanFigureProps) {
  const scale = size / 190;
  const fill = color + "1A";
  const stroke = color;
  const glow = color + "22";

  const s = (v: number) => Math.round(v * scale);

  return (
    <View style={[styles.wrapper, { width: s(130), height: s(230) }]}>
      {/* Ambient glow */}
      <View
        style={[
          styles.glow,
          {
            width: s(100),
            height: s(210),
            backgroundColor: glow,
            borderRadius: s(50),
            shadowColor: color,
          },
        ]}
      />

      {/* HEAD */}
      <View
        style={[
          styles.head,
          {
            width: s(38),
            height: s(42),
            borderRadius: s(21),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(6),
            left: s(46),
          },
        ]}
      />

      {/* NECK */}
      <View
        style={[
          styles.neck,
          {
            width: s(13),
            height: s(12),
            backgroundColor: fill,
            borderLeftColor: stroke,
            borderRightColor: stroke,
            borderLeftWidth: 1.5,
            borderRightWidth: 1.5,
            top: s(46),
            left: s(58),
          },
        ]}
      />

      {/* SHOULDERS */}
      <View
        style={[
          styles.shoulders,
          {
            width: s(88),
            height: s(18),
            backgroundColor: fill,
            borderColor: stroke,
            borderBottomWidth: 0,
            borderTopLeftRadius: s(16),
            borderTopRightRadius: s(16),
            top: s(56),
            left: s(21),
          },
        ]}
      />

      {/* LEFT ARM */}
      <View
        style={[
          styles.arm,
          {
            width: s(15),
            height: s(78),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(62),
            left: s(16),
            borderRadius: s(8),
            transform: [{ rotate: "8deg" }],
          },
        ]}
      />

      {/* RIGHT ARM */}
      <View
        style={[
          styles.arm,
          {
            width: s(15),
            height: s(78),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(62),
            right: s(16),
            borderRadius: s(8),
            transform: [{ rotate: "-8deg" }],
          },
        ]}
      />

      {/* TORSO */}
      <View
        style={[
          styles.torso,
          {
            width: s(58),
            height: s(72),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(71),
            left: s(36),
            borderTopLeftRadius: s(3),
            borderTopRightRadius: s(3),
            borderBottomLeftRadius: s(10),
            borderBottomRightRadius: s(10),
          },
        ]}
      />

      {/* WAIST SEAM */}
      <View
        style={[
          styles.waistSeam,
          {
            width: s(54),
            top: s(118),
            left: s(38),
            borderBottomColor: stroke + "55",
          },
        ]}
      />

      {/* HIPS */}
      <View
        style={[
          styles.hips,
          {
            width: s(68),
            height: s(22),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(138),
            left: s(31),
            borderRadius: s(8),
          },
        ]}
      />

      {/* LEFT LEG */}
      <View
        style={[
          styles.leg,
          {
            width: s(24),
            height: s(58),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(156),
            left: s(31),
            borderRadius: s(8),
          },
        ]}
      />

      {/* RIGHT LEG */}
      <View
        style={[
          styles.leg,
          {
            width: s(24),
            height: s(58),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(156),
            right: s(31),
            borderRadius: s(8),
          },
        ]}
      />

      {/* LEFT FOOT */}
      <View
        style={[
          styles.foot,
          {
            width: s(22),
            height: s(10),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(208),
            left: s(29),
            borderRadius: s(5),
          },
        ]}
      />

      {/* RIGHT FOOT */}
      <View
        style={[
          styles.foot,
          {
            width: s(22),
            height: s(10),
            backgroundColor: fill,
            borderColor: stroke,
            top: s(208),
            right: s(29),
            borderRadius: s(5),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 4,
  },
  head: {
    position: "absolute",
    borderWidth: 1.5,
  },
  neck: {
    position: "absolute",
  },
  shoulders: {
    position: "absolute",
    borderWidth: 1.5,
  },
  arm: {
    position: "absolute",
    borderWidth: 1.5,
  },
  torso: {
    position: "absolute",
    borderWidth: 1.5,
  },
  waistSeam: {
    position: "absolute",
    borderBottomWidth: 1,
  },
  hips: {
    position: "absolute",
    borderWidth: 1.5,
  },
  leg: {
    position: "absolute",
    borderWidth: 1.5,
  },
  foot: {
    position: "absolute",
    borderWidth: 1.5,
  },
});
