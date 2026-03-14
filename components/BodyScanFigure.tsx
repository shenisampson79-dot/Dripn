import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

/**
 * Single continuous clockwise path tracing the full body outline:
 *   top-of-head → right side of head → right neck → right shoulder slope →
 *   right arm outer (DOWN) → right hand → right arm inner (UP) →
 *   right armpit notch (concave) → right body side (DOWN) →
 *   right outer leg (DOWN) → right foot → right inner leg (UP) →
 *   crotch crossing → left inner leg (DOWN) → left foot →
 *   left outer leg (UP) → left body (UP) → left armpit notch →
 *   left arm inner (DOWN) → left hand → left arm outer (UP) →
 *   left shoulder slope → left neck → left head → close
 *
 * ViewBox 110 × 305 (portrait). Center x = 55.
 * White fill + dark themed stroke = clean outline matching reference.
 *
 * Proportions verified against reference:
 *   Crotch/wrist y ≈ 57% of height = 174
 *   Knee         y ≈ 72%           = 220
 *   Ankle        y ≈ 88%           = 269
 *   Shoulder     y ≈ 19%           = 58
 *   Arm gap from body: ~9px
 *   Crotch gap between legs: ~16px
 */
export function BodyScanFigure({ color, size = 260 }: BodyScanFigureProps) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 50;
  const g = parseInt(hex.substring(2, 4), 16) || 30;
  const b = parseInt(hex.substring(4, 6), 16) || 10;
  const stroke = `rgba(${r},${g},${b},0.88)`;
  const br = `rgba(${r},${g},${b},0.28)`;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg
        width={size * (110 / 305)}
        height={size}
        viewBox="0 0 110 305"
      >
        {/* SCANNER BRACKETS */}
        <Path d="M 5,5 L 5,22 M 5,5 L 22,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,5 L 105,22 M 105,5 L 88,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 5,300 L 5,283 M 5,300 L 22,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,300 L 105,283 M 105,300 L 88,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />

        {/* BODY OUTLINE — single continuous path */}
        <Path
          fill="rgba(255,255,255,0.95)"
          stroke={stroke}
          strokeWidth="2.0"
          strokeLinejoin="round"
          strokeLinecap="round"
          d={`
            M 55,3

            C 67,3 74,12 74,26
            C 74,32 72,36 70,40
            C 68,44 64,48 62,54
            C 60,58 59,64 61,70
            C 68,68 80,65 92,69
            C 100,73 105,81 105,92
            C 105,108 105,130 104,152
            C 104,164 102,174 100,179
            C 98,183 96,186 94,186
            L 92,186
            C 90,186 89,183 89,179
            C 89,166 89,148 89,130
            C 89,114 89,98 89,86
            C 87,78 84,72 80,72
            C 78,72 77,74 77,80
            C 77,92 78,110 78,130
            C 78,148 78,162 80,170
            C 82,175 82,178 80,180
            C 79,192 78,210 77,228
            C 76,244 74,258 72,270
            C 71,276 71,282 72,288
            C 74,294 78,297 84,297
            C 90,297 94,295 96,291
            C 96,287 94,285 90,285
            C 84,285 78,285 70,285
            C 67,285 65,281 64,275
            C 63,263 63,249 63,233
            C 63,219 63,207 63,196
            C 63,186 63,178 63,173
            C 61,170 58,168 55,168
            C 52,168 49,170 47,173
            C 47,178 47,186 47,196
            C 47,207 47,219 47,233
            C 47,249 47,263 46,275
            C 45,281 43,285 40,285
            C 32,285 26,285 20,285
            C 16,285 14,287 14,291
            C 16,295 20,297 26,297
            C 32,297 36,294 38,288
            C 39,282 39,276 38,270
            C 36,258 34,244 33,228
            C 32,210 31,192 30,180
            C 28,178 28,175 30,170
            C 32,162 32,148 32,130
            C 32,110 33,92 33,80
            C 33,74 32,72 30,72
            C 26,72 23,78 21,86
            C 21,98 21,114 21,130
            C 21,148 21,166 21,179
            C 19,183 18,186 16,186
            L 14,186
            C 12,186 10,183 10,179
            C 8,174 6,164 5,152
            C 5,130 5,108 5,92
            C 5,81 10,73 18,69
            C 30,65 42,68 49,70
            C 51,64 51,58 50,54
            C 48,48 44,44 42,40
            C 40,36 36,32 36,26
            C 36,12 43,3 55,3
            Z
          `}
        />
      </Svg>
    </View>
  );
}
