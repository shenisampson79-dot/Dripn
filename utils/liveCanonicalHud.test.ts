import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLOUD_CANONICAL_STABLE_MS,
  CLOUD_CANONICAL_SUSPECT_MS,
  applyCanonicalLiveResponse,
  attachLiveContractPayload,
  isLiveContractV2,
  liveCanonicalWaitMs,
  shouldApplyCanonicalObs,
  shouldBypassHashSkip,
} from './liveCanonicalHud.ts';
import { createLiveScoreGate, gateLiveScore } from './liveScoreStability.ts';

const published = {
  liveContractVersion: 2,
  obsSeq: 2,
  schedulerHint: 'stable',
  publication: { revision: 1, status: 'published' as const },
  liveSession: { epoch: 1, lastAppliedObsSeq: 2, sessionId: 's1' },
  items: [{ name: 'charcoal overcoat', category: 'outerwear' }],
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
  it('keeps 12s stable monitoring and 2s suspect verify', () => {
    assert.equal(liveCanonicalWaitMs({ firstCloudSent: true, publishedCore: true }).waitMs, CLOUD_CANONICAL_STABLE_MS);
    assert.equal(liveCanonicalWaitMs({
      firstCloudSent: true,
      publishedCore: true,
      schedulerHint: 'suspect_change',
    }).waitMs, CLOUD_CANONICAL_SUSPECT_MS);
    assert.equal(shouldBypassHashSkip('suspect_change'), true);
    assert.equal(shouldBypassHashSkip('stable'), false);
  });
});
