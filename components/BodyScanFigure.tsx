import React from "react";
import { View } from "react-native";
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle } from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

export function BodyScanFigure({ color, size = 260 }: BodyScanFigureProps) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  // Portrait viewBox: 110 wide × 315 tall
  const vW = 110;
  const vH = 315;
  const svgW = size * (vW / vH);
  const svgH = size;

  const strokeColor = rgba(0.8);
  const bracketColor = rgba(0.35);
  const guideColor = rgba(0.15);
  const accentDot = rgba(0.4);

  /*
   * One continuous clockwise path tracing the full body outline,
   * matching the reference illustration style:
   *
   * Top of head → right head → right jaw → right neck →
   * right shoulder slope out → RIGHT ARM outer (down) →
   * right hand (curve around bottom) → RIGHT ARM inner (up) →
   * right armpit notch (concave, back toward body) →
   * RIGHT TORSO (down: chest → waist → hip) →
   * RIGHT LEG outer (down) → right foot (around bottom) →
   * RIGHT LEG inner (up) → crotch gap (across to left) →
   * LEFT LEG inner (down) → left foot → LEFT LEG outer (up) →
   * LEFT TORSO (up: hip → waist → chest) →
   * left armpit notch → LEFT ARM inner (down) →
   * left hand → LEFT ARM outer (up) →
   * left shoulder → left neck → left head → close
   *
   * Key widths in the 110px viewBox (realistic proportions):
   *   Head:          38px  (x=36..74)
   *   Neck:          16px  (x=47..63)
   *   Shoulder peak: 76px  (x=17..93)
   *   Arm width:     15px
   *   Chest:         44px  (x=33..77, between arm inner edges)
   *   Waist:         36px  (x=37..73)
   *   Hip:           50px  (x=30..80)
   *   Each leg:      20px
   *   Leg gap:       10px  (x=45..65)
   */
  const bodyPath = `
    M 55,4

    C 66,3 74,11 74,24
    C 74,31 72,35 70,39
    C 69,42 67,46 65,50

    C 64,54 63,58 63,63
    C 63,65 65,67 70,68

    C 78,65 87,64 93,70
    C 97,75 97,83 96,91

    C 96,110 96,132 95,154
    C 95,170 94,183 93,196
    C 92,203 90,210 88,216

    C 87,221 86,225 84,227
    C 82,229 80,227 79,224
    C 78,221 78,216 78,210
    C 78,203 79,196 80,190

    C 80,176 81,161 81,145
    C 81,128 81,108 80,93
    C 80,86 79,81 77,79

    C 74,77 70,77 68,79
    C 66,82 65,88 65,100

    C 65,117 65,134 66,150
    C 67,161 70,171 74,179
    C 78,187 80,196 80,208

    C 80,222 80,240 79,256
    C 78,268 76,279 74,288
    C 73,294 72,300 72,304

    C 73,308 77,312 85,312
    C 88,311 89,307 87,305
    C 84,305 78,305 72,305
    C 66,305 63,306 61,307

    C 59,305 59,300 60,294
    C 61,284 63,272 64,258
    C 65,244 66,230 67,218
    C 68,211 68,208 68,207

    C 68,210 62,212 55,212
    C 48,212 42,210 42,207

    C 42,208 42,211 43,218
    C 44,230 45,244 46,258
    C 47,272 49,284 50,294
    C 51,300 51,305 49,307

    C 47,306 44,305 38,305
    C 32,305 26,305 23,305
    C 21,307 22,311 25,312
    C 33,312 37,308 38,304

    C 38,300 37,294 36,288
    C 34,279 32,268 31,256
    C 30,240 30,222 30,208

    C 30,196 32,187 36,179
    C 40,171 43,161 44,150
    C 45,134 45,117 45,100

    C 45,88 44,82 42,79
    C 40,77 36,77 33,79
    C 31,81 30,86 30,93

    C 29,108 29,128 29,145
    C 29,161 30,176 30,190
    C 31,196 32,203 32,210
    C 32,216 32,221 31,224
    C 30,227 28,229 26,227
    C 24,225 23,221 22,216

    C 20,210 18,203 17,196
    C 16,183 15,170 15,154
    C 14,132 14,110 14,91

    C 13,83 13,75 17,70
    C 23,64 32,65 40,68
    C 45,67 47,65 47,63

    C 47,58 46,54 45,50
    C 43,46 41,42 40,39
    C 38,35 36,31 36,24
    C 36,11 44,3 55,4
    Z
  `;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgW} height={svgH} viewBox={`0 0 ${vW} ${vH}`}>
        <Defs>
          <LinearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={rgba(0.1)} />
            <Stop offset="0.6" stopColor={rgba(0.07)} />
            <Stop offset="1" stopColor={rgba(0.03)} />
          </LinearGradient>
        </Defs>

        {/* ── SCANNER CORNER BRACKETS ── */}
        <Path d="M 4,4 L 4,20 M 4,4 L 20,4"
          fill="none" stroke={bracketColor} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 106,4 L 106,20 M 106,4 L 90,4"
          fill="none" stroke={bracketColor} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 4,311 L 4,295 M 4,311 L 20,311"
          fill="none" stroke={bracketColor} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 106,311 L 106,295 M 106,311 L 90,311"
          fill="none" stroke={bracketColor} strokeWidth="1.6" strokeLinecap="round" />

        {/* ── BODY SILHOUETTE ── */}
        <Path
          d={bodyPath}
          fill="url(#fg)"
          stroke={strokeColor}
          strokeWidth="1.9"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* ── COLLARBONE LINE ── */}
        <Path d="M 47,68 Q 55,74 63,68"
          fill="none" stroke={rgba(0.2)} strokeWidth="1" />

        {/* ── MEASUREMENT GUIDES ── */}
        <Line x1="7" y1="68" x2="103" y2="68"
          stroke={guideColor} strokeWidth="0.5" strokeDasharray="2,5" />
        <Line x1="26" y1="150" x2="84" y2="150"
          stroke={guideColor} strokeWidth="0.5" strokeDasharray="2,5" />
        <Line x1="22" y1="180" x2="88" y2="180"
          stroke={guideColor} strokeWidth="0.5" strokeDasharray="2,5" />
        <Line x1="26" y1="258" x2="84" y2="258"
          stroke={guideColor} strokeWidth="0.5" strokeDasharray="2,5" />

        {/* Guide tick marks */}
        <Line x1="52" y1="68" x2="58" y2="68" stroke={accentDot} strokeWidth="1" />
        <Line x1="52" y1="150" x2="58" y2="150" stroke={accentDot} strokeWidth="1" />
        <Line x1="52" y1="180" x2="58" y2="180" stroke={accentDot} strokeWidth="1" />
        <Line x1="52" y1="258" x2="58" y2="258" stroke={accentDot} strokeWidth="1" />

        {/* ── SHOULDER DOTS ── */}
        <Circle cx="25" cy="72" r="1.8" fill={accentDot} />
        <Circle cx="85" cy="72" r="1.8" fill={accentDot} />

        {/* ── WAIST DOT ── */}
        <Circle cx="55" cy="150" r="2" fill={accentDot} />

      </Svg>
    </View>
  );
}
