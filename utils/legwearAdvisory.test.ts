/**
 * Launch-bounded Live legwear copy.
 * Run: npx tsx utils/legwearAdvisory.test.ts
 */
import assert from 'node:assert/strict';

import {
  adviseLegwear,
  itemsForLiveScore,
  parseLiveLegwear,
  LIVE_LEGWEAR_MIN_CONFIDENCE,
} from '@/utils/legwearAdvisory';
import { renderCopyFromPublishedTruth } from '@/utils/livePublishedCopy';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';
import type { LiveLegwear } from '@/types/liveStylist';

function item(
  name: string,
  category: string,
  subcategory: string,
  color: string | null = null,
): LiveTruthItem {
  return {
    name,
    category,
    subcategory,
    color,
    confidence: 0.92,
    stability: 0.6,
  };
}

function truth(partial: Partial<LiveOutfitTruth> = {}): LiveOutfitTruth {
  return {
    top: item('White Oxford Shirt', 'tops', 'oxford_shirt', 'white'),
    layer: null,
    bottom: item('Navy Trousers', 'bottoms', 'trousers', 'navy'),
    footwear: item('Brown Loafers', 'shoes', 'loafers', 'brown'),
    lane: 'smart_casual',
    score: 74,
    hasConflict: false,
    isStable: true,
    confidenceLevel: 'high',
    signature: 'oxford_shirt|trousers|loafers',
    timestamp: 1,
    seedDetections: [],
    ...partial,
  };
}

function bullet(t: LiveOutfitTruth, legwear: LiveLegwear | null | undefined) {
  return adviseLegwear({ truth: t, legwear });
}

// 1. confidence 0.79 athletic socks + loafers → no bullet
{
  const line = bullet(truth(), {
    type: 'socks',
    style: 'athletic',
    colour: 'white',
    confidence: 0.79,
  });
  assert.equal(line, null, 'below 0.80 must be silent');
}

// 2. confidence 0.80+ sports socks + loafers + tailored → corrective
{
  const line = bullet(truth(), {
    type: 'socks',
    style: 'athletic',
    colour: 'white',
    confidence: LIVE_LEGWEAR_MIN_CONFIDENCE,
  });
  assert.ok(line);
  assert.match(String(line), /sports socks/i);
  assert.match(String(line), /loafer/i);
  assert.match(String(line), /dress socks|smart/i);
  assert.doesNotMatch(String(line), /trainer/i);
}

// 3. white athletic socks + trainers + sportswear → silent
{
  const line = bullet(truth({
    top: item('Grey T-Shirt', 'tops', 't-shirt', 'grey'),
    bottom: item('Black Athletic Shorts', 'bottoms', 'athletic_shorts', 'black'),
    footwear: item('White Running Trainers', 'shoes', 'trainers', 'white'),
    lane: 'athleisure',
    score: 88,
  }), {
    type: 'socks',
    style: 'athletic',
    colour: 'white',
    confidence: 0.91,
  });
  assert.equal(line, null, 'compatible sport socks stay silent');
}

// 4. black opaque tights + dark dress + boots → silent
{
  const line = bullet(truth({
    top: null,
    bottom: item('Black Midi Dress', 'dresses', 'midi_dress', 'black'),
    footwear: item('Black Boots', 'shoes', 'boots', 'black'),
    lane: 'casual',
    score: 82,
  }), {
    type: 'tights',
    style: 'opaque',
    colour: 'black',
    confidence: 0.9,
  });
  assert.equal(line, null, 'compatible winter tights stay silent');
}

// 5. patterned tights + patterned dress → competing focal point
{
  const line = bullet(truth({
    top: null,
    bottom: item('Floral Print Dress', 'dresses', 'midi_dress', 'floral'),
    footwear: item('Black Heels', 'shoes', 'heels', 'black'),
    lane: 'casual',
    score: 70,
  }), {
    type: 'tights',
    style: 'patterned',
    colour: 'black',
    confidence: 0.88,
  });
  assert.ok(line);
  assert.match(String(line), /focal point|simpler hosiery|dress lead/i);
}

// 6. burgundy tights + neutral outfit → positive accent
{
  const line = bullet(truth({
    top: item('Grey Knit', 'tops', 'sweater', 'grey'),
    bottom: item('Black Skirt', 'bottoms', 'skirt', 'black'),
    footwear: item('Black Boots', 'shoes', 'boots', 'black'),
    lane: 'casual',
    score: 80,
  }), {
    type: 'tights',
    style: 'opaque',
    colour: 'burgundy',
    confidence: 0.86,
  });
  assert.ok(line);
  assert.match(String(line), /burgundy tights/i);
  assert.match(String(line), /accent|neutral/i);
}

