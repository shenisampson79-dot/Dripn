/**
 * UK Live display polish.
 * Run: npx tsx utils/liveLocaleLabels.test.ts
 */
import assert from 'node:assert/strict';
import {
  LIVE_LOCALE,
  localizedShoeKind,
  polishLiveFeedback,
  polishLiveHudItems,
  polishUkLiveLabel,
  resolveLiveDisplayLocale,
} from './liveLocaleLabels';

assert.equal(LIVE_LOCALE, 'UK');
assert.equal(localizedShoeKind('sneakers'), 'trainers');
assert.equal(polishUkLiveLabel('White Pants'), 'White Trousers');
assert.equal(polishUkLiveLabel('Gray Sweatpants'), 'Grey Sweatpants');
assert.equal(polishUkLiveLabel('Black Track Pants'), 'Black Track Pants');
assert.equal(polishUkLiveLabel('Navy Yoga Pants'), 'Navy Yoga Pants');
assert.equal(polishUkLiveLabel('Pink Pyjama Pants'), 'Pink Pyjama Pants');
assert.equal(polishUkLiveLabel('Pink Pajama Pants'), 'Pink Pajama Pants');
assert.equal(polishUkLiveLabel('White and Red Sneakers'), 'White and Red Trainers');
assert.equal(polishUkLiveLabel('Gray Trousers'), 'Grey Trousers');
assert.equal(polishUkLiveLabel('Grey Sweatpants'), 'Grey Sweatpants');
assert.equal(polishUkLiveLabel('Navy Sweatshirt'), 'Navy Sweatshirt');
assert.equal(polishUkLiveLabel('Yellow Sweater'), 'Yellow Jumper');
assert.equal(polishUkLiveLabel('Blue Denim Overalls'), 'Blue Denim Dungarees');
assert.equal(polishUkLiveLabel('The overall look is sharp'), 'The overall look is sharp');
assert.equal(polishUkLiveLabel('Beige Quilted Vest'), 'Beige Quilted Vest');
assert.equal(polishUkLiveLabel('Navy Gilet'), 'Navy Gilet');
assert.equal(polishUkLiveLabel('Navy Suit Vest'), 'Navy Suit Waistcoat');
assert.equal(polishUkLiveLabel('White Sneakers', 'US'), 'White Sneakers');
assert.equal(polishLiveHudItems([{ name: 'White Sneakers' }], 'US')[0].name, 'White Sneakers');
assert.equal(polishLiveFeedback({
  coaching: { summary: 'White sneakers and black pants.' },
}, 'US')?.coaching?.summary, 'White sneakers and black pants.');

assert.equal(resolveLiveDisplayLocale({ countryCode: 'GB' }), 'UK');
assert.equal(resolveLiveDisplayLocale({ country: 'United States' }), 'US');
assert.equal(resolveLiveDisplayLocale({ deviceLanguageTags: ['en-US'] }), 'US');
assert.equal(resolveLiveDisplayLocale({ countryCode: 'GB', deviceLanguageTags: ['en-US'] }), 'UK');
assert.equal(resolveLiveDisplayLocale({}), 'UK');

const hud = polishLiveHudItems([
  { name: 'White Sneakers', category: 'shoes', subcategory: 'sneakers' },
  { name: 'Black Pants', category: 'bottoms', subcategory: 'pants' },
]);
assert.equal(hud[0].name, 'White Trainers');
assert.equal(hud[1].name, 'Black Trousers');
assert.equal(hud[0].subcategory, 'sneakers');
assert.equal(hud[1].subcategory, 'pants');

const coaching = polishLiveFeedback({
  issues: ['Navy Pants look busy'],
  hints: ['White Sneakers keep it casual'],
  suggestions: ['A yellow sweater would add warmth'],
  coaching: {
    headline: 'Looks sharp',
    summary: 'Yellow sweater, black pants and white sneakers work well together.',
    bullets: ['The colour direction matches your autumn palette'],
  },
});
assert.match(String(coaching?.coaching?.summary), /jumper/i);
assert.match(String(coaching?.coaching?.summary), /trousers/i);
assert.match(String(coaching?.coaching?.summary), /trainers/i);
assert.match(String(coaching?.suggestions?.[0]), /jumper/i);
assert.doesNotMatch(String(coaching?.coaching?.summary), /sweater|pants|sneakers/i);

console.log('liveLocaleLabels.test.ts: all passed');
