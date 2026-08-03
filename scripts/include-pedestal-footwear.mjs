/**
 * Include styled pedestal / stand-base footwear in Oxford + Sloane outfit labels.
 *
 * Shop windows often style torso-only mannequins with shoes on the stand base
 * or a pedestal beside the look — those shoes ARE part of the outfit.
 *
 * Usage:
 *   node scripts/include-pedestal-footwear.mjs          # apply
 *   node scripts/include-pedestal-footwear.mjs --dry     # report only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry');

const COLOR_RE =
  '(?:white|black|brown|cream|beige|navy|grey|gray|tan|olive|charcoal|silver|gold|bronze|maroon|burgundy|pink|red|blue|green|camel|taupe|khaki|ivory|dark|light[- ]?blue|dark[- ]?brown|multi)';

const TYPE_MAP = [
  [/mary[\s-]?janes?/i, 'mary_janes'],
  [/fisherman\s+sandals?/i, 'sandals'],
  [/strappy\s+sandals?/i, 'sandals'],
  [/heeled\s+sandals?/i, 'sandals'],
  [/thong\s+sandals?/i, 'sandals'],
  [/slide\s+sandals?/i, 'sandals'],
  [/two[- ]strap\s+sandals?/i, 'sandals'],
  [/woven\s+sandals?/i, 'sandals'],
  [/boat\s+shoes?/i, 'boat_shoes'],
  [/deck\s+shoes?/i, 'boat_shoes'],
  [/chunky\s+(?:lace[- ]?ups?|derbys?)/i, 'derby'],
  [/chunky\s+sneakers?/i, 'sneakers'],
  [/running\s+sneakers?/i, 'sneakers'],
  [/new\s+balance|nb\s*\d+/i, 'sneakers'],
  [/canvas\s+sneakers?/i, 'sneakers'],
  [/low[- ]?top\s+sneakers?/i, 'sneakers'],
  [/athletic\s+sneakers?/i, 'sneakers'],
  [/pointed\s+(?:pumps?|shoes?|flats?)/i, 'pumps'],
  [/ankle\s+boots?/i, 'boots'],
  [/chelsea\s+boots?/i, 'chelsea_boots'],
  [/chukka\s+boots?/i, 'boots'],
  [/desert\s+boots?/i, 'boots'],
  [/combat\s+boots?/i, 'boots'],
  [/square[- ]?toe\s+ankle\s+boots?/i, 'boots'],
  [/studded\s+loafers?/i, 'loafers'],
  [/bit\s+loafers?/i, 'loafers'],
  [/tassel\s+loafers?/i, 'loafers'],
  [/suede\s+loafers?/i, 'loafers'],
  [/spectator\s+loafers?/i, 'loafers'],
  [/flip[- ]?flops?/i, 'flip_flops'],
  [/espadrilles?/i, 'espadrilles'],
  [/clogs?/i, 'clogs'],
  [/mules?/i, 'mules'],
  [/slides?/i, 'slides'],
  [/pumps?/i, 'pumps'],
  [/heels?/i, 'heels'],
  [/sandals?/i, 'sandals'],
  [/loafers?/i, 'loafers'],
  [/oxfords?/i, 'oxfords'],
  [/derbys?/i, 'derby'],
  [/brogues?/i, 'oxfords'],
  [/sneakers?/i, 'sneakers'],
  [/trainers?/i, 'sneakers'],
  [/boots?/i, 'boots'],
  [/flats?/i, 'flats'],
  [/dress\s+shoes?/i, 'oxfords'],
  [/lace[- ]?ups?/i, 'derby'],
  [/\bshoes?\b/i, 'shoes'],
];

const SKIP_RE =
  /no footwear|barefoot with shoes on separate|on separate pedestals?|pedestal ignored|ignored for footwear|shoes behind so footwear null|brogues and boots|boots and .*loafers|on floor so footwear null|hanging .*footwear null|product[- ]only|no footwear on (the )?(stand|mannequin|primary)|not visible/i;

const INCLUDE_LOC =
  /on (?:a |the )?(?:wooden |metal |silver |clear |marble |raised |stone |OSB |SALE |circular |flat |dark |thin |grey |gray |floral |floor |glass )?(?:pedestal|stand base|baseplate|base plate|base|stand|platform)|at (?:the )?feet|under (?:the )?hem|stand base/i;

function normalizeColor(raw) {
  if (!raw) return 'unknown';
  let c = String(raw).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (c === 'grey') c = 'gray';
  if (c === 'dark' || c === 'dark_brown') c = 'brown';
  if (c === 'light') c = 'unknown';
  if (c === 'multi') c = 'multicolor';
  return c;
}

function mapType(fragment) {
  for (const [re, sub] of TYPE_MAP) {
    if (re.test(fragment)) return sub;
  }
  return null;
}

function extractFootwear(notes) {
  const text = String(notes || '');
  if (!text.trim()) return { status: 'skip', reason: 'empty_notes' };
  if (SKIP_RE.test(text) && !INCLUDE_LOC.test(text)) {
    return { status: 'skip', reason: 'explicit_no_or_separate' };
  }
  // Still skip clear "no footwear" even if pedestal mentioned for bags
  if (/\bno footwear\b/i.test(text) && !/(sandal|loafer|sneaker|boot|mule|heel|flat|clog|shoe|pump|trainer|brogue|derby|oxford|flip)/i.test(text)) {
    return { status: 'skip', reason: 'no_footwear_literal' };
  }
  if (/\bno footwear on (the )?(stand|mannequin|primary)/i.test(text)) {
    return { status: 'skip', reason: 'no_footwear_on_stand' };
  }
  if (/barefoot with shoes on separate/i.test(text)) {
    return { status: 'skip', reason: 'separate_display_shoes' };
  }
  if (/brogues and boots|boots and (?:spectator )?loafers|boots and .* on floor/i.test(text)) {
    return { status: 'uncertain', reason: 'multiple_shoe_types' };
  }

  // Prefer clause that ties shoes to pedestal/stand/base
  const clauseRe = new RegExp(
    `((?:${COLOR_RE})(?:[\\/\\-](?:${COLOR_RE}))?(?:\\s+[\\w'-]+){0,4}?\\s+)?` +
      `((?:mary[\\s-]?janes?|fisherman\\s+sandals?|strappy\\s+sandals?|heeled\\s+sandals?|thong\\s+sandals?|` +
      `boat\\s+shoes?|deck\\s+shoes?|chunky\\s+(?:lace[- ]?ups?|derbys?|sneakers?)|new\\s+balance(?:\\s+\\d+)?|` +
      `pointed\\s+(?:pumps?|shoes?|flats?)|ankle\\s+boots?|chelsea\\s+boots?|chukka\\s+boots?|desert\\s+boots?|` +
      `studded\\s+loafers?|suede\\s+loafers?|tassel\\s+loafers?|bit\\s+loafers?|canvas\\s+sneakers?|` +
      `flip[- ]?flops?|espadrilles?|clogs?|mules?|slides?|pumps?|heels?|sandals?|loafers?|oxfords?|derbys?|` +
      `brogues?|sneakers?|trainers?|boots?|flats?|dress\\s+shoes?|lace[- ]?ups?|shoes?))` +
      `(?:\\s+(?:with\\s+[\\w\\s/-]+?)?)?` +
      `\\s+on\\s+(?:a\\s+|the\\s+)?(?:wooden\\s+|metal\\s+|silver\\s+|clear\\s+|marble\\s+|raised\\s+|stone\\s+|` +
      `OSB\\s+|SALE\\s+|circular\\s+|flat\\s+|dark\\s+|thin\\s+|grey\\s+|gray\\s+|floral\\s+|floor\\s+|glass\\s+|` +
      `black\\s+|white\\s+)?` +
      `(?:pedestal|stand\\s+base|baseplate|base\\s+plate|base|stand|platform)`,
    'i',
  );

  let m = text.match(clauseRe);
  if (!m) {
    // Softer: color + type … pedestal/footwear null
    const soft = text.match(
      new RegExp(
        `(${COLOR_RE})(?:[\\/\\-](${COLOR_RE}))?(?:\\s+[\\w'-]+){0,3}\\s+` +
          `(mary[\\s-]?janes?|strappy\\s+sandals?|heeled\\s+sandals?|boat\\s+shoes?|ankle\\s+boots?|` +
          `chunky\\s+(?:sneakers?|lace[- ]?ups?)|pointed\\s+(?:pumps?|shoes?|flats?)|` +
          `sandals?|loafers?|sneakers?|trainers?|boots?|mules?|clogs?|flats?|pumps?|heels?|slides?|shoes?)` +
          `[^.;]{0,40}(?:pedestal|stand\\s+base|footwear\\s+null|base\\s+so)`,
        'i',
      ),
    );
    if (!soft) {
      if (INCLUDE_LOC.test(text) && /(sandal|loafer|sneaker|boot|mule|heel|flat|clog|shoe|pump|trainer)/i.test(text)) {
        return { status: 'uncertain', reason: 'pedestal_mentioned_unparsed' };
      }
      return { status: 'skip', reason: 'no_match' };
    }
    const color = normalizeColor(soft[1]);
    const sub = mapType(soft[3] || soft[0]);
    if (!sub || sub === 'shoes') return { status: 'uncertain', reason: 'vague_type', raw: soft[0] };
    if (color === 'unknown') return { status: 'uncertain', reason: 'missing_color', raw: soft[0] };
    return {
      status: 'apply',
      footwear: { category: 'shoes', subcategory: sub, color },
      evidence: soft[0].slice(0, 120),
    };
  }

  const frag = m[0];
  const colorMatch = frag.match(new RegExp(`^(${COLOR_RE})`, 'i'));
  const color = normalizeColor(colorMatch ? colorMatch[1] : null);
  const sub = mapType(m[2] || frag);
  if (!sub) return { status: 'uncertain', reason: 'unmapped_type', raw: frag };
  if (sub === 'shoes' || color === 'unknown') {
    return { status: 'uncertain', reason: sub === 'shoes' ? 'generic_shoes' : 'missing_color', raw: frag };
  }

  return {
    status: 'apply',
    footwear: {
      category: 'shoes',
      subcategory: sub,
      color,
    },
    evidence: frag.slice(0, 140),
  };
}

function paletteFromOutfit(outfit) {
  const colors = new Set();
  for (const piece of Object.values(outfit || {})) {
    if (piece?.color) colors.add(piece.color);
  }
  return [...colors];
}

function rewriteNotes(notes, footwear) {
  let next = String(notes || '');
  next = next.replace(/\s*so footwear null\b/gi, '');
  next = next.replace(/\s*;?\s*footwear null\b/gi, '');
  next = next.replace(/\s*not on feet\b/gi, '');
  const label = `${footwear.color} ${footwear.subcategory}`.replace(/_/g, ' ');
  if (!/styled pedestal footwear|included as outfit footwear/i.test(next)) {
    next = `${next.replace(/\.\s*$/, '')}; ${label} included as styled pedestal/stand footwear`.trim();
  }
  return next;
}

function processDataset(relPath, street) {
  const file = path.join(root, relPath);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = { street, applied: [], uncertain: [], skipped: [] };

  for (const row of rows) {
    if (row.rules?.valid === false) continue;
    if (row.outfit?.footwear) continue;
    const result = extractFootwear(row.notes);
    if (result.status === 'apply') {
      report.applied.push({ id: row.id, footwear: result.footwear, evidence: result.evidence });
      if (!dry) {
        row.outfit.footwear = result.footwear;
        row.notes = rewriteNotes(row.notes, result.footwear);
        row.colour_palette = paletteFromOutfit(row.outfit);
        row.label_status = row.label_status || 'gold';
        row.confidence = Math.max(Number(row.confidence) || 0.8, 0.82);
      }
    } else if (result.status === 'uncertain') {
      report.uncertain.push({ id: row.id, reason: result.reason, notes: String(row.notes || '').slice(0, 160) });
    } else {
      report.skipped.push({ id: row.id, reason: result.reason });
    }
  }

  if (!dry) {
    fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }
  return report;
}

function buildReviewPatch(report) {
  // Flag uncertain as must-fix for reviewer; applied become ok notes
  return {
    generated_at: new Date().toISOString(),
    policy: 'Styled pedestal/stand footwear is part of the outfit (torso mannequins included).',
    applied_count: report.applied.length,
    uncertain_count: report.uncertain.length,
    applied: report.applied,
    uncertain: report.uncertain.map((u) => ({
      id: u.id,
      status: 'uncertain',
      notes: `Pedestal footwear policy: ${u.reason}. Check photo and add the stand/pedestal shoes that belong with this look.`,
    })),
  };
}

const oxford = processDataset('data/oxford_street_dataset/dataset.json', 'oxford');
const sloane = processDataset('data/sloane_street_dataset/dataset.json', 'sloane');

const outDir = path.join(root, 'data/street_label_reviews');
const summary = {
  dry,
  policy:
    'Include footwear placed on the mannequin stand base or a pedestal styled with that outfit. Do not require shoes to be on feet.',
  oxford: {
    applied: oxford.applied.length,
    uncertain: oxford.uncertain.length,
    skipped_null_rows: oxford.skipped.length,
  },
  sloane: {
    applied: sloane.applied.length,
    uncertain: sloane.uncertain.length,
    skipped_null_rows: sloane.skipped.length,
  },
  oxford_detail: buildReviewPatch(oxford),
  sloane_detail: buildReviewPatch(sloane),
};

const summaryPath = path.join(outDir, 'pedestal_footwear_report.json');
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(dry ? 'DRY RUN' : 'APPLIED');
console.log('Oxford applied:', oxford.applied.length, 'uncertain:', oxford.uncertain.length);
console.log('Sloane applied:', sloane.applied.length, 'uncertain:', sloane.uncertain.length);
console.log('Report:', summaryPath);
if (oxford.applied[0]) console.log('Example:', oxford.applied[0]);
