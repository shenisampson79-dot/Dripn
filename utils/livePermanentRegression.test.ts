/**
 * Permanent Live launch gate (L1–L6).
 * L2/L3 timings are simulated (fake clock). Device 3.5s / 5s is not required in CI.
 *
 * Run: npm run test:live-regression
 *  or: npm run verify:live-regression
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import { renderCopyFromPublishedTruth } from '@/utils/livePublishedCopy';
import {
  LIVE_CUSTOMER_BOXES_ENABLED,
  LIVE_YOLO_ENABLED,
  customerBoxesFromPublishedTruth,
  detectionsForCustomerPaint,
  liveCloudPathBlockedByYoloProof,
  mapYoloBoxesOntoPublishedTruth,
  sanitizeLiveUserHudText,
  yoloWouldOverwritePublishedIdentity,
} from '@/utils/livePublishedIdentity';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';
import { encodeRgbaToJpegBase64 } from '@/utils/liveFrameBuffer';
import {
  createLiveScoreGate,
  gateLiveScore,
  isHighConfidenceCompleteCloudRead,
  presentLiveScore,
  shouldHoldLivePublishedCopy,
} from '@/utils/liveScoreStability';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LABEL = {
  L1: 'L1 Hermes JPEG ........',
  L2: 'L2 Cloud start ........',
  L3: 'L3 First score ........',
  L4: 'L4 Score persistence ..',
  L5: 'L5 YOLO isolation .....',
  L6: 'L6 Customer BBoxes ....',
} as const;

type Level = keyof typeof LABEL;
const result: Record<Level, { ok: boolean; extra?: string; err?: string }> = {
  L1: { ok: false },
  L2: { ok: false },
  L3: { ok: false },
  L4: { ok: false },
  L5: { ok: false },
  L6: { ok: false },
};

const NODE_BUFFER_RE =
  /Buffer\.from\s*\(|\bglobal\.Buffer\b|\brequire\(\s*['"]buffer['"]\s*\)/;
const CUSTOMER_LEAK_RE =
  /\bYOLO\b|\bNMS\b|skin_overlap|filtered_to_zero|\bBuffer\b|REJECT\s*:|shoes_skin_roi|YOLO_PROVEN|guard=/i;
const CUSTOMER_BBOX_TESTID_RE =
  /testID\s*=\s*\{?\s*['"`][^'"`]*bbox/i;

const SIG_SHORTS = 't-shirt|athletic_shorts';
const SIG_CHALLENGER = 't-shirt|trousers|boots';

function item(
  name: string,
  category: string,
  subcategory: string,
  bbox: [number, number, number, number],
): LiveTruthItem {
  return {
    name,
    category,
    subcategory,
    color: 'black',
    confidence: 0.93,
    stability: 0.7,
    bbox,
  };
}

function cloudTruth(score: number | null): LiveOutfitTruth {
  return {
    top: item('Black T-Shirt', 'tops', 't-shirt', [0.25, 0.12, 0.4, 0.28]),
    layer: null,
    bottom: item('Black Athletic Shorts', 'bottoms', 'athletic_shorts', [0.28, 0.42, 0.38, 0.22]),
    footwear: null,
    lane: 'athleisure',
    score,
    hasConflict: false,
    isStable: false,
    confidenceLevel: 'high',
    signature: SIG_SHORTS,
    timestamp: 4800,
    seedDetections: [],
  };
}

function yolo(
  name: string,
  bbox: [number, number, number, number],
  extra: Partial<OnDeviceDetection> = {},
): OnDeviceDetection {
  return {
    name,
    category: extra.category || 'tops',
    subcategory: extra.subcategory || 'clothing',
    confidence: extra.confidence ?? 0.9,
    bbox,
    ...extra,
  };
}

const HORRIBLE_YOLO: OnDeviceDetection[] = [
  yolo('Maxi dress PASS', [0.2, 0.08, 0.5, 0.78], {
    category: 'dresses',
    subcategory: 'maxi_dress',
  }),
  yolo('Trousers REJECT:skin_overlap 0.50>0.4 (0.26)', [0.25, 0.4, 0.4, 0.45], {
    category: 'bottoms',
    subcategory: 'trousers',
  }),
  yolo('Black boots shoes_skin_roi', [0.34, 0.82, 0.28, 0.14], {
    category: 'shoes',
    subcategory: 'boots',
  }),
];

function liveClientSources(): string[] {
  const files: string[] = [
    join(ROOT, 'screens', 'LiveStylistScreen.tsx'),
    join(ROOT, 'utils', 'vendor', 'jpegEncoderUint8.js'),
  ];
  for (const name of readdirSync(join(ROOT, 'utils'))) {
    if (/^live.*\.(ts|js)$/.test(name) && !/\.test\./.test(name)) {
      files.push(join(ROOT, 'utils', name));
    }
  }
  const liveUi = join(ROOT, 'components', 'live');
  if (existsSync(liveUi)) {
    for (const name of readdirSync(liveUi)) {
      if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        files.push(join(liveUi, name));
      }
    }
  }
  return files;
}

function jpegByteLength(b64: string): number {
  if (!b64) return 0;
  return globalThis.atob(b64).length;
}

function neverBlanked(history: Array<number | null>): boolean {
  const first = history.findIndex((n) => n != null);
  if (first < 0) return false;
  for (let i = first; i < history.length; i++) {
    if (history[i] == null) return false;
  }
  for (let i = 0; i < history.length - 2; i++) {
    if (history[i] === 78 && history[i + 1] == null && history[i + 2] === 78) return false;
  }
  return true;
}

function runLevel(level: Level, fn: () => string | void) {
  try {
    const extra = fn();
    result[level] = { ok: true, extra: extra || undefined };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    result[level] = { ok: false, err };
    console.error(`FAIL  ${level}`);
    console.error(e);
  }
}

// ── L1 Hermes-safe JPEG (actual Live encoder) ──────────────────
runLevel('L1', () => {
  for (const file of liveClientSources()) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      src,
      NODE_BUFFER_RE,
      `Live client must not use Node Buffer (${file})`,
    );
  }

  const g = globalThis as typeof globalThis & { Buffer?: unknown };
  const hadBuffer = Object.prototype.hasOwnProperty.call(g, 'Buffer');
  const previousBuffer = g.Buffer;
  delete g.Buffer;
  try {
    assert.equal(typeof g.Buffer, 'undefined');
    const width = 360;
    const height = 640;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      const y = Math.floor(i / 4 / width);
      rgba[i] = y % 48 < 24 ? 20 : 210;
      rgba[i + 1] = 20;
      rgba[i + 2] = y % 48 < 24 ? 20 : 40;
      rgba[i + 3] = 255;
    }
    let jpeg: string;
    try {
      jpeg = encodeRgbaToJpegBase64(rgba, width, height, 55);
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : String(encErr);
      throw new Error(
        `JPEG_ENCODE_FAIL ${/Buffer/i.test(msg) ? "Property 'Buffer' doesn't exist" : msg}`,
      );
    }
    assert.equal(typeof jpeg, 'string', 'empty jpeg — Cloud never gets frame');
    assert.ok(jpeg.length > 0, 'empty jpeg — Cloud never gets frame');
    const bytes = jpegByteLength(jpeg);
    assert.ok(bytes > 100, `JPEG byteLength ${bytes} — Cloud never gets frame`);
    assert.equal(typeof g.Buffer, 'undefined', 'encode must not install a Buffer polyfill');
  } finally {
    if (hadBuffer) g.Buffer = previousBuffer;
  }
});

// Fake-clock launch sim (~30s of Live, no real waits). Shared by L2–L6.
const screenSrc = readFileSync(join(ROOT, 'screens', 'LiveStylistScreen.tsx'), 'utf8');
const overlaySrc = readFileSync(join(ROOT, 'components', 'live', 'LiveArOverlay.tsx'), 'utf8');

const sim = (() => {
  const history: Array<number | null> = [];
  let gate = createLiveScoreGate();
  let cloudStartMs: number | null = null;
  let firstScoreElapsedMs: number | null = null;
  let jpegReady = false;
  let cloudReady = false;
  let scoreEverPublished = false;
  const yoloEnabled = LIVE_YOLO_ENABLED;
  const cloudWasBlockedByYolo = liveCloudPathBlockedByYoloProof({
    requireYoloProof: false,
    yoloProofOnly: false,
    yoloProven: false,
    yoloEnabled,
  });

  const maybeStartCloud = (now: number) => {
    if (cloudStartMs != null || !jpegReady) return;
    if (cloudWasBlockedByYolo) return;
    cloudStartMs = now;
  };

  const publishCloud = (now: number) => {
    const complete = isHighConfidenceCompleteCloudRead({
      source: 'cloud_vision',
      items: [
        { category: 'tops', subcategory: 't-shirt', name: 'Black T-Shirt', confidence: 0.95 },
        { category: 'bottoms', subcategory: 'athletic_shorts', name: 'Black Athletic Shorts', confidence: 0.9 },
      ],
    });
    const out = gateLiveScore(gate, 78, {
      signature: SIG_SHORTS,
      now,
      settled: false,
      identityLocked: false,
      cloudComplete: complete,
      identityKey: 'athletic_shorts|none',
      footwearResolved: false,
    });
    gate = out.gate;
    history.push(out.score);
    if (out.score != null && firstScoreElapsedMs == null) {
      firstScoreElapsedMs = now;
      scoreEverPublished = true;
    }
  };

  // Simulated timeline (ms). Failed JPEG / Cloud retry; YOLO noise must not win.
  for (const ev of [
    { t: 800, kind: 'jpeg_fail' as const },
    { t: 2400, kind: 'jpeg_ok' as const },
    { t: 3000, kind: 'cloud_fail' as const },
    { t: 4800, kind: 'cloud_ok' as const },
    { t: 5200, kind: 'yolo_noise' as const },
    { t: 5600, kind: 'challenger' as const },
    { t: 6200, kind: 'correct' as const },
    { t: 18000, kind: 'searching' as const },
    { t: 30000, kind: 'searching' as const },
  ]) {
    if (ev.kind === 'jpeg_fail') {
      jpegReady = false;
      continue;
    }
    if (ev.kind === 'jpeg_ok') {
      jpegReady = true;
      maybeStartCloud(ev.t);
      continue;
    }
    if (ev.kind === 'cloud_fail') {
      cloudReady = false;
      continue;
    }
    if (ev.kind === 'cloud_ok') {
      cloudReady = true;
      publishCloud(ev.t);
      continue;
    }
    if (ev.kind === 'challenger') {
      const out = gateLiveScore(gate, 40, {
        signature: SIG_CHALLENGER,
        now: ev.t,
        settled: false,
        identityLocked: false,
        cloudComplete: false,
        identityKey: 'trousers|boots',
        footwearResolved: false,
      });
      gate = out.gate;
      history.push(out.score);
      continue;
    }
    if (ev.kind === 'correct') {
      const out = gateLiveScore(gate, 82, {
        signature: SIG_SHORTS,
        now: ev.t,
        settled: true,
        identityLocked: true,
        cloudComplete: true,
        identityKey: 'athletic_shorts|barefoot',
        footwearResolved: true,
      });
      gate = out.gate;
      history.push(out.score);
      continue;
    }
    if (ev.kind === 'searching') {
      const out = gateLiveScore(gate, 51, {
        signature: SIG_SHORTS,
        now: ev.t,
        settled: false,
        identityLocked: false,
        cloudComplete: false,
        identityKey: 'athletic_shorts|none',
        footwearResolved: false,
      });
      gate = out.gate;
      history.push(out.score);
    }
  }

  const published = cloudTruth(history.find((n) => n != null) ?? 78);
  const leaky = {
    headline: 'Sport-ready',
    summary: 'Maxi dress and black boots. YOLO_PROVEN NMS guard=0 filtered_to_zero REJECT:skin_overlap shoes_skin_roi',
    summaryTemplate: '{top} and {bottom} keep to a consistent colour direction.',
    bullets: ['Maxi dress PASS', 'Black boots'],
  };
  const copyWithYolo = renderCopyFromPublishedTruth(leaky, published);
  const copyWithoutYolo = renderCopyFromPublishedTruth(leaky, published);
  const mapped = mapYoloBoxesOntoPublishedTruth(HORRIBLE_YOLO, published);
  const mappedBlob = mapped.map((d) => d.name).join(' ').toLowerCase();
  const customerText = [
    copyWithYolo?.headline,
    copyWithYolo?.summary,
    ...(copyWithYolo?.bullets || []),
    sanitizeLiveUserHudText('Trousers REJECT:skin_overlap 0.50>0.4 (0.26)'),
    sanitizeLiveUserHudText("Property 'Buffer' doesn't exist"),
  ].join(' ');
  const boxes = customerBoxesFromPublishedTruth(published, { searchingFootwear: true });
  const paint = detectionsForCustomerPaint(HORRIBLE_YOLO, published);
  const yoloAffectedPublishedTruth =
    JSON.stringify(copyWithYolo) !== JSON.stringify(copyWithoutYolo)
    || /maxi|boot/.test(mappedBlob);

  return {
    cloudStartMs,
    firstScoreElapsedMs,
    scoreEverPublished,
    history,
    gate,
    jpegReady,
    cloudReady,
    cloudWasBlockedByYolo,
    yoloEnabled,
    published,
    copy: copyWithYolo,
    mappedBlob,
    customerText,
    customerBBoxCount: boxes.length + paint.length,
    yoloAffectedPublishedTruth,
    wouldOverwrite: yoloWouldOverwritePublishedIdentity(HORRIBLE_YOLO, published),
  };
})();

runLevel('L2', () => {
  assert.equal(LIVE_YOLO_ENABLED, false, 'launch YOLO off — Cloud is not YOLO-gated');
  assert.equal(
    liveCloudPathBlockedByYoloProof({
      requireYoloProof: true,
      yoloProofOnly: true,
      yoloProven: false,
      yoloEnabled: false,
    }),
    false,
    'YOLO disabled never gates Cloud',
  );
  assert.equal(sim.cloudWasBlockedByYolo, false);
  assert.match(screenSrc, /const LIVE_REQUIRE_YOLO_PROOF = false/);
  assert.match(screenSrc, /First Cloud JPEG must not wait on YOLO proof/);
  assert.match(screenSrc, /cloudFillReason = 'first_publish'/);
  assert.match(screenSrc, /LIVE_YOLO_ENABLED && liveCloudPathBlockedByYoloProof/);
  assert.match(screenSrc, /LIVE_YOLO_ENABLED && !firstCloudDue/);
  assert.match(screenSrc, /shouldHoldLivePublishedCopy/);
  assert.match(screenSrc, /proof→jpeg=/);
  assert.doesNotMatch(screenSrc, /if\s*\(\s*yoloProvenRef\.current\s*\)[\s\S]{0,180}firstCloudDue/);
  assert.doesNotMatch(screenSrc, /BELIEF_PROVEN[\s\S]{0,80}firstCloudDue/);
  assert.equal(sim.jpegReady, true);
  assert.ok(sim.cloudStartMs != null, 'Cloud never starts from first usable encoded frame');
  assert.ok(
    (sim.cloudStartMs as number) <= 3500,
    `simulated cloudStartMs ${sim.cloudStartMs} > 3500`,
  );
  return `+${((sim.cloudStartMs as number) / 1000).toFixed(1)}s   (timing may be simulated in unit tests)`;
});

runLevel('L3', () => {
  assert.ok(sim.scoreEverPublished, 'first score never published');
  assert.ok(sim.firstScoreElapsedMs != null);
  const t = sim.firstScoreElapsedMs as number;
  assert.ok(t <= 7000, `firstScoreElapsedMs ${t} — waited past 7s sim budget`);
  assert.ok(t < 12000, `first publish waited ${t}ms (12s hard fail)`);
  assert.ok(t < 17000, `first publish waited ${t}ms (17s hard fail)`);
  assert.ok(t < 30000, `first publish waited ${t}ms (30s hard fail)`);
  const first = gateLiveScore(createLiveScoreGate(), 78, {
    signature: SIG_SHORTS,
    now: t,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: 'athletic_shorts|none',
    footwearResolved: false,
  });
  assert.equal(first.score, 78, 'top+bottom Cloud must publish without waiting for ~ removal');
  assert.equal(first.gate.approximate, true);
  assert.equal(
    presentLiveScore(first.score, 'high', { approximate: true }).display,
    '~78',
  );
  assert.notEqual(presentLiveScore(first.score, 'high', { approximate: true }).display, '—');
  return `+${(t / 1000).toFixed(1)}s   (unit/sim is OK; real 5s is device)`;
});

runLevel('L4', () => {
  const hist: Array<number | null> = [];
  let gate = createLiveScoreGate();
  const pub = gateLiveScore(gate, 78, {
    signature: SIG_SHORTS,
    now: 4800,
    cloudComplete: true,
    identityKey: 'athletic_shorts|none',
    footwearResolved: false,
  });
  gate = pub.gate;
  hist.push(pub.score);
  assert.equal(pub.score, 78);

  const challenger = gateLiveScore(gate, 40, {
    signature: SIG_CHALLENGER,
    now: 5600,
    settled: false,
    identityLocked: false,
    cloudComplete: false,
    identityKey: 'trousers|boots',
    footwearResolved: false,
  });
  gate = challenger.gate;
  hist.push(challenger.score);
  assert.equal(challenger.score, 78, 'unconfirmed challenger does not blank');
  assert.notEqual(
    presentLiveScore(challenger.score, 'high', { approximate: challenger.gate.approximate }).display,
    '—',
  );

  const confirmed = gateLiveScore(gate, 82, {
    signature: SIG_SHORTS,
    now: 6200,
    settled: true,
    identityLocked: true,
    cloudComplete: true,
    identityKey: 'athletic_shorts|barefoot',
    footwearResolved: true,
  });
  hist.push(confirmed.score);
  assert.equal(confirmed.score, 82, 'confirmed correction 82 replaces atomically');
  assert.ok(neverBlanked(hist), 'history never 78 → null → 78');
  assert.ok(neverBlanked(sim.history), 'sim history never blanked after publish');
  assert.equal(sim.history.includes(null), false);

  // QA 18 Aug: identity change loafers → trainers updates the number atomically
  // and drops ~ once footwear is resolved.
  let shoeGate = createLiveScoreGate();
  const loaferPub = gateLiveScore(shoeGate, 48, {
    signature: 't-shirt|sweat_shorts|loafers',
    now: 8000,
    cloudComplete: true,
    identityKey: 'sweat_shorts|loafers',
    footwearResolved: true,
  });
  shoeGate = loaferPub.gate;
  hist.push(loaferPub.score);
  assert.equal(loaferPub.gate.approximate, false);
  const trainerPub = gateLiveScore(shoeGate, 96, {
    signature: 't-shirt|sweat_shorts|trainers',
    now: 9000,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
    identityKey: 'sweat_shorts|sneakers',
    footwearResolved: true,
  });
  hist.push(trainerPub.score);
  assert.equal(trainerPub.score, 96, 'trainers Cloud score replaces loafers-48');
  assert.notEqual(trainerPub.score, loaferPub.score);
  assert.equal(trainerPub.gate.approximate, false, 'resolved trainers clear ~');
  assert.equal(
    presentLiveScore(trainerPub.score, 'medium', { approximate: trainerPub.gate.approximate }).display,
    '96',
  );
  assert.equal(
    shouldHoldLivePublishedCopy({
      adoptedScore: trainerPub.score,
      scoredIdentityKey: trainerPub.gate.scoredIdentityKey,
      nextIdentityKey: 'sweat_shorts|sneakers',
    }),
    false,
  );
  assert.ok(neverBlanked(hist), 'loafers→trainers never blanked');
});

runLevel('L5', () => {
  assert.equal(sim.yoloEnabled, false);
  assert.equal(sim.cloudWasBlockedByYolo, false);
  assert.equal(sim.wouldOverwrite, true, 'horrible YOLO would overwrite if allowed to paint');
  assert.match(sim.published.top?.name || '', /black t-shirt/i);
  assert.match(sim.published.bottom?.name || '', /athletic shorts/i);
  assert.doesNotMatch(sim.copy?.summary || '', /maxi|boots?/i);
  assert.doesNotMatch(sim.mappedBlob, /maxi dress|boots|reject|skin_overlap/);
  assert.doesNotMatch(sim.customerText, CUSTOMER_LEAK_RE);
  assert.equal(sim.yoloAffectedPublishedTruth, false);
});

runLevel('L6', () => {
  assert.equal(LIVE_CUSTOMER_BOXES_ENABLED, false);
  assert.equal(sim.customerBBoxCount, 0);
  assert.doesNotMatch(overlaySrc, CUSTOMER_BBOX_TESTID_RE);
  assert.doesNotMatch(screenSrc, CUSTOMER_BBOX_TESTID_RE);
  assert.deepEqual(
    customerBoxesFromPublishedTruth(sim.published, { searchingFootwear: true }),
    [],
  );
  assert.deepEqual(detectionsForCustomerPaint(HORRIBLE_YOLO, sim.published), []);
});

const allPass = (Object.keys(LABEL) as Level[]).every((k) => result[k].ok);
console.log('LIVE PERMANENT REGRESSION');
for (const k of Object.keys(LABEL) as Level[]) {
  const row = result[k];
  const status = row.ok ? 'PASS' : 'FAIL';
  const extra = row.ok && row.extra ? `  ${row.extra}` : row.ok ? '' : row.err ? `  ${row.err}` : '';
  console.log(`${LABEL[k]} ${status}${extra}`);
}
if (!allPass) {
  console.log('LIVE LAUNCH GATE: BLOCKED');
  process.exit(1);
}
console.log('LIVE LAUNCH GATE: PASS');
