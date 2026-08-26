/**
 * Run: npx tsx utils/livePublishedCopy.test.ts
 */
import assert from 'node:assert/strict';

import {
  publishedTruthNames,
  renderCopyFromPublishedTruth,
} from '@/utils/livePublishedCopy';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';

function item(
  name: string,
  category: string,
  subcategory: string,
): LiveTruthItem {
  return {
    name,
    category,
    subcategory,
    color: null,
    confidence: 0.92,
    stability: 0.5,
  };
}

function truth(partial: Partial<LiveOutfitTruth> = {}): LiveOutfitTruth {
  return {
    top: item('White T-Shirt', 'tops', 't-shirt'),
    layer: null,
    bottom: item('Black Athletic Shorts', 'bottoms', 'athletic_shorts'),
    footwear: item('Red and White Boat Shoes', 'shoes', 'boat_shoes'),
    lane: 'athleisure',
    score: 88,
    hasConflict: false,
    isStable: false,
    confidenceLevel: 'medium',
    signature: 't-shirt|athletic_shorts|boat_shoes',
    timestamp: 1000,
    seedDetections: [],
    ...partial,
  };
}

{
  const names = publishedTruthNames(truth());
  assert.equal(names.top, 'White T-Shirt');
  assert.equal(names.bottom, 'Black Athletic Shorts');
  assert.equal(names.shoes, 'Red and White Boat Shoes');
}

// Renderer uses published truth fields only — not raw Cloud / previous frame / YOLO-only.
{
  const out = renderCopyFromPublishedTruth({
    headline: 'Sport-ready',
    summary: 'Charcoal top and grey trousers and brown loafers sit in the same lane.',
    summaryTemplate: '{top} and {bottom} work well together and {shoes} lift the look.',
    bullets: [
      'Brown loafers ground the look',
      'Charcoal top keeps the contrast',
      'Simple structure is coming into focus.',
    ],
  }, truth());
  assert.match(out?.summary || '', /white t-shirt/i);
  assert.match(out?.summary || '', /black athletic shorts/i);
  assert.match(out?.summary || '', /boat shoes/i);
  assert.doesNotMatch(out?.summary || '', /charcoal|grey trousers|brown loafers/i);
  assert.equal(
    (out?.bullets || []).some((b) => /loafer|charcoal/i.test(b)),
    false,
    'bullets must not keep stale Cloud / YOLO-only names',
  );
}

// Unresolved footwear: copy must not mention footwear.
{
  const out = renderCopyFromPublishedTruth({
    headline: 'Looking good',
    summary: 'White T-Shirt and Black Athletic Shorts work well together and Brown Boots ground the look.',
    summaryTemplate: '{top} and {bottom} work well together and {shoes} ground the look.',
    bullets: ['Brown boots finish the look', 'The palette stays consistent.'],
  }, truth({ footwear: null }));
  assert.match(out?.summary || '', /white t-shirt/i);
  assert.match(out?.summary || '', /black athletic shorts/i);
  assert.doesNotMatch(out?.summary || '', /boot|shoe|loafer|trainer|footwear/i);
  assert.equal(
    (out?.bullets || []).some((b) => /boot|shoe|loafer/i.test(b)),
    false,
  );
}

// Shorts published as shoes must not appear as footwear copy.
{
  const out = renderCopyFromPublishedTruth({
    headline: 'Sport-ready',
    summary: 'White T-Shirt and Black Athletic Shorts and Black Athletic Shorts work well together.',
    summaryTemplate: '{top} and {bottom} work well together and {shoes} ground the look.',
    bullets: ['Black Athletic Shorts finish the look'],
  }, truth({
    footwear: item('Black Athletic Shorts', 'shoes', 'sneakers'),
  }));
  assert.doesNotMatch(out?.summary || '', /ground the look/i);
  assert.equal(publishedTruthNames(truth({
    footwear: item('Black Athletic Shorts', 'shoes', 'sneakers'),
  })).shoes, undefined);
}

