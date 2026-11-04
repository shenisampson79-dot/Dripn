import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLOUD_CANONICAL_STABLE_MS,
  CLOUD_CANONICAL_SUSPECT_MS,
  LIVE_ESTABLISHING_FAST_MAX,
  applyCanonicalLiveResponse,
  attachLiveContractPayload,
  isLiveContractV2,
  liveCanonicalWaitMs,
  nextCanonicalRequestPolicy,
  shouldApplyCanonicalObs,
  shouldBypassHashSkip,
  shouldResetCanonicalSessionAfterBackground,
} from './liveCanonicalHud.ts';
import { createLiveScoreGate, gateLiveScore } from './liveScoreStability.ts';

const published = {
  liveContractVersion: 2,
  obsSeq: 2,
  schedulerHint: 'stable',
  publication: { revision: 1, status: 'published' as const },
  liveSession: { epoch: 1, lastAppliedObsSeq: 2, sessionId: 's1' },
  items: [{ name: 'charcoal overcoat', category: 'outerwear', bbox: [0.12, 0.04, 0.52, 0.72], trackId: 'g_1' }],
  feedback: {
    score: 96,
    coaching: {
      headline: 'Looks sharp',
      summary: 'The charcoal coat holds the look together.',
      bullets: ['The red scarf adds a layer around the neckline.'],
    },
  },
};

