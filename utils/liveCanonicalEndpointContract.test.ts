/**
 * Offline live-frame → v2 HUD contract. Uses the same handler pipeline as
 * index.js after mocked Vision (metadata-only detections: no OpenAI).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  applyCanonicalLiveFrame,
  isCanonicalOutfitEnabled,
  wantsCanonicalContract,
} from '../../Dripn-Server-canonical-outfit/services/liveCoaching/canonicalOutfit.js';
import {
  buildLiveStyleFeedback,
  buildScanSessionItems,
  enrichClientDetections,
  healVisionDetections,
  stabilizeLiveDetections,
} from '../../Dripn-Server-canonical-outfit/services/scanWardrobe.js';
import {
  applyCanonicalLiveResponse,
  LIVE_ESTABLISHING_FAST_MAX,
  nextCanonicalRequestPolicy,
} from './liveCanonicalHud.ts';

const INDEX = readFileSync(
  new URL('../../Dripn-Server-canonical-outfit/index.js', import.meta.url),
  'utf8',
);
const HANDLER = INDEX.slice(
  INDEX.indexOf('app.post("/api/wardrobe/scan-wardrobe/live-frame"'),
  INDEX.indexOf('app.post("/api/wardrobe/analyze-and-save"'),
);

const coatBox = [0.12, 0.04, 0.52, 0.72];
const neckBox = [0.32, 0.05, 0.38, 0.18];
const jeanBox = [0.22, 0.42, 0.38, 0.48];
const bootBox = [0.28, 0.82, 0.28, 0.14];

const coat = det('Charcoal Long Coat', 'outerwear', 'overcoat', 'charcoal', coatBox);
const blazer = det('Grey Blazer', 'outerwear', 'blazer', 'grey', coatBox);
const scarf = det('Red Knit Scarf', 'accessories', 'scarf', 'red', neckBox);
const sweater = det('Red Sweater', 'tops', 'sweater', 'red', neckBox);
const jeans = det('Blue Wide-Leg Jeans', 'bottoms', 'jeans', 'blue', jeanBox);
const boots = det('Black Chelsea Boots', 'shoes', 'boots', 'black', bootBox);
const ghost = det('Green Silk Scarf', 'accessories', 'scarf', 'green', [0.72, 0.02, 0.16, 0.1]);
const full = [coat, scarf, jeans, boots];

let openaiCalls = 0;
const openai = {
  chat: {
    completions: {
      create: async () => {
        openaiCalls += 1;
        throw new Error('paid Vision must not be called');
      },
    },
  },
};

function det(name, category, subcategory, color, bbox) {
  return {
    name, category, subcategory, color, bbox, confidence: 0.92, source: 'cloud_vision_mock',
  };
}

function coachingKey(fb) {
  return JSON.stringify({
    score: fb?.score ?? null,
    headline: fb?.coaching?.headline || '',
    summary: fb?.coaching?.summary || '',
    bullets: fb?.coaching?.bullets || [],
  });
}

function copyHasFalseBoldClash(fb) {
  const blob = `${fb?.coaching?.headline || ''} ${fb?.coaching?.summary || ''} ${(fb?.coaching?.bullets || []).join(' ')}`.toLowerCase();
  return /competing|clash|fight each other|too many bold/.test(blob);
}

/** Same control-flow as live-frame after Vision, with detections as mocked Vision. */
async function invokeLiveFrameHandler(body, { flagOn } = { flagOn: true }) {
  process.env.LIVE_CANONICAL_OUTFIT = flagOn ? 'on' : 'off';
  const {
    detections = [],
    previousItems = [],
    previousFeedback = null,
    liveContractVersion = null,
    liveSession = null,
    sessionEpoch = null,
    obsSeq = null,
    imageBase64 = null,
    imageUrl = null,
    richCritique = false,
    hybridMatch = false,
  } = body || {};
  // Production requires imageBase64 for a truly empty Cloud frame. This harness
  // treats `detections` (including []) as a mocked Vision JSON items list so we
  // never send bytes to OpenAI.
  const hasMockedVision = Array.isArray(detections);
  if (!hasMockedVision && !imageBase64 && !imageUrl) {
    return { status: 400, json: { success: false, message: 'imageBase64, imageUrl, or detections is required' } };
  }
  const wantRichCritique = Boolean(richCritique);
  const metadataOnly = hasMockedVision && !wantRichCritique && !imageBase64 && !imageUrl;
  if (!metadataOnly) {
    await openai.chat.completions.create({ model: 'vision' });
  }
  const visionItems = enrichClientDetections(detections, { hardFallback: false });
  const source = 'on_device';
  const sceneType = 'worn';
  const session = await buildScanSessionItems({
    visionItems,
    sceneType,
    imageBuffer: null,
    sharpLib: null,
    includeCrops: false,
    preserveLiveTaxonomy: true,
  });
  const healed = healVisionDetections(session.items, {
    sceneType,
    maxItems: 8,
    hardFallback: false,
    reclassify: false,
  });
  const withSuggestions = healed.items.map((item, i) => ({
    ...item,
    suggestion: visionItems[i]?.suggestion ? String(visionItems[i].suggestion).slice(0, 120) : (item.suggestion || null),
    source,
  }));
  let items = stabilizeLiveDetections(previousItems, withSuggestions);
  const useCanonical = isCanonicalOutfitEnabled() && wantsCanonicalContract({ liveContractVersion });
  let canonicalPack = null;
  let feedback;
  let changed;
  if (!useCanonical) {
    const scored = buildLiveStyleFeedback({
      items,
      sceneType,
      previousFeedback,
      previousItems,
      skipScoreHold: false,
    });
    feedback = scored.feedback;
    changed = scored.changed;
  } else {
    canonicalPack = applyCanonicalLiveFrame({
      observationItems: items,
      liveSession,
      sessionEpoch,
      obsSeq,
      scoreSnapshot: (snapshotItems) => buildLiveStyleFeedback({
        items: snapshotItems,
        sceneType,
        previousFeedback: null,
        previousItems: [],
        skipScoreHold: true,
      }),
    });
    items = canonicalPack.items;
    feedback = canonicalPack.feedback;
    changed = canonicalPack.changed;
  }
  return {
    status: 200,
    json: JSON.parse(JSON.stringify({
      success: true,
      source,
      sceneType,
      itemCount: items.length,
      items,
      feedback,
      feedbackChanged: changed,
      ...(canonicalPack ? {
        liveContractVersion: canonicalPack.liveContractVersion,
        liveSession: canonicalPack.liveSession,
        publication: canonicalPack.publication,
        schedulerHint: canonicalPack.schedulerHint,
        obsSeq: canonicalPack.liveSession?.lastAppliedObsSeq,
      } : {}),
    })),
  };
}

