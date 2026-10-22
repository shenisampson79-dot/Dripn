/**
 * Chat-only cinema occasion + forecast-slot helpers.
 * Run: npx tsx scripts/verify-chat-outfit-when.ts
 * No live weather calls.
 */
import assert from 'node:assert/strict';
import { inferOutfitOccasionFromAsk } from '../utils/inferOutfitOccasionFromAsk';
import {
  fetchChatOutfitForecast,
  hourForTimePeriod,
  inferChatCinemaOccasion,
  parseChatOutfitWhen,
  pickHourlyForecastSample,
  snapshotFromHourlySample,
} from '../utils/chatOutfitWhen';

const cinemaNight = "I'm going to the movies tomorrow night, please check the weather and give me an outfit to wear.";
assert.equal(inferOutfitOccasionFromAsk(cinemaNight), 'evening_out');
assert.equal(inferChatCinemaOccasion(cinemaNight), 'evening_out');
assert.equal(inferOutfitOccasionFromAsk('What should I wear to the cinema this afternoon?'), 'casual_day');
assert.equal(inferChatCinemaOccasion('What should I wear to the cinema this afternoon?'), null);
assert.equal(inferOutfitOccasionFromAsk('Going to the movies'), 'casual_day');
assert.equal(inferOutfitOccasionFromAsk('Create an outfit for the park'), 'casual_day');

const now = new Date('2026-10-22T10:00:00.000Z');
const when = parseChatOutfitWhen(cinemaNight, now);
assert.equal(when.kind, 'tomorrow');
assert.equal(when.timePeriod, 'evening');
assert.equal(when.periodKind, 'forecast_slot');
assert.equal(when.usesCurrentWeather, false);
assert.equal(when.dateKey, '2026-10-23');
assert.equal(hourForTimePeriod('evening'), 19);

const todayEveningLate = parseChatOutfitWhen('outfit for tonight', new Date('2026-10-22T19:30:00+01:00'));
assert.equal(todayEveningLate.kind, 'today');
assert.equal(todayEveningLate.usesCurrentWeather, true);

const hourly = {
  time: [
    '2026-10-23T12:00',
    '2026-10-23T19:00',
    '2026-10-24T19:00',
  ],
  temperature_2m: [14, 7, 99],
  precipitation_probability: [10, 20, 0],
  weather_code: [1, 3, 0],
};
const sample = pickHourlyForecastSample(hourly, { dateKey: '2026-10-23', timePeriod: 'evening' });
assert.equal(sample?.temperature, 7);
assert.equal(sample?.hour, 19);
const snap = snapshotFromHourlySample(sample, when);
assert.equal(snap?.applicableToRequest, true);
assert.equal(snap?.periodKind, 'forecast_slot');
assert.equal(snap?.temperature, 7);
assert.notEqual(snap?.temperature, 14);

async function main() {
  const missing = await fetchChatOutfitForecast({
    lat: 51.5,
    lon: -0.1,
    when,
    fetchImpl: async () => {
      throw new Error('network disabled in test');
    },
  });
  assert.equal(missing.forecastUnavailable, true);
  assert.equal(missing.applicableToRequest, false);
  assert.equal(missing.temperature, undefined);
  console.log('verify-chat-outfit-when: PASS');
}

void main();
