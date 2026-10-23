/**
 * Chat create: inferred casual_day/weekend is not sent as occasionOverride.
 * Run: npx tsx scripts/verify-chat-create-occasion-override.ts
 */
import assert from 'node:assert/strict';
import {
  inferOutfitOccasionFromAsk,
  chatCreateOccasionOverrideFromAsk,
} from '../utils/inferOutfitOccasionFromAsk';
import { resolveTierBStructuredOccasion } from '../utils/outfitClarifyContinuity';

const PHIL = "I'm going to the cinema tomorrow. Please check the weather and give me an outfit to wear.";

assert.equal(inferOutfitOccasionFromAsk(PHIL), 'casual_day');
assert.equal(chatCreateOccasionOverrideFromAsk(PHIL), undefined);

assert.equal(
  inferOutfitOccasionFromAsk("I'm going to the theatre on Saturday."),
  'evening_out',
);
assert.equal(
  chatCreateOccasionOverrideFromAsk("I'm going to the theatre on Saturday."),
  'evening_out',
);

assert.equal(
  chatCreateOccasionOverrideFromAsk('I have a job interview Monday morning.'),
  'work_outfit',
);
assert.equal(
  chatCreateOccasionOverrideFromAsk("I'm meeting friends for lunch."),
  undefined,
);
assert.equal(
  chatCreateOccasionOverrideFromAsk("I'm going on a date tonight."),
  'date_night',
);
assert.equal(
  chatCreateOccasionOverrideFromAsk('Find me something to wear.'),
  undefined,
);
assert.equal(
  chatCreateOccasionOverrideFromAsk("I'm going for a walk this afternoon."),
  undefined,
);

assert.equal(resolveTierBStructuredOccasion('a little smarter'), 'evening_out');
assert.equal(resolveTierBStructuredOccasion('somewhere nicer'), 'evening_out');
assert.equal(resolveTierBStructuredOccasion("For the cinema tomorrow, say 'somewhere nicer' if you'd like a smarter outfit."), 'evening_out');
assert.equal(resolveTierBStructuredOccasion('yes'), null);
assert.equal(resolveTierBStructuredOccasion('Lunch or drinks'), 'smart_casual');
assert.equal(resolveTierBStructuredOccasion('Relaxed everyday — coffee and a walk'), null);

console.log('verify-chat-create-occasion-override: ok');