function applyHud(res, state) {
  const applied = applyCanonicalLiveResponse({
    res,
    lastAppliedObsSeq: state.lastAppliedObsSeq,
    requestGeneration: state.generation,
    currentGeneration: state.generation,
  });
  if (applied.kind === 'canonical') {
    state.lastAppliedObsSeq = applied.appliedObsSeq;
    state.session = applied.liveSession;
  }
  return applied;
}

describe('live-frame handler source lock', () => {
  it('wires canonical mode only when flag and v2 contract are both present', () => {
    assert.match(HANDLER, /const useCanonical = isCanonicalOutfitEnabled\(\) && wantsCanonicalContract\(\{ liveContractVersion \}\)/);
    assert.match(HANDLER, /metadataOnly = hasClientDetections && !wantRichCritique && !imageBase64 && !imageUrl/);
    assert.match(HANDLER, /openai\.chat\.completions\.create/);
    assert.match(HANDLER, /skipScoreHold: true/);
  });
});

describe('endpoint-to-HUD v2 sequence', () => {
  it('holds identity through flicker and publishes genuine change/reset', async () => {
    openaiCalls = 0;
    const hud = { lastAppliedObsSeq: 0, generation: 1, session: null };
    const steps = [];
    async function go(label, detections, extra = {}) {
      const prev = steps[steps.length - 1];
      const obsSeq = extra.obsSeq ?? ((hud.lastAppliedObsSeq || 0) + 1);
      const http = await invokeLiveFrameHandler({
        detections,
        hybridMatch: false,
        liveContractVersion: 2,
        liveSession: hud.session,
        sessionEpoch: 1,
        obsSeq,
        previousItems: prev?.http.json.items || [],
        previousFeedback: prev?.http.json.feedback || null,
      }, { flagOn: true });
      assert.equal(http.status, 200);
      const applied = applyHud(http.json, hud);
      steps.push({ label, http, applied, obsSeq });
      return steps[steps.length - 1];
    }

    const first = await go('complete', full);
    assert.equal(first.http.json.publication.status, 'published');
    assert.equal(first.applied.kind, 'canonical');
    const held = coachingKey(first.http.json.feedback);
    assert.equal(coachingKey(first.applied.feedback), held);
    assert.equal(first.applied.score, first.http.json.feedback.score);
    assert.ok(first.applied.items.every((it: { bbox?: number[] }) => Array.isArray(it.bbox) && it.bbox[2] > 0.02));
    assert.equal(copyHasFalseBoldClash(first.http.json.feedback), false);
    const coatId = first.http.json.liveSession.garments.find((g: { slot: string }) => g.slot === 'outer')?.garmentId;
    const revision = first.http.json.publication.revision;

    const omit = await go('coat omitted', [scarf, jeans, boots]);
    assert.equal(omit.http.json.publication.status, 'incomplete');
    assert.equal(coachingKey(omit.http.json.feedback), held);
    assert.equal(coachingKey(omit.applied.feedback), held);
    assert.equal(omit.applied.items.some((it: { garmentId?: string }) => it.garmentId === coatId), false);
    assert.equal(omit.http.json.publication.revision, revision);

    const sweaterStep = await go('scarf as sweater', [coat, sweater, jeans, boots]);
    assert.equal(coachingKey(sweaterStep.http.json.feedback), held);
    assert.equal(coachingKey(sweaterStep.applied.feedback), held);
    const necks = sweaterStep.http.json.liveSession.garments.filter((g: { slot: string; presence: string }) => g.slot === 'neck' && g.presence !== 'removed');
    assert.equal(necks.length, 1);

    const blazerStep = await go('coat as blazer', [blazer, scarf, jeans, boots]);
    assert.equal(coachingKey(blazerStep.http.json.feedback), held);
    assert.equal(blazerStep.http.json.publication.revision, revision);

    const ghostStep = await go('spurious accessory', [...full, ghost]);
    assert.equal(coachingKey(ghostStep.http.json.feedback), held);
    assert.equal(ghostStep.http.json.publication.revision, revision);

    await go('coat miss 1', [scarf, jeans, boots]);
    const removed = await go('coat miss 2', [scarf, jeans, boots]);
    assert.ok(removed.http.json.publication.reason === 'removal' || removed.http.json.publication.status === 'published');
    assert.notEqual(coachingKey(removed.http.json.feedback), held);
    assert.equal(coachingKey(removed.applied.feedback), coachingKey(removed.http.json.feedback));

    const scene = await go('scene change', [
      det('Red Dress', 'dresses', 'dress', 'red', [0.2, 0.1, 0.5, 0.8]),
      det('White Trainers', 'shoes', 'sneakers', 'white', [0.3, 0.85, 0.3, 0.12]),
    ]);
    assert.ok(['scene_reset', 'published', 'establishing'].includes(String(scene.http.json.publication.status)));
    const coatsLeft = (scene.http.json.liveSession.garments || []).filter((g: { slot: string; presence: string }) => g.slot === 'outer' && g.presence !== 'removed');
    assert.equal(coatsLeft.length, 0);
    if (scene.http.json.publication.status === 'scene_reset' || scene.http.json.publication.status === 'establishing') {
      assert.deepEqual(scene.applied.items, []);
    }

    const empty1 = await go('empty 1', []);
    const empty2 = await go('empty 2', []);
    const empty3 = await go('empty 3', []);
    assert.equal(empty3.http.json.publication.status, 'establishing');
    assert.equal(empty3.applied.score, null);
    assert.deepEqual(empty3.applied.items, []);
    assert.ok(empty1.http.json.obsSeq < empty3.http.json.obsSeq);

    assert.equal(openaiCalls, 0);
    assert.equal(steps.length, 11);
  });
});

