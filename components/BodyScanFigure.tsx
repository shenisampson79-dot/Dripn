import React from "react";
import { View } from "react-native";
import Svg, {
  Path,
  Ellipse,
  Line,
  Defs,
  LinearGradient,
  Stop,
  G,
  Circle,
  Rect,
} from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

export function BodyScanFigure({ color, size = 200 }: BodyScanFigureProps) {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  // ViewBox: 110 × 310
  const vW = 110;
  const vH = 310;
  const svgW = size * (vW / vH);
  const svgH = size;

  const stroke = rgba(0.82);
  const fillBody = rgba(0.08);
  const fillArm = rgba(0.06);
  const guide = rgba(0.18);
  const accent = rgba(0.45);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgW} height={svgH} viewBox={`0 0 ${vW} ${vH}`}>
        <Defs>
          <LinearGradient id="bd" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={rgba(0.13)} />
            <Stop offset="0.5" stopColor={rgba(0.08)} />
            <Stop offset="1" stopColor={rgba(0.03)} />
          </LinearGradient>
          <LinearGradient id="am" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={rgba(0.09)} />
            <Stop offset="1" stopColor={rgba(0.03)} />
          </LinearGradient>
          <LinearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={rgba(0.09)} />
            <Stop offset="1" stopColor={rgba(0.02)} />
          </LinearGradient>
        </Defs>

        {/* ─── SCANNER CORNER BRACKETS ─── */}
        <Path d="M 4,4 L 4,18 M 4,4 L 18,4"
          fill="none" stroke={rgba(0.32)} strokeWidth="1.4" strokeLinecap="round" />
        <Path d="M 106,4 L 106,18 M 106,4 L 92,4"
          fill="none" stroke={rgba(0.32)} strokeWidth="1.4" strokeLinecap="round" />
        <Path d="M 4,306 L 4,292 M 4,306 L 18,306"
          fill="none" stroke={rgba(0.32)} strokeWidth="1.4" strokeLinecap="round" />
        <Path d="M 106,306 L 106,292 M 106,306 L 92,306"
          fill="none" stroke={rgba(0.32)} strokeWidth="1.4" strokeLinecap="round" />

        {/* ─── CENTRE AXIS ─── */}
        <Line x1="55" y1="40" x2="55" y2="295"
          stroke={rgba(0.08)} strokeWidth="0.6" strokeDasharray="2,6" />

        {/* ─── HORIZONTAL MEASUREMENT GUIDES ─── */}
        {/* Shoulder */}
        <Line x1="10" y1="76" x2="100" y2="76"
          stroke={guide} strokeWidth="0.5" strokeDasharray="2,5" />
        {/* Waist */}
        <Line x1="32" y1="152" x2="78" y2="152"
          stroke={guide} strokeWidth="0.5" strokeDasharray="2,5" />
        {/* Hip */}
        <Line x1="22" y1="180" x2="88" y2="180"
          stroke={guide} strokeWidth="0.5" strokeDasharray="2,5" />
        {/* Knee */}
        <Line x1="30" y1="242" x2="80" y2="242"
          stroke={guide} strokeWidth="0.5" strokeDasharray="2,5" />

        {/* Tick marks on centre axis */}
        <Line x1="52" y1="76" x2="58" y2="76" stroke={accent} strokeWidth="1" />
        <Line x1="52" y1="152" x2="58" y2="152" stroke={accent} strokeWidth="1" />
        <Line x1="52" y1="180" x2="58" y2="180" stroke={accent} strokeWidth="1" />
        <Line x1="52" y1="242" x2="58" y2="242" stroke={accent} strokeWidth="1" />

        {/* ─── LEFT ARM
              Hangs from the shoulder, sweeps gently outward,
              then straight down. Width ≈12px.
              The arm top (y=70) begins near the shoulder joint.
              The arm's rightmost edge (x≈34) leaves a clear ~8px
              gap from the body's left edge (x≈42) below the shoulder.
        ─── */}
        <Path
          d={`
            M 34,68
            C 30,76 22,108 19,140
            C 17,162 17,176 18,188
            C 19,194 20,197 21,199
            L 30,199
            C 30,197 30,194 30,188
            C 30,176 30,162 31,140
            C 32,108 34,76 36,68
            Z
          `}
          fill="url(#am)"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* ─── RIGHT ARM (mirror) ─── */}
        <Path
          d={`
            M 76,68
            C 74,76 78,108 79,140
            C 80,162 80,176 80,188
            C 80,194 80,197 80,199
            L 89,199
            C 90,197 91,194 92,188
            C 93,176 93,162 91,140
            C 88,108 80,76 76,68
            Z
          `}
          fill="url(#am)"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* ─── TORSO + HIPS
              Body path starts at shoulder joints (where arms attach).
              Narrows clearly at waist (x=40 → x=70).
              Flares at hips (x=24 → x=86).
              The side edges are well clear of the arms at all heights.
        ─── */}
        <Path
          d={`
            M 36,66
            C 42,60 48,57 55,57
            C 62,57 68,60 74,66
            C 76,70 76,74 74,78
            C 71,82 67,84 63,86
            C 60,96 59,116 60,136
            C 61,148 63,156 66,162
            C 70,168 74,174 76,182
            C 78,188 77,198 74,206
            C 68,210 62,212 55,212
            C 48,212 42,210 36,206
            C 33,198 32,188 34,182
            C 36,174 40,168 44,162
            C 47,156 49,148 50,136
            C 51,116 50,96 47,86
            C 43,84 39,82 36,78
            C 34,74 34,70 36,66
            Z
          `}
          fill="url(#bd)"
          stroke={stroke}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />

        {/* Collarbone subtle lines */}
        <Path d="M 47,65 Q 52,70 55,72 Q 58,70 63,65"
          fill="none" stroke={rgba(0.22)} strokeWidth="0.9" />

        {/* Waist seam hint */}
        <Path d="M 43,155 Q 55,158 67,155"
          fill="none" stroke={rgba(0.15)} strokeWidth="0.8" />

        {/* ─── LEFT LEG ─── */}
        <Path
          d={`
            M 32,210
            C 30,218 28,232 28,248
            C 28,262 29,274 31,282
            C 33,288 36,293 38,296
            L 50,296
            C 52,293 54,288 54,282
            C 55,274 55,262 54,248
            C 53,232 51,218 50,210
            Z
          `}
          fill="url(#lg)"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* ─── RIGHT LEG ─── */}
        <Path
          d={`
            M 60,210
            C 59,218 57,232 57,248
            C 57,262 57,274 59,282
            C 61,288 63,293 64,296
            L 76,296
            C 78,293 80,288 80,282
            C 81,274 82,262 81,248
            C 80,232 78,218 77,210
            Z
          `}
          fill="url(#lg)"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Knee highlights — subtle oval */}
        <Ellipse cx="41" cy="244" rx="7" ry="5"
          fill="none" stroke={rgba(0.16)} strokeWidth="0.9" />
        <Ellipse cx="69" cy="244" rx="7" ry="5"
          fill="none" stroke={rgba(0.16)} strokeWidth="0.9" />

        {/* ─── NECK ─── */}
        <Path
          d={`
            M 50,38
            C 49,44 48,50 48,56
            L 62,56
            C 62,50 61,44 60,38
            Z
          `}
          fill={rgba(0.1)}
          stroke={stroke}
          strokeWidth="1.2"
        />

        {/* ─── HEAD ─── */}
        <Ellipse cx="55" cy="22" rx="15" ry="17"
          fill={rgba(0.1)} stroke={stroke} strokeWidth="1.4" />

        {/* Ear details */}
        <Path d="M 40,19 Q 38,22 40,25"
          fill="none" stroke={rgba(0.28)} strokeWidth="1" strokeLinecap="round" />
        <Path d="M 70,19 Q 72,22 70,25"
          fill="none" stroke={rgba(0.28)} strokeWidth="1" strokeLinecap="round" />

        {/* ─── SHOULDER JOINT ACCENT DOTS ─── */}
        <Circle cx="36" cy="68" r="2.2" fill={rgba(0.5)} />
        <Circle cx="74" cy="68" r="2.2" fill={rgba(0.5)} />

        {/* ─── WAIST CENTRE DOT ─── */}
        <Circle cx="55" cy="152" r="2.4" fill={rgba(0.38)} />

        {/* ─── HEIGHT RULER – left side, fine dots ─── */}
        {[76, 114, 152, 180, 212, 242, 275].map((y, i) => (
          <Circle key={i} cx="8" cy={y} r="1.2" fill={rgba(0.22)} />
        ))}

      </Svg>
    </View>
  );
}
