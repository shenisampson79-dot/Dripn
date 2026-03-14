import React from "react";
import { View } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

export function BodyScanFigure({ color, size = 260 }: BodyScanFigureProps) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 50;
  const g = parseInt(hex.substring(2, 4), 16) || 30;
  const b = parseInt(hex.substring(4, 6), 16) || 10;

  const stroke = `rgba(${r},${g},${b},0.88)`;
  const fill   = "rgba(255,255,255,0.95)";
  const br     = `rgba(${r},${g},${b},0.28)`;
  const sw     = 2.2;

  const svgW = size * (110 / 305);
  const svgH = size;

  /*
   * Reference proportions (all y in 0..305, x in 0..110, center x=55):
   *
   *   Head top:     y=2    Head bottom: y=39   Head width: 34px (x=38..72)
   *   Neck:         y=39..57   16px wide
   *   Shoulder/torso top: y=57
   *   Torso chest:  x=26..84  (58px)    ← wide enough for realistic shoulders
   *   Torso waist:  x=30..80  (50px)    ← subtle narrowing only
   *   Torso hip:    x=27..83  (56px)
   *   Crotch:       y=205     inner legs x=46 and x=64
   *
   *   Arms: inner edge 6px gap from torso side
   *     Left inner (right side of arm): x=20    torso left: x=26  → gap=6px
   *     Left outer (left side of arm):  x=9
   *     Arm wrist bottom: y=213 (wrist at crotch level, matching reference)
   *
   *   Legs: each 18px wide, 18px crotch gap
   *     Left:  outer x=29, inner x=46
   *     Right: inner x=64, outer x=81
   */

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgW} height={svgH} viewBox="0 0 110 305">

        {/* SCANNER BRACKETS */}
        <Path d="M 5,5 L 5,22 M 5,5 L 22,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,5 L 105,22 M 105,5 L 88,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 5,300 L 5,283 M 5,300 L 22,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,300 L 105,283 M 105,300 L 88,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />

        {/* Draw order: legs → torso → arms → neck → head (each white fill occludes what's behind) */}

        {/* LEFT LEG + FOOT
            Outer (left side) x=29, inner (right side) x=46, width=17px
            Foot extends to the left at the base  */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 46,204 C 45,222 44,244 44,264 C 43,276 43,287 44,295 L 43,300
            C 38,302 30,302 20,300 C 14,298 10,294 10,290
            C 10,286 13,285 18,285 C 24,285 28,283 29,280
            C 29,270 29,258 29,244 C 29,226 29,210 29,205 Z
          `}
        />

        {/* RIGHT LEG + FOOT (mirror) */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 64,204 C 65,222 66,244 66,264 C 67,276 67,287 66,295 L 67,300
            C 72,302 80,302 90,300 C 96,298 100,294 100,290
            C 100,286 97,285 92,285 C 86,285 82,283 81,280
            C 81,270 81,258 81,244 C 81,226 81,210 81,205 Z
          `}
        />

        {/* TORSO: shoulders to crotch */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 28,58 C 26,72 25,86 26,100
            C 26,118 28,136 30,150
            C 30,162 28,172 27,182
            C 28,192 37,202 46,206
            C 50,208 53,209 55,209
            C 57,209 60,208 64,206
            C 73,202 82,192 83,182
            C 82,172 80,162 80,150
            C 82,136 84,118 84,100
            C 85,86 84,72 82,58
            C 74,53 65,51 55,51
            C 45,51 36,53 28,58 Z
          `}
        />

        {/* LEFT ARM
            Inner (right side, facing body) x=20  →  6px gap from torso left (x≈26)
            Outer (left side) x=9
            Width = 11px
            Wrist bottom y=213  (at crotch level, matching reference image) */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 20,60
            C 20,78 20,100 20,124
            C 20,144 20,162 20,178
            C 20,190 20,200 20,207
            C 20,210 19,213 17,213
            L 13,213
            C 11,213 10,210 10,207
            C 10,200 10,190 10,178
            C 10,162 10,144 10,124
            C 10,100 10,78 10,60
            C 12,58 15,57 17,57
            C 18,57 19,58 20,60 Z
          `}
        />

        {/* RIGHT ARM (mirror: x → 110-x) */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 90,60
            C 90,78 90,100 90,124
            C 90,144 90,162 90,178
            C 90,190 90,200 90,207
            C 90,210 91,213 93,213
            L 97,213
            C 99,213 100,210 100,207
            C 100,200 100,190 100,178
            C 100,162 100,144 100,124
            C 100,100 100,78 100,60
            C 98,58 95,57 93,57
            C 92,57 91,58 90,60 Z
          `}
        />

        {/* NECK */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw}
          d="M 49,39 C 48,45 47,51 47,57 L 63,57 C 63,51 62,45 61,39 Z"
        />

        {/* HEAD */}
        <Ellipse cx="55" cy="21" rx="17" ry="19"
          fill={fill} stroke={stroke} strokeWidth={sw} />

        {/* EAR BUMPS */}
        <Path d="M 38,18 C 36,21 36,24 38,27"
          fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M 72,18 C 74,21 74,24 72,27"
          fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* COLLARBONE */}
        <Path d="M 47,58 Q 55,65 63,58"
          fill="none" stroke={`rgba(${r},${g},${b},0.3)`} strokeWidth="1.2" />

      </Svg>
    </View>
  );
}
