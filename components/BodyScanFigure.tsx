import React from "react";
import { View } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";

interface BodyScanFigureProps {
  color: string;
  size?: number;
}

/**
 * A clean body outline illustration matching the reference Vecteezy style:
 * - Separate closed shapes for each body part (head, neck, torso, arms, legs)
 * - White fill so shapes layer cleanly over each other
 * - Themed dark stroke
 * - Realistic proportions (not fashion-elongated)
 * - Arms visibly separated from the torso with a clear gap
 *
 * ViewBox: 110 × 305
 * Center x = 55
 *
 * Key widths:
 *   Head:          34px  (x=38..72)
 *   Neck:          16px  (x=47..63) at top, 18px at base
 *   Torso chest:   58px  (x=26..84)  ← arms are at x=7..18 and x=92..103
 *   Arm gap:        8px  between arm inner edge and torso side
 *   Arm width:     11px
 *   Waist:         50px  (x=30..80)
 *   Hip:           56px  (x=27..83)
 *   Each leg:      18px
 *   Crotch gap:    18px  (x=46..64)
 */
export function BodyScanFigure({ color, size = 260 }: BodyScanFigureProps) {
  // Parse the hex color so we can vary opacity per element
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 50;
  const g = parseInt(hex.substring(2, 4), 16) || 30;
  const b = parseInt(hex.substring(4, 6), 16) || 10;

  const stroke = `rgba(${r},${g},${b},0.88)`;
  const fill   = "rgba(255,255,255,0.95)"; // near-white so shapes layer cleanly
  const br     = `rgba(${r},${g},${b},0.28)`;
  const sw     = 2.2; // stroke width

  const svgW = size * (110 / 305);
  const svgH = size;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={svgW} height={svgH} viewBox="0 0 110 305">

        {/* ── SCANNER CORNER BRACKETS ── */}
        <Path d="M 5,5 L 5,22 M 5,5 L 22,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,5 L 105,22 M 105,5 L 88,5"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 5,300 L 5,283 M 5,300 L 22,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M 105,300 L 105,283 M 105,300 L 88,300"
          fill="none" stroke={br} strokeWidth="1.6" strokeLinecap="round" />

        {/*
         * Drawing order matters — later shapes appear ON TOP.
         * Order: legs → torso → arms → neck → head
         * Each white-filled shape occludes whatever is behind it.
         */}

        {/* ── LEFT LEG + FOOT ──
            Left leg: outer (left side) x≈29, inner (right side) x≈46
            Width ≈ 17px. Foot extends to the left.
        */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 46,204
            C 45,222 44,244 43,264
            C 43,276 43,287 44,295
            L 43,300
            C 38,302 30,302 20,300
            C 14,298 10,294 10,290
            C 10,286 13,285 18,285
            C 24,285 28,283 29,280
            C 29,270 29,258 29,244
            C 29,226 29,210 29,205
            Z
          `}
        />

        {/* ── RIGHT LEG + FOOT (mirror) ── */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 64,204
            C 65,222 66,244 67,264
            C 67,276 67,287 66,295
            L 67,300
            C 72,302 80,302 90,300
            C 96,298 100,294 100,290
            C 100,286 97,285 92,285
            C 86,285 82,283 81,280
            C 81,270 81,258 81,244
            C 81,226 81,210 81,205
            Z
          `}
        />

        {/* ── TORSO: shoulders down to crotch ──
            Shoulder top: x=28..82 at y=58
            Chest:        x=26..84 at y=88 (slightly wider)
            Waist:        x=30..80 at y=150 (subtle narrowing only)
            Hip:          x=27..83 at y=180
            Crotch inner: x=46 and x=64, bottom of the inverted-V gap
        */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 28,58
            C 26,72 25,86 26,100
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
            C 45,51 36,53 28,58
            Z
          `}
        />

        {/* ── LEFT ARM ──
            Inner (right edge, facing torso): x≈18  → 8px gap from torso left (x≈26)
            Outer (left edge):                x≈7
            Width: ~11px
        */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 18,62
            C 17,80 16,106 16,132
            C 15,152 15,172 14,190
            C 14,204 13,214 13,222
            C 13,228 13,234 15,238
            C 16,241 18,242 20,242
            C 22,242 24,240 25,236
            C 26,232 26,226 26,220
            C 26,210 25,198 25,184
            C 25,166 25,146 25,124
            C 25,100 25,78 25,62
            C 23,60 21,60 18,62
            Z
          `}
        />

        {/* ── RIGHT ARM (mirror of left) ── */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
          d={`
            M 92,62
            C 93,80 94,106 94,132
            C 95,152 95,172 96,190
            C 96,204 97,214 97,222
            C 97,228 97,234 95,238
            C 94,241 92,242 90,242
            C 88,242 86,240 85,236
            C 84,232 84,226 84,220
            C 84,210 85,198 85,184
            C 85,166 85,146 85,124
            C 85,100 85,78 85,62
            C 87,60 89,60 92,62
            Z
          `}
        />

        {/* ── NECK ── */}
        <Path
          fill={fill} stroke={stroke} strokeWidth={sw}
          d={`
            M 49,38
            C 48,44 47,50 47,56
            L 63,56
            C 63,50 62,44 61,38
            Z
          `}
        />

        {/* ── HEAD ── */}
        <Ellipse
          cx="55" cy="20" rx="17" ry="19"
          fill={fill} stroke={stroke} strokeWidth={sw}
        />

        {/* ── EAR BUMPS ── */}
        <Path d="M 38,17 C 36,20 36,23 38,26"
          fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M 72,17 C 74,20 74,23 72,26"
          fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* ── COLLARBONE / NECKLINE ── */}
        <Path d="M 47,58 Q 55,64 63,58"
          fill="none" stroke={`rgba(${r},${g},${b},0.3)`} strokeWidth="1.2" />

      </Svg>
    </View>
  );
}