// 7. score unchanged when advisory fires
{
  const withSocks = [
    { name: 'White Oxford Shirt', category: 'tops', subcategory: 'oxford_shirt' },
    { name: 'Navy Trousers', category: 'bottoms', subcategory: 'trousers' },
    { name: 'Brown Loafers', category: 'shoes', subcategory: 'loafers' },
    { name: 'White Athletic Socks', category: 'accessories', subcategory: 'socks' },
  ];
  const without = withSocks.slice(0, 3);
  assert.deepEqual(
    itemsForLiveScore(withSocks).map((i) => i.name),
    itemsForLiveScore(without).map((i) => i.name),
    'legwear must not enter the Live score item list',
  );
  const fakeScore = (items: typeof withSocks) => itemsForLiveScore(items).length * 10;
  assert.equal(fakeScore(withSocks), fakeScore(without));

  const base = truth({ score: 74 });
  const fired = { ...base, legwear: {
    type: 'socks' as const,
    style: 'athletic' as const,
    colour: 'white',
    confidence: 0.9,
  } };
  const coaching = {
    headline: 'Nice balance',
    summary: 'White oxford shirt and navy trousers hold a consistent direction.',
    summaryTemplate: '{top} and {bottom} hold a consistent direction.',
    bullets: ['Keep the shirt tucked for a cleaner line.'],
  };
  const a = renderCopyFromPublishedTruth(coaching, base);
  const b = renderCopyFromPublishedTruth(coaching, fired);
  assert.equal(base.score, fired.score);
  assert.equal(a?.headline, b?.headline);
  assert.ok((b?.bullets || []).some((line) => /sports socks/i.test(line)));
  assert.equal((a?.bullets || []).some((line) => /sports socks/i.test(line)), false);
}

// 8. never infer from dark legs / skin-only payload without type
{
  assert.equal(parseLiveLegwear({ colour: 'dark', confidence: 0.95 }), null);
  assert.equal(parseLiveLegwear({ skinTone: 'deep', confidence: 0.99 }), null);
  assert.equal(parseLiveLegwear({ darkLegs: true, confidence: 0.9 }), null);
  assert.equal(parseLiveLegwear({
    type: 'tights',
    inferredFrom: 'dark legs',
    confidence: 0.9,
  }), null);
  assert.equal(bullet(truth(), parseLiveLegwear({ darkLegs: true, confidence: 1 })), null);
}

// 9. type unknown or none without formal suit → silent
{
  assert.equal(bullet(truth({
    top: item('White T-Shirt', 'tops', 't-shirt', 'white'),
    bottom: item('Chino Shorts', 'bottoms', 'chino_shorts', 'khaki'),
    footwear: item('Brown Loafers', 'shoes', 'loafers', 'brown'),
    lane: 'casual',
    score: 78,
  }), { type: 'none', style: 'unknown', confidence: 0.92 }), null);

  assert.equal(bullet(truth(), {
    type: 'unknown',
    style: 'athletic',
    colour: 'white',
    confidence: 0.95,
  }), null);
}

// Formal business + type none at ≥0.80 is allowed (positive no-sock read).
{
  const line = bullet(truth({
    top: item('White Dress Shirt', 'tops', 'dress_shirt', 'white'),
    layer: item('Navy Suit Jacket', 'outerwear', 'blazer', 'navy'),
    bottom: item('Navy Suit Trousers', 'bottoms', 'trousers', 'navy'),
    footwear: item('Black Oxfords', 'shoes', 'oxfords', 'black'),
    lane: 'formal',
    score: 76,
  }), { type: 'none', style: 'unknown', confidence: 0.9 });
  assert.ok(line);
  assert.match(String(line), /sock/i);
}

// Clash summary stays primary; sock line is secondary only.
{
  const clash = truth({
    top: item('White T-Shirt', 'tops', 't-shirt', 'white'),
    bottom: item('Black Athletic Shorts', 'bottoms', 'athletic_shorts', 'black'),
    footwear: item('Brown Loafers', 'shoes', 'loafers', 'brown'),
    lane: 'athleisure',
    score: 48,
    hasConflict: true,
    signature: 't-shirt|athletic_shorts|loafers',
    legwear: {
      type: 'socks',
      style: 'athletic',
      colour: 'white',
      confidence: 0.9,
    },
  });
  const out = renderCopyFromPublishedTruth({
    headline: 'Needs a tweak',
    summary: 'stale',
    summaryTemplate: '{shoes} sit awkwardly with {bottom}.',
    bullets: ['Dressy shoes need smarter bottoms — or swap to trainers with sport shorts.'],
    hasConflict: true,
  }, clash);
  assert.match(out?.summary || '', /sit awkwardly/i);
  const joined = (out?.bullets || []).join(' ');
  assert.match(joined, /sports socks/i);
  assert.equal(
    (out?.bullets || []).filter((b) => /socks?|tights|hosiery/i.test(b)).length,
    1,
  );
}

console.log('legwearAdvisory.test.ts: all passed');
