/**
 * Legacy + canonical Live HUD/copy stay on the same UK display path.
 * Run: npx tsx --test utils/liveDisplayConsistency.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyCanonicalLiveResponse } from './liveCanonicalHud.ts';
import { renderCopyFromPublishedTruth } from './livePublishedCopy.ts';
import {
  polishLiveFeedback,
  polishLiveHudItems,
  polishUkLiveLabel,
} from './liveLocaleLabels.ts';

describe('legacy HUD and coaching stay consistent', () => {
  it('polishes garment labels and coaching with the same helper', () => {
    const serverItems = [
      { name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers' },
      { name: 'Black Pants', category: 'bottoms', subcategory: 'pants' },
      { name: 'Navy Sweatshirt', category: 'tops', subcategory: 'sweatshirt' },
      { name: 'Grey Sweatpants', category: 'bottoms', subcategory: 'sweatpants' },
      { name: 'Beige Quilted Vest', category: 'outerwear', subcategory: 'vest' },
    ];
    const hud = polishLiveHudItems(serverItems);
    const feedback = polishLiveFeedback({
      issues: ['Black pants look busy'],
      suggestions: ['Keep the navy sweatshirt'],
      coaching: {
        headline: 'Looks sharp',
        summary: 'White sneakers, black pants and a beige quilted vest. The overall look is calm.',
        bullets: ['Grey sweatpants stay athletic', 'A yellow sweater would add warmth'],
      },
    });
    assert.equal(hud[0].name, 'White Trainers');
    assert.equal(hud[1].name, 'Black Trousers');
    assert.equal(hud[2].name, 'Navy Sweatshirt');
    assert.equal(hud[3].name, 'Grey Sweatpants');
    assert.equal(hud[4].name, 'Beige Quilted Vest');
    assert.equal(hud[0].subcategory, 'sneakers');
    assert.match(String(feedback?.coaching?.summary), /trainers/i);
    assert.match(String(feedback?.coaching?.summary), /trousers/i);
    assert.match(String(feedback?.coaching?.summary), /quilted vest/i);
    assert.match(String(feedback?.coaching?.summary), /overall look/i);
    assert.doesNotMatch(String(feedback?.coaching?.summary), /dungaree/i);
    assert.doesNotMatch(String(feedback?.coaching?.summary), /waistcoat/i);
    assert.match(String(feedback?.coaching?.bullets?.[1]), /jumper/i);
    assert.match(String(feedback?.suggestions?.[0]), /sweatshirt/i);
    assert.equal(serverItems[0].name, 'White Sneakers');
  });

  it('keeps genuine gym leggings as leggings', () => {
    assert.equal(polishUkLiveLabel('Black Gym Leggings'), 'Black Gym Leggings');
    const hud = polishLiveHudItems([
      { name: 'Black Gym Leggings', category: 'activewear_bottoms', subcategory: 'leggings' },
    ]);
    assert.equal(hud[0].name, 'Black Gym Leggings');
    assert.equal(hud[0].subcategory, 'leggings');
  });

  it('keeps US terminology on legacy HUD and commentary', () => {
    const serverItems = [
      { name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers' },
      { name: 'Black Pants', category: 'bottoms', subcategory: 'pants' },
      { name: 'Yellow Sweater', category: 'tops', subcategory: 'sweater' },
    ];
    const hud = polishLiveHudItems(serverItems, 'US');
    const feedback = polishLiveFeedback({
      issues: ['Black pants look busy'],
      suggestions: ['A yellow sweater would add warmth'],
      coaching: {
        headline: 'Looks sharp',
        summary: 'Yellow sweater, black pants and white sneakers work well together.',
        bullets: ['White Sneakers keep the look easy'],
      },
    }, 'US');
    const copy = renderCopyFromPublishedTruth({
      headline: 'Looks sharp',
      summary: 'Yellow sweater, black pants and white sneakers work well together.',
      summaryTemplate: '{top}, {bottom} and {shoes} work well together.',
      bullets: ['White Sneakers keep the look easy'],
    }, {
      score: 84,
      top: { name: 'Yellow Sweater', category: 'tops', subcategory: 'sweater' },
      bottom: { name: 'Black Pants', category: 'bottoms', subcategory: 'pants' },
      footwear: { name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers' },
      layer: null,
    } as never, 'US');
    assert.equal(hud[0].name, 'White Sneakers');
    assert.equal(hud[1].name, 'Black Pants');
    assert.equal(hud[2].name, 'Yellow Sweater');
    assert.match(String(feedback?.coaching?.summary), /sweater/i);
    assert.match(String(feedback?.coaching?.summary), /pants/i);
    assert.match(String(feedback?.coaching?.summary), /sneakers/i);
    assert.doesNotMatch(String(feedback?.coaching?.summary), /jumper|trousers|trainers/i);
    assert.match(String(copy?.summary), /sweater|pants|sneakers/i);
    assert.doesNotMatch(String(copy?.summary), /jumper|trainers/i);
  });
});

describe('canonical display polish does not rewrite session identity', () => {
  it('leaves publication garment names on the session object', () => {
    const res = {
      liveContractVersion: 2,
      obsSeq: 2,
      publication: { revision: 1, status: 'published' as const },
      liveSession: {
        garments: [{ garmentId: 'g1', displayName: { value: 'White Sneakers' } }],
      },
      items: [{ name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers', bbox: [0.2, 0.7, 0.3, 0.2] }],
      feedback: {
        score: 80,
        coaching: { headline: 'Nice', summary: 'White sneakers and black pants.', bullets: [] },
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
    assert.equal((applied.identityItems[0] as { name: string }).name, 'White Sneakers');
    assert.deepEqual(applied.liveSession, res.liveSession);
  });
});