// No template: synthesize from published names, still ignore raw Cloud.
{
  const out = renderCopyFromPublishedTruth({
    headline: 'Looking good',
    summary: 'A leftover Cloud sentence about grey sweatpants and loafers.',
    bullets: [],
  }, truth({ footwear: null, score: 90 }));
  assert.match(out?.summary || '', /white t-shirt/i);
  assert.match(out?.summary || '', /black athletic shorts/i);
  assert.doesNotMatch(out?.summary || '', /sweatpants|loafer|cloud/i);
}

// Published colour wins — grey shorts must not render as black.
{
  const grey = truth({
    bottom: item('Grey Athletic Shorts', 'bottoms', 'athletic_shorts'),
    footwear: null,
    score: 78,
  });
  const out = renderCopyFromPublishedTruth({
    headline: 'Sport-ready',
    summary: 'Black t-shirt and black athletic shorts keep to a consistent colour direction.',
    summaryTemplate: '{top} and {bottom} keep to a consistent colour direction.',
    bullets: [
      'A slim backpack would keep the carry casual and practical',
      'A slim backpack would keep the carry casual and practical',
    ],
  }, grey);
  assert.match(out?.summary || '', /grey athletic shorts/i);
  assert.doesNotMatch(out?.summary || '', /black athletic shorts/i);
  assert.equal((out?.bullets || []).length, 1, 'duplicate bullets collapse');
}

// Athletic shorts + loafers: name the footwear clash, not tee vs shorts / palette praise.
{
  const clash = truth({
    top: item('Grey T-Shirt', 'tops', 't-shirt'),
    bottom: item('Black Athletic Shorts', 'bottoms', 'athletic_shorts'),
    footwear: item('Black Loafers', 'shoes', 'loafers'),
    score: 47,
    hasConflict: true,
    signature: 't-shirt|athletic_shorts|loafers',
  });
  const out = renderCopyFromPublishedTruth({
    headline: 'Needs a tweak',
    summary: 'The direction of grey t-shirt conflicts with black athletic shorts.',
    summaryTemplate: 'The direction of {top} conflicts with {bottom}.',
    bullets: [
      'These pieces pull in different directions — keep tops, bottoms, and shoes in one style lane',
      'Mixes athleisure with smart casual — different style worlds',
    ],
  }, clash);
  assert.match(out?.summary || '', /loafer/i);
  assert.match(out?.summary || '', /athletic shorts/i);
  assert.doesNotMatch(out?.summary || '', /direction of grey t-shirt conflicts/i);
  assert.equal(
    (out?.bullets || []).some((b) => /garment subtypes|pairing rules/i.test(b)),
    false,
    'engineering jargon bullets must not paint',
  );

  const jargonOnly = renderCopyFromPublishedTruth({
    headline: 'Needs a tweak',
    summary: 'Black loafers sit awkwardly with black athletic shorts.',
    bullets: ['Garment subtypes clash — lanes or pairing rules conflict'],
  }, clash);
  assert.equal(
    (jargonOnly?.bullets || []).some((b) => /garment subtypes|pairing rules/i.test(b)),
    false,
  );

  const palette = renderCopyFromPublishedTruth({
    headline: 'Needs a tweak',
    summary: 'The palette stays consistent across grey t-shirt and black athletic shorts.',
    summaryTemplate: 'The palette stays consistent across {top} and {bottom}.',
    bullets: ['Keeps the look relaxed and casual'],
  }, clash);
  assert.match(palette?.summary || '', /loafer/i);
  assert.doesNotMatch(palette?.summary || '', /palette stays|colour direction/i);
  assert.equal(
    (palette?.bullets || []).some((b) => /relaxed and casual/i.test(b)),
    false,
  );
}

console.log('livePublishedCopy.test.ts: all passed');