describe('feature flag and legacy clients', () => {
  it('flag off never returns a v2 publication even if the client sends contract v2', async () => {
    const http = await invokeLiveFrameHandler({
      detections: full,
      liveContractVersion: 2,
      sessionEpoch: 1,
      obsSeq: 1,
      hybridMatch: false,
    }, { flagOn: false });
    assert.equal(http.json.publication, undefined);
    assert.equal(http.json.liveContractVersion, undefined);
    assert.equal(wantsCanonicalContract({ liveContractVersion: 2 }), true);
    assert.equal(isCanonicalOutfitEnabled({ LIVE_CANONICAL_OUTFIT: 'off' }), false);
    const hud = applyCanonicalLiveResponse({
      res: http.json,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(hud.kind, 'legacy');
  });

  it('legacy client without liveContractVersion stays off the canonical path with flag on', async () => {
    process.env.LIVE_CANONICAL_OUTFIT = 'on';
    const http = await invokeLiveFrameHandler({
      detections: full,
      obsSeq: 1,
      hybridMatch: false,
    }, { flagOn: true });
    assert.equal(http.json.publication, undefined);
    assert.equal(applyCanonicalLiveResponse({
      res: http.json,
      requestGeneration: 1,
      currentGeneration: 1,
    }).kind, 'legacy');
  });

  it('v2 client with flag on receives canonical publication', async () => {
    const http = await invokeLiveFrameHandler({
      detections: full,
      liveContractVersion: 2,
      sessionEpoch: 1,
      obsSeq: 1,
      hybridMatch: false,
    }, { flagOn: true });
    assert.equal(http.json.liveContractVersion, 2);
    assert.equal(http.json.publication.status, 'published');
    assert.equal(applyCanonicalLiveResponse({
      res: http.json,
      requestGeneration: 1,
      currentGeneration: 1,
    }).kind, 'canonical');
  });
});

describe('no hidden paid Vision + scheduler bounds', () => {
  it('metadata-only handler never calls OpenAI', async () => {
    openaiCalls = 0;
    await invokeLiveFrameHandler({ detections: full, liveContractVersion: 2, obsSeq: 1 }, { flagOn: true });
    assert.equal(openaiCalls, 0);
  });

  it('establishing retries cap at three fast calls then 12s', () => {
    let fast = 0;
    const waits: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const p = nextCanonicalRequestPolicy({
        firstCloudSent: true,
        publishedCore: false,
        schedulerHint: 'scene_transition',
        establishingFastCount: fast,
      });
      waits.push(p.waitMs);
      if (p.incrementEstablishingFast) fast += 1;
    }
    assert.equal(waits.filter((w) => w === 400).length, LIVE_ESTABLISHING_FAST_MAX);
    assert.ok(waits.slice(LIVE_ESTABLISHING_FAST_MAX).every((w) => w === 12000));
  });
});