describe('canonical v2 HUD contract', () => {
  it('17. displays backend score and copy without score-hold remix', () => {
    const applied = applyCanonicalLiveResponse({
      res: published,
      lastAppliedObsSeq: 1,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(applied.kind, 'canonical');
    if (applied.kind !== 'canonical') return;
    assert.equal(applied.score, 96);
    assert.equal(applied.coaching?.summary, published.feedback.coaching.summary);
    assert.equal(applied.coaching?.headline, published.feedback.coaching.headline);
    assert.equal(applied.items.length, 1);
    assert.deepEqual((applied.items[0] as { bbox: number[] }).bbox, [0.12, 0.04, 0.52, 0.72]);
    const gated = gateLiveScore(
      { ...createLiveScoreGate(), shown: 64, signature: 'old', scoredIdentityKey: 'jeans|loafer' },
      96,
      { signature: 'new', now: Date.now(), identityKey: 'jeans|trainer', settled: false },
    );
    assert.notEqual(gated.score, applied.score);
  });

  it('does not mix a previous explanation with a new score', () => {
    const next = applyCanonicalLiveResponse({
      res: {
        ...published,
        obsSeq: 3,
        liveSession: { ...published.liveSession, lastAppliedObsSeq: 3 },
        feedback: {
          score: 54,
          coaching: {
            headline: 'Needs a tweak',
            summary: 'The red scarf fights the coat.',
            bullets: ['Try a quieter neckline.'],
          },
        },
      },
      lastAppliedObsSeq: 2,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(next.kind, 'canonical');
    if (next.kind !== 'canonical') return;
    assert.equal(next.score, 54);
    assert.match(String(next.coaching?.summary), /red scarf fights/);
    assert.equal(String(next.coaching?.summary).includes(published.feedback.coaching.summary), false);
  });

  it('shows establishing without inventing a full-outfit score', () => {
    const applied = applyCanonicalLiveResponse({
      res: {
        liveContractVersion: 2,
        obsSeq: 1,
        publication: { revision: 0, status: 'establishing' },
        schedulerHint: 'scene_transition',
        feedback: { score: null, publicationStatus: 'establishing', coaching: { headline: '', summary: '', bullets: [] } },
        items: [],
      },
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(applied.kind, 'canonical');
    if (applied.kind !== 'canonical') return;
    assert.equal(applied.score, null);
    assert.equal(applied.publicationStatus, 'establishing');
    assert.deepEqual(applied.items, []);
  });

  it('clears boxes on scene-reset even if stale items are present', () => {
    const applied = applyCanonicalLiveResponse({
      res: {
        ...published,
        publication: { revision: 3, status: 'scene_reset' },
        items: published.items,
      },
      lastAppliedObsSeq: 1,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(applied.kind, 'canonical');
    if (applied.kind !== 'canonical') return;
    assert.deepEqual(applied.items, []);
  });

  it('drops out-of-order obsSeq and stale generations', () => {
    assert.equal(shouldApplyCanonicalObs({
      obsSeq: 3,
      lastAppliedObsSeq: 4,
      requestGeneration: 1,
      currentGeneration: 1,
    }), false);
    const ignored = applyCanonicalLiveResponse({
      res: published,
      lastAppliedObsSeq: 4,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(ignored.kind, 'ignore');
    const staleGen = applyCanonicalLiveResponse({
      res: { ...published, obsSeq: 5, liveSession: { ...published.liveSession, lastAppliedObsSeq: 5 } },
      lastAppliedObsSeq: 4,
      requestGeneration: 1,
      currentGeneration: 2,
    });
    assert.equal(staleGen.kind, 'ignore');
  });

  it('16. v1 responses stay on the legacy path', () => {
    assert.equal(isLiveContractV2({ feedback: { score: 80 } }), false);
    const applied = applyCanonicalLiveResponse({
      res: { feedback: { score: 80, coaching: { headline: 'Nice', summary: 'ok', bullets: [] } } },
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(applied.kind, 'legacy');
  });

  it('polishes UK HUD names and coaching without touching liveSession identity', () => {
    const res = {
      ...published,
      items: [{
        name: 'White Sneakers',
        category: 'shoes',
        subcategory: 'sneakers',
        bbox: [0.2, 0.7, 0.3, 0.2],
        trackId: 'g_shoe',
      }],
      feedback: {
        score: 84,
        issues: ['Navy Pants clash'],
        suggestions: ['A yellow sweater would add warmth'],
        coaching: {
          headline: 'Looking good',
          summary: 'Yellow sweater, black pants and white sneakers work well together.',
          bullets: ['White Sneakers keep the look easy'],
        },
      },
      liveSession: {
        epoch: 1,
        lastAppliedObsSeq: 2,
        sessionId: 's1',
        garments: [{ garmentId: 'g_shoe', displayName: { value: 'White Sneakers' } }],
      },
    };
    const applied = applyCanonicalLiveResponse({
      res,
      lastAppliedObsSeq: 1,
      requestGeneration: 1,
      currentGeneration: 1,
    });
    assert.equal(applied.kind, 'canonical');
    if (applied.kind !== 'canonical') return;
    assert.equal((applied.items[0] as { name: string }).name, 'White Trainers');
    assert.equal((applied.items[0] as { subcategory: string }).subcategory, 'sneakers');
    assert.match(String(applied.coaching?.summary), /jumper/i);
    assert.match(String(applied.coaching?.summary), /trousers/i);
    assert.match(String(applied.coaching?.summary), /trainers/i);
    assert.match(String(applied.feedback.suggestions?.[0]), /jumper/i);
    assert.deepEqual(applied.liveSession, res.liveSession);
    assert.equal((applied.identityItems[0] as { name: string }).name, 'White Sneakers');
    assert.equal((res.items[0] as { name: string }).name, 'White Sneakers');
  });

  it('keeps US terminology when locale is US', () => {
    const applied = applyCanonicalLiveResponse({
      res: {
        ...published,
        items: [{ name: 'White Sneakers', category: 'shoes', bbox: [0.2, 0.7, 0.3, 0.2] }],
        feedback: {
          score: 80,
          coaching: { headline: 'Nice', summary: 'White sneakers and black pants.', bullets: [] },
        },
      },
      lastAppliedObsSeq: 1,
      requestGeneration: 1,
      currentGeneration: 1,
      locale: 'US',
    });
    assert.equal(applied.kind, 'canonical');
    if (applied.kind !== 'canonical') return;
    assert.equal((applied.items[0] as { name: string }).name, 'White Sneakers');
    assert.match(String(applied.coaching?.summary), /sneakers/);
    assert.match(String(applied.coaching?.summary), /pants/);
  });

  it('echoes only last accepted session on the outbound payload', () => {
    const payload = attachLiveContractPayload({}, {
      liveSession: published.liveSession,
      sessionEpoch: 1,
      obsSeq: 3,
    });
    assert.equal(payload.liveContractVersion, 2);
    assert.equal(payload.obsSeq, 3);
    assert.deepEqual(payload.liveSession, published.liveSession);
  });
});

describe('canonical scheduler', () => {
  it('keeps 12s stable monitoring and one 2s suspect verify with hash bypass', () => {
    assert.equal(liveCanonicalWaitMs({ firstCloudSent: true, publishedCore: true }).waitMs, CLOUD_CANONICAL_STABLE_MS);
    const suspect = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: true,
      schedulerHint: 'suspect_change',
    });
    assert.equal(suspect.waitMs, CLOUD_CANONICAL_SUSPECT_MS);
    assert.equal(suspect.bypassHash, true);
    assert.equal(suspect.markSuspectVerify, true);
    const afterOne = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: true,
      schedulerHint: 'suspect_change',
      suspectVerifySent: true,
    });
    assert.equal(afterOne.waitMs, CLOUD_CANONICAL_STABLE_MS);
    assert.equal(afterOne.bypassHash, false);
    assert.equal(shouldBypassHashSkip(null, afterOne), false);
  });

  it('caps establishing fast retries and does not loop paid Vision', () => {
    const first = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: false,
      schedulerHint: 'scene_transition',
      establishingFastCount: 0,
    });
    assert.equal(first.waitMs, 400);
    assert.equal(first.bypassHash, true);
    const capped = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: false,
      schedulerHint: 'scene_transition',
      establishingFastCount: LIVE_ESTABLISHING_FAST_MAX,
    });
    assert.equal(capped.waitMs, CLOUD_CANONICAL_STABLE_MS);
    assert.equal(capped.bypassHash, false);
  });

  it('backs off failed or empty responses and keeps one in-flight', () => {
    const inflight = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: true,
      inFlight: true,
    });
    assert.equal(inflight.send, false);
    const fail = nextCanonicalRequestPolicy({
      firstCloudSent: true,
      publishedCore: true,
      lastOutcome: 'fail',
      emptyFailStreak: 1,
    });
    assert.equal(fail.waitMs, 4000);
    assert.equal(fail.bypassHash, false);
  });

  it('resets canonical session after 90s background', () => {
    assert.equal(shouldResetCanonicalSessionAfterBackground(1, 91_001), true);
    assert.equal(shouldResetCanonicalSessionAfterBackground(50_000, 80_000), false);
  });
});
