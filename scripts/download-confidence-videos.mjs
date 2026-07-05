/**
 * Downloads Mixkit confidence/onboarding payoff clips (Mixkit Free License).
 * Run: node scripts/download-confidence-videos.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../assets/videos/confidence");

/** @type {{ filename: string; mixkitId: number; title: string }[]} */
const CLIPS = [
  { filename: "conf_female_walking_street_night.mp4", mixkitId: 1227, title: "Urban trendy girl walking to the camera" },
  { filename: "conf_female_neon_sign.mp4", mixkitId: 1230, title: "Woman in front of a neon sign" },
  { filename: "conf_female_fashion_bar.mp4", mixkitId: 1234, title: "Chilling in a funky bar at night" },
  { filename: "conf_female_night_portrait.mp4", mixkitId: 1231, title: "Urban trendy girl's portrait at night" },
  { filename: "conf_female_neon_peek.mp4", mixkitId: 1232, title: "Girl in neon sign" },
  { filename: "conf_female_sports_car.mp4", mixkitId: 44557, title: "Stylish woman inside a sports car" },
  { filename: "conf_female_camaro_lean.mp4", mixkitId: 44556, title: "Stylish woman leaning in a Camaro" },
  { filename: "conf_male_blue_portrait.mp4", mixkitId: 1239, title: "Urban trendy man's portrait with blue background" },
  { filename: "conf_male_denim_pose.mp4", mixkitId: 1236, title: "Urban trendy man posing with pink filter" },
  { filename: "conf_male_neon_lights.mp4", mixkitId: 1237, title: "Man under multicolored lights" },
  { filename: "conf_male_denim_neon.mp4", mixkitId: 1238, title: "Man holding neon light" },
  { filename: "conf_male_mirror_reflection.mp4", mixkitId: 34538, title: "Reflection of a man in broken mirror" },
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const attributionLines = [
    "# Confidence onboarding videos",
    "",
    "Sourced from [Mixkit](https://mixkit.co/) under the [Mixkit Free License](https://mixkit.co/license/) (commercial use allowed).",
    "",
    "| File | Mixkit ID | Title |",
    "| --- | --- | --- |",
  ];

  for (const clip of CLIPS) {
    const url = `https://assets.mixkit.co/videos/${clip.mixkitId}/${clip.mixkitId}-720.mp4`;
    const dest = join(OUT_DIR, clip.filename);
    process.stdout.write(`Downloading ${clip.filename}... `);
    try {
      await download(url, dest);
      console.log("ok");
      attributionLines.push(`| ${clip.filename} | ${clip.mixkitId} | ${clip.title} |`);
    } catch (err) {
      console.log("FAILED", err.message);
    }
  }

  await writeFile(
    join(__dirname, "../assets/videos/ATTRIBUTION.md"),
    attributionLines.join("\n") + "\n",
    "utf8"
  );
  console.log("\nDone. See assets/videos/ATTRIBUTION.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
