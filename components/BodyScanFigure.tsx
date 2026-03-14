import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

/**
 * Single-path human body outline.
 *
 * Proportions calibrated to the Vecteezy reference (IMG_4847):
 *
 *   ViewBox 110 × 305, center x = 55
 *
 *   y landmarks (% of 305):
 *     Head top    y=3   (1%)
 *     Head btm    y=40  (13%)
 *     Neck btm    y=57  (19%)
 *     Armpit      y=75  (25%)
 *     Wrist       y=192 (63%)  ← slightly below crotch, matches ref
 *     Crotch      y=174 (57%)
 *     Knee        y=222 (73%)
 *     Ankle       y=268 (88%)
 *     Foot btm    y=299 (98%)
 *
 *   x landmarks:
 *     Body left/right at chest:  x=30  /  x=80   (50px = 45% wide)
 *     Body left/right at waist:  x=34  /  x=76   (42px — slight narrowing)
 *     Body left/right at hip:    x=30  /  x=80   (50px)
 *
 *     Right arm outer: x=95   hangs straight down
 *     Right arm inner: x=84   gap from body right (80) = 4px
 *     Left arm inner:  x=26   gap from body left (30) = 4px
 *     Left arm outer:  x=15   arm width = 11px each side
 *
 *     Crotch inner legs: left x=46, right x=64   gap = 18px
 *     Leg outer:        left x=30, right x=80   width = 16px each
 */
export function BodyScanFigure({ color, size = 260 }: BodyScanFigureProps) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 50;
  const g = parseInt(hex.substring(2, 4), 16) || 30;
  const b = parseInt(hex.substring(4, 6), 16) || 10;
  const stroke = `rgba(${r},${g},${b},0.88)`;
  const br     = `rgba(${r},${g},${b},0.28)`;

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

        {/*
         * BODY — one clockwise closed path.
         *
         * Sequence:
         *   head-top → R-head → R-neck → R-shoulder-slope →
         *   R-arm-outer↓ → R-hand → R-arm-inner↑ →
         *   R-armpit-notch → R-body↓ →
         *   R-leg-outer↓ → R-foot → R-leg-inner↑ →
         *   crotch-crossing →
         *   L-leg-inner↓ → L-foot → L-leg-outer↑ →
         *   L-body↑ → L-armpit-notch →
         *   L-arm-inner↓ → L-hand → L-arm-outer↑ →
         *   L-shoulder-slope → L-neck → L-head → Z
         */}
        <Path
          fill="rgba(255,255,255,0.95)"
          stroke={stroke}
          strokeWidth="2.1"
          strokeLinejoin="round"
          strokeLinecap="round"
          d={`
            M 55,3

            C 67,3  74,12 74,26
            C 74,32 72,36 70,40
            C 68,44 64,48 62,53
            C 60,57 60,63 62,70
            C 70,67 85,63 95,67
            C 97,70 96,76 95,84
            C 95,100 95,124 95,148
            C 95,164 95,178 95,192
            C 95,197 93,200 91,200
            L 88,200
            C 86,200 84,197 84,192
            C 84,178 84,162 84,144
            C 84,124 84,104 84,84
            C 84,76 82,70 80,70
            C 80,72 80,76 80,84
            C 80,100 80,120 80,140
            C 80,158 80,170 80,180
            C 80,192 80,200 80,208
            C 80,218 79,232 78,246
            C 77,258 75,268 73,276
            C 72,282 72,288 73,293
            C 75,297 79,300 85,300
            C 91,300 95,298 96,293
            C 96,289 94,287 90,287
            C 84,287 78,287 70,287
            C 67,287 65,281 64,271
            C 63,259 63,245 63,231
            C 63,217 63,201 63,191
            C 63,183 63,176 63,174
            C 61,170 58,168 55,168
            C 52,168 49,170 47,174
            C 47,176 47,183 47,191
            C 47,201 47,217 47,231
            C 47,245 46,259 44,271
            C 43,281 40,287 37,287
            C 29,287 23,287 16,287
            C 12,287 10,289 10,293
            C 11,298 15,300 21,300
            C 27,300 31,297 33,293
            C 34,288 34,282 33,276
            C 31,268 29,258 28,246
            C 27,232 26,218 26,208
            C 26,200 26,192 26,180
            C 26,170 26,158 26,140
            C 26,120 26,100 26,84
            C 26,76 26,72 26,70
            C 24,70 22,76 22,84
            C 22,104 22,124 22,144
            C 22,162 22,178 22,192
            C 22,197 20,200 18,200
            L 15,200
            C 13,200 11,197 11,192
            C 11,178 11,164 11,148
            C 11,124 11,100 11,84
            C 10,76 9,70 13,67
            C 23,63 38,67 46,70
            C 48,63 48,57 47,53
            C 45,48 42,44 40,40
            C 38,36 36,32 36,26
            C 36,12 43,3  55,3
            Z
          `}
        />
      </Svg>
    </View>
  );
}
