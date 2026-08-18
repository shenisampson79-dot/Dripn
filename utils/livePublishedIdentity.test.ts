/**
 * Run: npx tsx utils/livePublishedIdentity.test.ts
 */
import assert from 'node:assert/strict';

import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';
import type { OutfitBeliefState } from '@/utils/liveGarmentBelief';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';
import {
  adoptCloudIdentityIntoBelief,
  hasPublishedLiveCore,
  liveCloudPathBlockedByYoloProof,
  mapYoloBoxesOntoPublishedTruth,
  sanitizeLiveBoxLabel,
  sanitizeLiveUserHudText,
  yoloWouldOverwritePublishedIdentity,
} from '@/utils/livePublishedIdentity';
import {
  gateLiveScore,
  createLiveScoreGate,
  isHighConfidenceCompleteCloudRead,
} from '@/utils/liveScoreStability';
import { renderCopyFromPublishedTruth } from '@/utils/livePublishedCopy';

function item(
  name: string,
  category: string,
  subcategory: string,
  bbox: [number, number, number, number] = [0.2, 0.2, 0.4, 0.3],
): LiveTruthItem {
  return {
    name,
    category,
    subcategory,
    color: null,
    confidence: 0.92,
    stability: 0.6,
    bbox,
  };
}

function truth(partial: Partial<LiveOutfitTruth> = {}): LiveOutfitTruth {
  return {
    top: item('Black T-Shirt', 'tops', 't-shirt', [0.25, 0.12, 0.4, 0.28]),
    layer: null,
    bottom: item('Grey Athletic Shorts', 'bottoms', 'athletic_shorts', [0.28, 0.42, 0.38, 0.22]),
    footwear: null,
    lane: 'athleisure',
    score: 78,
    hasConflict: false,
    isStable: false,
    confidenceLevel: 'high',
    signature: 't-shirt|athletic_shorts',
    timestamp: 1000,
    seedDetections: [],
    ...partial,
  };
}

function yolo(
  name: string,
  bbox: [number, number, number, number],
  extra: Partial<OnDeviceDetection> = {},
): OnDeviceDetection {
  return {
    name,
    category: 'tops',
    subcategory: 'clothing',
    confidence: 0.9,
    bbox,
    ...extra,
  };
}

{
  assert.equal(
    liveCloudPathBlockedByYoloProof({
      requireYoloProof: false,
      yoloProofOnly: false,
      yoloProven: false,
    }),
    false,
    'Cloud-complete can publish without YOLO proof',
  );
  assert.equal(
    liveCloudPathBlockedByYoloProof({
      requireYoloProof: true,
      yoloProofOnly: false,
      yoloProven: false,
    }),
    true,
  );
  assert.equal(
    isHighConfidenceCompleteCloudRead({
      source: 'cloud_vision',
      items: [
        { category: 'tops', subcategory: 't-shirt', name: 'Black T-Shirt', confidence: 0.95 },
        { category: 'bottoms', subcategory: 'athletic_shorts', name: 'Grey Athletic Shorts', confidence: 0.9 },
      ],
    }),
    true,
  );
  const gated = gateLiveScore(createLiveScoreGate(), 78, {
    signature: 't-shirt|shorts',
    now: 1000,
    settled: false,
    identityLocked: false,
    cloudComplete: true,
  });
  assert.equal(gated.score, 78, 'first Cloud complete read publishes without BELIEF_PROVEN');
}

{
  const published = truth();
  assert.equal(hasPublishedLiveCore(published), true);
  const raw = [
    yolo('Maxi dress PASS', [0.2, 0.08, 0.5, 0.78], { category: 'dresses', subcategory: 'maxi_dress' }),
    yolo('Trousers REJECT:skin_overlap 0.50>0.4 (0.26)', [0.25, 0.4, 0.4, 0.45], {
      category: 'bottoms',
      subcategory: 'trousers',
    }),
  ];
  assert.equal(yoloWouldOverwritePublishedIdentity(raw, published), true);
  const mapped = mapYoloBoxesOntoPublishedTruth(raw, published);
  const blob = mapped.map((d) => d.name).join(' | ').toLowerCase();
  assert.match(blob, /black t-shirt/);
  assert.match(blob, /grey athletic shorts/);
  assert.doesNotMatch(blob, /maxi dress|trousers|reject|skin_overlap/);
}

{
  const leaked = 'Trousers REJECT:skin_overlap 0.50>0.4 (0.26)';
  const hud = sanitizeLiveUserHudText(leaked);
  assert.doesNotMatch(hud, /reject|skin_overlap|0\.50/i);
  const box = sanitizeLiveBoxLabel('Maxi dress REJECT:skin_overlap 0.48 > 0.4 (0.31)');
  assert.doesNotMatch(box, /reject|skin_overlap/i);
}

{
  const out = renderCopyFromPublishedTruth({
    headline: 'Sport-ready',
    summary: 'Black t-shirt and black athletic shorts keep to a consistent colour direction.',
    summaryTemplate: '{top} and {bottom} keep to a consistent colour direction.',
    bullets: [
      'A slim backpack would keep the carry casual and practical',
      'A slim backpack would keep the carry casual and practical',
      'Pair the look with a cap for a sporty touch',
    ],
  }, truth({ score: 78 }));
  assert.match(out?.summary || '', /grey athletic shorts/i);
  assert.doesNotMatch(out?.summary || '', /black athletic shorts/i);
  assert.equal(
    (out?.bullets || []).filter((b) => /slim backpack/i.test(b)).length,
    1,
    'duplicate bullets must collapse',
  );
}

{
  const belief = {
    top: {
      name: 'Black T-Shirt',
      category: 'tops',
      subcategory: 't-shirt',
      color: 'black',
      confidence: 0.97,
      stability: 0.8,
      kind: 'top',
      bbox: [0.25, 0.12, 0.4, 0.28],
      lastSeenAt: 1,
      lastChangedAt: 1,
    },
    bottom: {
      name: 'Black Athletic Shorts',
      category: 'bottoms',
      subcategory: 'athletic_shorts',
      color: 'black',
      confidence: 0.95,
      stability: 0.8,
      kind: 'shorts',
      bbox: [0.28, 0.42, 0.38, 0.22],
      lastSeenAt: 1,
      lastChangedAt: 1,
    },
    layer: null,
    footwear: null,
  } as OutfitBeliefState;
  const adopted = adoptCloudIdentityIntoBelief(belief, [
    { name: 'Black T-Shirt', category: 'tops', subcategory: 't-shirt', confidence: 0.95 },
    { name: 'Grey Athletic Shorts', category: 'bottoms', subcategory: 'athletic_shorts', confidence: 0.9 },
  ]);
  assert.equal(adopted?.bottom?.name, 'Grey Athletic Shorts');
  assert.equal(adopted?.bottom?.color, 'gray');
}

console.log('livePublishedIdentity.test.ts: all passed');
