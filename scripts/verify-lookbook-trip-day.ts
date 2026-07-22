/**
 * Smoke tests for Travel Capsule / Lite lookbook trip-day math + calendar anchor.
 * Run: npx tsx scripts/verify-lookbook-trip-day.ts
 */
import {
  computeLookbookDayNumber,
  computeLookbookDaysRemaining,
  lookbookDateForDay,
  formatLocalDateKey,
  resolveTripAnchorIso,
  resolveTripEndIso,
  LOOKBOOK_DEFAULT_TOTAL_DAYS,
} from '../utils/lookbookTripDay';
import { assignDayActivities } from '../utils/travelActivityConstraints';
import { resolveTravelTripDays, tripLengthDays, defaultTravelPlan } from '../utils/travelCapsule';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// start Jul 20, today Jul 22 → day 3
const day3 = computeLookbookDayNumber('2026-07-20', new Date(2026, 6, 22), 14);
assert(day3 === 3, `expected day 3 for Jul 20→22, got ${day3}`);

const remaining = computeLookbookDaysRemaining('2026-07-20', new Date(2026, 6, 22), 14);
assert(remaining === 12, `Day 3 of 14 → 12 remaining, got ${remaining}`);

// Trip start must NOT be rewritten to "today" for day math
const todayWall = new Date(2026, 6, 22);
assert(
  computeLookbookDayNumber('2026-07-20', todayWall, 14) !== 1,
  'day index must not stick at Day 1 when trip started earlier',
);

// Calendar projection: day 1 → trip start, not wall-clock today
const day1Date = lookbookDateForDay('2026-07-20', 1);
assert(day1Date != null, 'day 1 date required');
assert(
  formatLocalDateKey(day1Date!) === '2026-07-20',
  `calendar day 1 must be trip start, got ${formatLocalDateKey(day1Date!)}`,
);
const day3Date = lookbookDateForDay('2026-07-20', 3);
assert(
  formatLocalDateKey(day3Date!) === '2026-07-22',
  `calendar day 3 must be Jul 22, got ${formatLocalDateKey(day3Date!)}`,
);

// Shared trip anchor: travelPlan wins; never invent today
assert(
  resolveTripAnchorIso({
    travelPlan: { startDate: '2026-07-20', endDate: '2026-08-02' },
    startDate: '2026-07-22',
  }) === '2026-07-20',
  'resolveTripAnchorIso prefers travelPlan.startDate',
);
assert(
  resolveTripAnchorIso({ startDate: '2026-07-20T15:00:00.000Z' }) === '2026-07-20',
  'resolveTripAnchorIso normalizes ISO startDate',
);
assert(resolveTripAnchorIso(null) === null, 'resolveTripAnchorIso must not invent today');
assert(
  resolveTripEndIso({
    travelPlan: { startDate: '2026-07-20', endDate: '2026-07-27' },
  }) === '2026-07-27',
  'resolveTripEndIso uses user endDate',
);

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

// Product default: missing endDate → start + 13 (14-day capsule), never remap travel onto wall clock
const seeded = defaultTravelPlan({ startDate: '2026-07-20' });
assert(seeded.startDate === '2026-07-20', 'defaultTravelPlan keeps user startDate');
assert(seeded.endDate === '2026-08-02', 'defaultTravelPlan end = start + 13 when end omitted');
assert(seeded.startDate !== formatLocalDateKey(todayWall), 'trip start must not equal wall-clock today');

console.log('verify-lookbook-trip-day: day index + calendar start + return flight placement passed');
