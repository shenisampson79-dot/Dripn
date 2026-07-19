/**
 * Build splash-icon.png matching LoadingScreen branding (title + logo + tagline).
 * Run: node scripts/build-splash-icon.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets/images/splash-icon.png');
const BACKUP = path.join(ROOT, 'assets/images/splash-icon.backup.png');
const LOGO = path.join(ROOT, 'assets/images/dripn-logo-icon.png');

// Portrait iPhone canvas; matches expo-splash-screen plugin backgroundColor
const WIDTH = 1242;
const HEIGHT = 2436;
const BG = '#FFF9F0';
const TITLE_COLOR = '#11181C';
const TAGLINE_COLOR = '#687076';
const TAGLINE = 'Style that flows';

// LoadingScreen.tsx @ ~390pt logical width → scale for 1242px canvas
const SCALE = WIDTH / 390;
const TITLE_SIZE = Math.round(42 * SCALE);
const LOGO_SIZE = Math.round(180 * SCALE);
const TAGLINE_SIZE = Math.round(18 * SCALE);
const GAP_TITLE_LOGO = Math.round(20 * SCALE); // Spacing.xl below title
const GAP_LOGO_TAGLINE = Math.round((16 + 20) * SCALE); // logo marginVertical lg + tagline marginTop xl
const TITLE_TRACKING = Math.round(2 * SCALE);
const TAGLINE_TRACKING = Math.round(1 * SCALE);

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTextSvg({ width, height, titleY, taglineY }) {
  const fontStack =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="50%"
    y="${titleY}"
    text-anchor="middle"
    font-family="${fontStack}"
    font-size="${TITLE_SIZE}"
    font-weight="700"
    letter-spacing="${TITLE_TRACKING}"
    fill="${TITLE_COLOR}"
  >Dripn</text>
  <text
    x="50%"
    y="${taglineY}"
    text-anchor="middle"
    font-family="${fontStack}"
    font-size="${TAGLINE_SIZE}"
    font-weight="400"
    font-style="italic"
    letter-spacing="${TAGLINE_TRACKING}"
    fill="${TAGLINE_COLOR}"
  >${escapeXml(TAGLINE)}</text>
</svg>`);
}

async function main() {
  const logoMeta = await sharp(LOGO).metadata();
  console.log(`Logo: ${path.basename(LOGO)} ${logoMeta.width}x${logoMeta.height}`);

  const titleLine = Math.round(TITLE_SIZE * 1.15);
  const taglineLine = Math.round(TAGLINE_SIZE * 1.2);
  const blockHeight = titleLine + GAP_TITLE_LOGO + LOGO_SIZE + GAP_LOGO_TAGLINE + taglineLine;
  const blockTop = Math.round((HEIGHT - blockHeight) / 2);

  const titleY = blockTop + Math.round(TITLE_SIZE * 0.92);
  const logoTop = blockTop + titleLine + GAP_TITLE_LOGO;
  const taglineY = logoTop + LOGO_SIZE + GAP_LOGO_TAGLINE + Math.round(TAGLINE_SIZE * 0.85);
  const logoLeft = Math.round((WIDTH - LOGO_SIZE) / 2);

  const logo = await sharp(LOGO)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: BG })
    .png()
    .toBuffer();

  const textLayer = buildTextSvg({ width: WIDTH, height: HEIGHT, titleY, taglineY });

  const splash = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: BG,
    },
  })
    .composite([
      { input: textLayer, top: 0, left: 0 },
      { input: logo, top: logoTop, left: logoLeft },
    ])
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toBuffer();

  if (fs.existsSync(OUT)) {
    fs.copyFileSync(OUT, BACKUP);
    console.log(`Backed up previous → ${path.basename(BACKUP)}`);
  }

  fs.writeFileSync(OUT, splash);
  const outMeta = await sharp(splash).metadata();
  const sizeKB = Math.round(splash.length / 1024);
  console.log(
    `Wrote ${path.basename(OUT)}: ${outMeta.width}x${outMeta.height}, alpha=${outMeta.hasAlpha}, ${sizeKB} KB`,
  );
  console.log(`Layout: titleY=${titleY}, logo=${logoLeft},${logoTop} ${LOGO_SIZE}px, taglineY=${taglineY}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
