/**
 * Smoke tests for Travel Capsule / Lite lookbook trip-day math.
 * Run: npx tsx scripts/verify-lookbook-trip-day.ts
 */
import {
  computeLookbookDayNumber,
  computeLookbookDaysRemaining,
  LOOKBOOK_DEFAULT_TOTAL_DAYS,
} from '../utils/lookbookTripDay';
import { assignDayActivities } from '../utils/travelActivityConstraints';
import { resolveTravelTripDays, tripLengthDays } from '../utils/travelCapsule';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// start Jul 20, today Jul 22 → day 3
const day3 = computeLookbookDayNumber('2026-07-20', new Date(2026, 6, 22), 14);
assert(day3 === 3, `expected day 3 for Jul 20→22, got ${day3}`);

const remaining = computeLookbookDaysRemaining('2026-07-20', new Date(2026, 6, 22), 14);
assert(remaining === 12, `Day 3 of 14 → 12 remaining, got ${remaining}`);

// Return flight: 14-day trip → day 14 (index 13); 8-day trip → day 8 (index 7)
const acts14 = assignDayActivities(14, 14, ['explore']);
assert(acts14[0] === 'flight', 'day 1 (index 0) should be outbound Travel Day');
assert(acts14[13] === 'flight', 'day 14 (index 13) should be Return Travel Day');
assert(
  acts14.filter((a) => a === 'flight').length === 2,
  '14-day trip should have exactly two flight days',
);

const acts8 = assignDayActivities(14, 8, ['explore']);
assert(acts8[0] === 'flight', '8-day trip day 1 should be flight');
assert(acts8[7] === 'flight', '8-day trip day 8 (index 7) should be Return Travel Day');
assert(acts8[8] !== 'flight', 'day 9 should not be a return flight when trip is 8 days');

assert(tripLengthDays('2026-07-20', '2026-08-02') === 14, 'Jul 20–Aug 2 inclusive = 14');
assert(tripLengthDays('2026-07-20', '2026-07-27') === 8, 'Jul 20–27 inclusive = 8');

assert(
  resolveTravelTripDays({ startDate: '2026-07-20', endDate: '2026-07-27', tripDays: 14 }) === 8,
  'resolveTravelTripDays prefers endDate − startDate over stale tripDays',
);
assert(
  resolveTravelTripDays({ tripDays: 7 }) === 7,
  'resolveTravelTripDays falls back to tripDays when dates missing',
);
assert(
  resolveTravelTripDays(null) === LOOKBOOK_DEFAULT_TOTAL_DAYS,
  'resolveTravelTripDays defaults to 14-day capsule',
);

console.log('verify-lookbook-trip-day: day index + return flight placement passed');
