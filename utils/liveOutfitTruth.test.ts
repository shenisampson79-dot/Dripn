/**
 * Run: npx tsx utils/liveOutfitTruth.test.ts
 */
import assert from 'node:assert/strict';

import {
  alignCoachingToTruth,
  buildOutfitTruth,
  canWarmStartTruth,
  deriveOutfitConflict,
  stashWarmTruth,
  LIVE_TRUTH_WARM_MS,
} from '@/utils/liveOutfitTruth';
import type { OutfitBeliefState } from '@/utils/liveGarmentBelief';

function belief(partial: Partial<OutfitBeliefState> = {}): OutfitBeliefState {
  return {
    top: {
      name: 'White Graphic T-Shirt',
      category: 'tops',
      subcategory: 't-shirt',
      color: 'white',
      confidence: 0.95,
      stability: 0.9,
      kind: 'top',
      bbox: [0.25, 0.12, 0.4, 0.3],
      lastSeenAt: 1000,
      lastChangedAt: 1000,
    },
    bottom: {
      name: 'Black Leggings',
      category: 'bottoms',
      subcategory: 'leggings',
      color: 'black',
      confidence: 0.95,
      stability: 0.9,
      kind: 'trousers',
      bbox: [0.3, 0.42, 0.35, 0.48],
      lastSeenAt: 1000,
      lastChangedAt: 1000,
    },
    layer: null,
    footwear: null,
    accessories: [],
    ...partial,
  } as OutfitBeliefState;
}

assert.equal(
  deriveOutfitConflict({
    score: 90,
    coaching: { headline: '', summary: 'ok', bullets: [], hasConflict: true, sameLane: true },
  }),
  false,
  'orphaned hasConflict must not override cohesive score + lane',
);
assert.equal(
  deriveOutfitConflict({
    score: 90,
    coaching: {
      headline: '',
      summary: 'ok',
      bullets: ['Formality mismatch across items'],
      hasConflict: true,
      sameLane: true,
    },
  }),
  true,
  'hasConflict stays when tension evidence exists',
);
assert.equal(
  deriveOutfitConflict({
    score: 82,
    coaching: {
      headline: '',
      summary: 'ok',
      bullets: [],
      sameLane: true,
      summaryArchetype: 'tension',
    },
  }),
  false,
  'tension archetype alone cannot force conflict on a cohesive score',
);
assert.equal(
  deriveOutfitConflict({
    score: 90,
    coaching: { headline: '', summary: 'ok', bullets: [], sameLane: false },
  }),
  true,
);
assert.equal(
  deriveOutfitConflict({
    score: 90,
    coaching: {
      headline: '',
      summary: 'ok',
      bullets: [],
      sameLane: true,
      summaryArchetype: 'balanced',
    },
  }),
  false,
);

{
  const truth = buildOutfitTruth({
    belief: belief({
      layer: {
        name: 'Blue and Red Towel',
        category: 'accessories',
        subcategory: 'towel',
        color: 'blue',
        confidence: 0.95,
        stability: 0.9,
        kind: 'top',
        bbox: [0.3, 0.15, 0.35, 0.35],
        lastSeenAt: 1000,
        lastChangedAt: 1000,
      } as never,
    }),
    feedback: {
      score: 72,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Sport-ready',
        summary: 'ok',
        bullets: [],
        sameLane: true,
        hasConflict: false,
      },
    },
  });
  assert.equal(truth.layer, null, 'towel must never enter truth');
}

{
  const prev = buildOutfitTruth({
    belief: belief(),
    feedback: {
      score: 90,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Sport-ready',
        summary: 'ok',
        bullets: [],
        sameLane: true,
        hasConflict: false,
      },
    },
    now: 1000,
  });
  const flickered = buildOutfitTruth({
    belief: belief({
      bottom: {
        name: 'Rainbow Tutu Skirt',
        category: 'bottoms',
        subcategory: 'skirt',
        color: 'multicolour',
        confidence: 0.93,
        stability: 0.5,
        kind: 'skirt',
        bbox: [0.2, 0.5, 0.3, 0.2],
        lastSeenAt: 2000,
        lastChangedAt: 2000,
      } as never,
    }),
    feedback: {
      score: 78,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Trying it on',
        summary: 'ok',
        bullets: [],
        sameLane: true,
        hasConflict: false,
      },
    },
    prev,
    now: 2000,
  });
  assert.match(flickered.bottom?.name || '', /legging/i, 'continuity keeps the held bottom');
}

{
  const truth = buildOutfitTruth({
    belief: belief(),
    feedback: {
      score: 94,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Sport-ready',
        summary: 'White graphic t-shirt and black leggings keep the look simple.',
        bullets: ['add white trainers for a finished look'],
        sameLane: true,
        hasConflict: false,
        styleLane: 'athleisure',
      },
    },
    now: 5000,
  });
  assert.equal(truth.hasConflict, false);
  assert.equal(truth.score, 94);
  assert.equal(truth.isStable, true);
  assert.equal(truth.seedDetections.length, 2);
  assert.match(truth.top?.name || '', /t-shirt/i);
  assert.match(truth.bottom?.name || '', /legging/i);
}

{
  const truth = buildOutfitTruth({
    belief: belief(),
    feedback: {
      score: 58,
      issues: ['Formality mismatch across items'],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Mixed directions',
        summary: 'Pieces do not fully come together yet.',
        bullets: [],
        sameLane: false,
        hasConflict: true,
        summaryArchetype: 'tension',
      },
    },
  });
  assert.equal(truth.hasConflict, true);
  const out = alignCoachingToTruth({
    headline: 'Mixed directions',
    summary: 'Pieces do not fully come together yet.',
    bullets: [
      'Formality mismatch across items',
      'The pieces complement each other',
    ],
    sameLane: false,
    hasConflict: true,
  }, truth);
  assert.ok(out);
  assert.equal(out!.bullets.some((b) => /complement/i.test(b)), false);
  assert.equal(out!.bullets.some((b) => /formality/i.test(b)), true);
}

{
  const cohesive = buildOutfitTruth({
    belief: belief(),
    feedback: {
      score: 90,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Sport-ready',
        summary: 'works well together',
        bullets: [],
        sameLane: true,
        hasConflict: false,
      },
    },
  });
  const aligned = alignCoachingToTruth({
    headline: 'Sport-ready',
    summary: 'works well together',
    bullets: [
      'The pieces complement each other',
      'Style inconsistency — pieces read like different wardrobes',
    ],
  }, cohesive);
  assert.ok(aligned);
  assert.equal(aligned!.bullets.some((b) => /inconsistenc|different wardrobes/i.test(b)), false);
  assert.equal(aligned!.bullets.some((b) => /complement/i.test(b)), true);
}

{
  const truth = buildOutfitTruth({
    belief: belief(),
    feedback: {
      score: 90,
      issues: [],
      hints: [],
      suggestions: [],
      coaching: {
        headline: 'Sport-ready',
        summary: 'ok',
        bullets: [],
        hasConflict: false,
        sameLane: true,
      },
    },
    now: 1000,
  });
  const stash = stashWarmTruth(truth, 1000);
  assert.ok(stash);
  assert.equal(canWarmStartTruth(stash, 1000 + 500), true);
  assert.equal(canWarmStartTruth(stash, 1000 + LIVE_TRUTH_WARM_MS + 1), false);
  assert.equal(canWarmStartTruth(null), false);
}

console.log('liveOutfitTruth.test.ts: all passed');
