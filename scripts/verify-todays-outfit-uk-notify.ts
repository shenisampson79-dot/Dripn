/**
 * UK timezone + style memory smoke checks.
 * Run: npx tsx scripts/verify-todays-outfit-uk-notify.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  dateKeyInTimeZone,
  getHourInTimeZone,
  nextDateAtHourInTimeZone,
  TODAYS_OUTFIT_TIMEZONE,
} from '../utils/todaysOutfitTime';
import { isWithinTodaysOutfitPopupWindow } from '../utils/todaysOutfitPrefs';

console.log('=== Today outfit UK time + notify wiring ===\n');

assert.equal(TODAYS_OUTFIT_TIMEZONE, 'Europe/London');

const winter = new Date('2026-01-15T10:30:00.000Z'); // 10:30 UTC = 10:30 London
assert.equal(getHourInTimeZone(winter, 'Europe/London'), 10);
assert.equal(dateKeyInTimeZone(winter, 'Europe/London'), '2026-01-15');

const summer = new Date('2026-07-15T07:30:00.000Z'); // 07:30 UTC = 08:30 BST
assert.equal(getHourInTimeZone(summer, 'Europe/London'), 8);

const prefs = { enabled: true, appearAtHour: 8, preferredOccasion: 'auto' as const };
assert.equal(isWithinTodaysOutfitPopupWindow(prefs, summer), true);
assert.equal(
  isWithinTodaysOutfitPopupWindow(prefs, new Date('2026-07-15T06:30:00.000Z')),
  false,
);

const next = nextDateAtHourInTimeZone(8, 'Europe/London', summer);
assert.ok(next.getTime() > summer.getTime(), 'next fire must be in the future');
assert.equal(getHourInTimeZone(next, 'Europe/London'), 8);

const notifySrc = readFileSync(
  resolve(__dirname, '../services/todaysOutfitLocalNotify.ts'),
  'utf8',
);
assert.ok(notifySrc.includes('SchedulableTriggerInputTypes.DATE'), 'must schedule DATE trigger');
assert.ok(notifySrc.includes('Europe/London') || notifySrc.includes('TODAYS_OUTFIT_TIMEZONE'));

const memorySrc = readFileSync(resolve(__dirname, '../utils/styleMemory7d.ts'), 'utf8');
assert.ok(memorySrc.includes('analyzeRotationVsYesterday'));

console.log('All UK time + notify checks passed.\n');
