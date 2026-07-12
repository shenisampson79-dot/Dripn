import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

interface BodyScanFigureProps {
  /** Stroke / accent color. Hex preferred for filled variant. */
  color?: string;
  /** Figure height in px. Width scales from the viewBox aspect ratio. */
  size?: number;
  /**
   * `guide` — translucent outline for camera framing (default).
   * `filled` — solid figure with scanner brackets.
   */
  variant?: "guide" | "filled";
  style?: StyleProp<ViewStyle>;
}

/**
 * Gender-neutral full-body front silhouette (mild A-pose).
 *
 * ViewBox 120 × 305, center x = 60. Path is mirrored about the centerline.
 * Matches scanner reference: oval head, sloping shoulders, ~15° arms with
 * mitten hands, gentle hourglass, clear crotch V, knee/calf articulation,
 * feet angled slightly outward.
 */
export function BodyScanFigure({
  color = "#FFFFFF",
  size = 360,
  variant = "guide",
  style,
}: BodyScanFigureProps) {
  const width = size * (120 / 305);
  const isGuide = variant === "guide";

  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const hasRgb = Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b);

  const stroke = isGuide
    ? "rgba(255,255,255,0.9)"
    : hasRgb
      ? `rgba(${r},${g},${b},0.88)`
      : color;
  const bracket = isGuide
    ? "rgba(255,255,255,0.45)"
    : hasRgb
      ? `rgba(${r},${g},${b},0.28)`
      : "rgba(255,255,255,0.28)";
  // Guide stays see-through so the camera feed remains visible inside the outline.
  const fill = isGuide ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.95)";

  /**
   * Single closed path — continuous silhouette (no disconnected limbs).
   * Cubic Béziers at neck, shoulders, waist, knees, calves, and ankles.
   * Right half then exact mirror for left (x' = 120 − x).
   */
  const bodyPath = [
    "M 60,4",
    // Head (smooth oval, ~1/7.5–1/8 height)
    "C 73,4 81,13.5 81,28.5",
    "C 81,39 76.5,46.5 71,50.5",
    // Short, relatively thick neck → rounded sloping shoulder
    "C 68.5,53 67.5,56.5 67,61",
    "C 67,67 70.5,72.5 78.5,75",
    "C 88.5,77.5 97.5,82.5 103.5,91.5",
    // Right outer arm (~15° from torso)
    "C 108.5,98.5 111.5,109 112.5,122",
    "C 113.5,133 112.5,142 109.5,148.5",
    // Right mitten hand — rounded fingers, distinct thumb toward body
    "C 107.5,154 103,157.5 98,158",
    "C 94,158.5 90,156.5 88.5,152.5",
    "C 87,148.5 89.5,144.5 92.5,142",
    // Right inner arm → armpit
    "C 95,133 94.5,122 92.5,110",
    "C 90.5,98.5 87,90 82.5,85.5",
    // Right torso: waist taper → hip flare
    "C 81,96 80,108 78.5,120",
    "C 77,131 76.5,141 78,151",
    "C 79.5,160 82.5,169 85,180",
    // Right outer leg: thigh → knee narrow → calf → ankle
    "C 87.5,196 88.5,210 86,225",
    "C 83.5,238 82.5,248 83.5,260",
    "C 84.5,270 84,278 81.5,284",
    // Right foot — compact, angled slightly outward
    "C 80,288.5 84,293.5 92,296.5",
    "C 97,298.5 102,297.5 104,294.5",
    "C 105.5,292 104.5,288.5 101.5,286.5",
    "C 97,284.5 90,283.5 84,283",
    "C 80,282.5 77,280.5 75,277.5",
    // Right inner leg → crotch V
    "C 73,267 72,255 71,242",
    "C 70,228 69,214 67.5,200",
    "C 66,186 64.5,172 63,161",
    "C 62,155.5 61,152.5 60,152.5",
    // Left inner leg (mirror)
    "C 59,152.5 58,155.5 57,161",
    "C 55.5,172 54,186 52.5,200",
    "C 51,214 50,228 49,242",
    "C 48,255 47,267 45,277.5",
    // Left foot (mirror)
    "C 43,280.5 40,282.5 36,283",
    "C 30,283.5 23,284.5 18.5,286.5",
    "C 15.5,288.5 14.5,292 16,294.5",
    "C 18,297.5 23,298.5 28,296.5",
    "C 36,293.5 40,288.5 39,284",
    // Left outer leg (mirror)
    "C 36,278 35.5,270 36.5,260",
    "C 37.5,248 36.5,238 34,225",
    "C 31.5,210 32.5,196 35,180",
    // Left hip → waist → torso (mirror)
    "C 37.5,169 40.5,160 42,151",
    "C 43.5,141 43,131 41.5,120",
    "C 40,108 39,96 37.5,85.5",
    // Left armpit → inner arm → mitten hand (mirror)
    "C 33,90 29.5,98.5 27.5,110",
    "C 25.5,122 25,133 27.5,142",
    "C 30.5,144.5 33,148.5 31.5,152.5",
    "C 30,156.5 26,158.5 22,158",
    "C 17,157.5 12.5,154 10.5,148.5",
    // Left outer arm → shoulder (mirror)
    "C 7.5,142 6.5,133 7.5,122",
    "C 8.5,109 11.5,98.5 16.5,91.5",
    "C 22.5,82.5 31.5,77.5 41.5,75",
    "C 49.5,72.5 53,67 53,61",
    // Left neck → head close (mirror)
    "C 52.5,56.5 51.5,53 49,50.5",
    "C 43.5,46.5 39,39 39,28.5",
    "C 39,13.5 47,4 60,4",
    "Z",
  ].join(" ");

  return (
    <View style={[{ alignItems: "center" }, style]} pointerEvents="none">
      <Svg width={width} height={size} viewBox="0 0 120 305">
        <Path
          d="M 3,3 L 3,20 M 3,3 L 20,3"
          fill="none"
          stroke={bracket}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path
          d="M 117,3 L 117,20 M 117,3 L 100,3"
          fill="none"
          stroke={bracket}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path
          d="M 3,302 L 3,285 M 3,302 L 20,302"
          fill="none"
          stroke={bracket}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path
          d="M 117,302 L 117,285 M 117,302 L 100,302"
          fill="none"
          stroke={bracket}
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <Path
          d={bodyPath}
          fill={fill}
          stroke={stroke}
          strokeWidth={isGuide ? 2.4 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
