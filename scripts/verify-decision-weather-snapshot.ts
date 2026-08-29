/**
 * Decisions weather snapshot — client contract + freshness.
 * Run: npx tsx scripts/verify-decision-weather-snapshot.ts
 */
import assert from 'node:assert/strict';

import {
  DECISION_WEATHER_MAX_AGE_MS,
  isFreshDecisionWeatherSnapshot,
  shouldAttachDeviceWeatherForDecision,
  weatherConditionToDecisionSnapshot,
} from '../utils/decisionWeatherSnapshot';

console.log('=== verify-decision-weather-snapshot ===\n');

const now = Date.now();

const snapshot = weatherConditionToDecisionSnapshot(
  {
    temperature: 17,
    feelsLike: 16,
    condition: 'rainy',
    description: 'Light rain',
    humidity: 80,
    windSpeed: 12,
    location: 'London',
    timestamp: now,
  },
  { lat: 51.5, lon: -0.12 },
);

assert.equal(snapshot.source, 'live');
assert.equal(snapshot.temperatureC, 17);
assert.equal(snapshot.conditions, 'Rain');
assert.equal(snapshot.latitude, 51.5);
assert.ok(isFreshDecisionWeatherSnapshot(snapshot));
console.log('✓ maps WeatherService condition to live snapshot');

assert.equal(
  isFreshDecisionWeatherSnapshot({
    ...snapshot,
    observedAt: now - DECISION_WEATHER_MAX_AGE_MS - 1,
  }),
  false,
);
console.log('✓ rejects stale snapshots');

assert.equal(shouldAttachDeviceWeatherForDecision('sanity-check'), true);
assert.equal(shouldAttachDeviceWeatherForDecision('event-outfit', ''), true);
assert.equal(shouldAttachDeviceWeatherForDecision('event-outfit', 'Cardiff'), false);
assert.equal(shouldAttachDeviceWeatherForDecision('shopping'), false);
console.log('✓ attach rules for QSC / Event / Shopping');

console.log('\n✅ Decision weather snapshot verified\n');
