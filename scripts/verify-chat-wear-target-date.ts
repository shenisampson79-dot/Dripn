/**
 * Chat wear-target / StyleSession date resolution.
 * Run: npx tsx scripts/verify-chat-wear-target-date.ts
 */
import assert from 'node:assert/strict';
import {
  buildStyleSession,
  resolveWearTargetFromChat,
  wearCtaLabels,
  wearTargetFromSession,
} from '../utils/chatWearTargetDate.ts';

// Fixed: Tue afternoon 2026-07-28 UTC
const now = new Date('2026-07-28T15:00:00.000Z');

const tomorrow = resolveWearTargetFromChat(
  'Give me outfit suggestions to wear to meet a friend for afternoon drinks tomorrow',
  '',
  now,
);
assert.equal(tomorrow.kind, 'tomorrow');
assert.equal(tomorrow.markAsWornToday, false);
assert.equal(tomorrow.dayLabel, 'tomorrow');
assert.match(String(tomorrow.dateKey), /^\d{4}-\d{2}-\d{2}$/);

const today = resolveWearTargetFromChat(
  'what should I wear later today for drinks',
  '',
  now,
);
assert.equal(today.kind, 'today');
assert.equal(today.markAsWornToday, true);
assert.ok(today.dateKey);

const friday = resolveWearTargetFromChat('outfit for drinks on Friday', '', now);
assert.equal(friday.kind, 'date');
assert.equal(friday.markAsWornToday, false);
assert.equal(friday.dayLabel, 'Friday');

const unspecified = resolveWearTargetFromChat(
  'give me some outfit suggestions',
  '',
  now,
);
assert.equal(unspecified.kind, 'unspecified');
assert.equal(unspecified.markAsWornToday, false);
assert.equal(unspecified.dateKey, null);

const session = buildStyleSession({
  userMessage: 'outfit suggestions for tomorrow drinks',
  assistantContent: 'Here are three looks',
  intent: 'multi_look',
  now,
});
assert.equal(session.targetDate, tomorrow.dateKey);
assert.equal(session.kind, 'tomorrow');
assert.equal(session.occasion, 'drinks');

// Session frozen — re-deriving from empty alt selection must not be needed;
// wearTargetFromSession keeps the same date.
const frozen = wearTargetFromSession(session);
assert.equal(frozen.dateKey, session.targetDate);
assert.equal(frozen.markAsWornToday, false);

const labels = wearCtaLabels(tomorrow, { isPrimary: true, isCommitted: false });
assert.equal(labels.primary, 'Wear tomorrow');
assert.equal(labels.resolvedAction, 'plan');
assert.match(labels.confirmBody, /tomorrow/i);
assert.equal(labels.heroBadgeHint, 'Best for tomorrow');

const committed = wearCtaLabels(tomorrow, { isPrimary: true, isCommitted: true });
assert.equal(committed.committed, 'Planned for tomorrow');

const fridayLabels = wearCtaLabels(friday, { isPrimary: true, isCommitted: false });
assert.equal(fridayLabels.primary, 'Plan for Friday');
assert.equal(fridayLabels.resolvedAction, 'plan');

const saveLabels = wearCtaLabels(unspecified, { isPrimary: true, isCommitted: false });
assert.equal(saveLabels.primary, 'Save look');
assert.equal(saveLabels.resolvedAction, 'save');

const wearToday = wearCtaLabels(today, { isPrimary: true, isCommitted: false });
assert.equal(wearToday.primary, 'Wear this');
assert.equal(wearToday.resolvedAction, 'wear_today');

console.log('verify-chat-wear-target-date: passed', {
  tomorrow: tomorrow.dateKey,
  today: today.dateKey,
  friday: friday.dateKey,
  sessionDate: session.targetDate,
});
