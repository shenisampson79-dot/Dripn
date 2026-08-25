/**
 * Contract 3 — multi-day post-HTTP UI attachment (arity + soft-fail).
 * Run: npx tsx utils/multiDayChatSuccess.test.ts
 */
import assert from 'node:assert/strict';
import {
  MULTI_DAY_GENERATE_FAIL_COPY,
  MULTI_DAY_SUCCESS_FALLBACK_COPY,
  attachMultiDaySuccessMessage,
  resolveMultiDayGenerateUi,
  type AttachWardrobeVisualContract,
  type MultiDayHttpSuccessBody,
} from './multiDayChatSuccess';

const slots = {
  destination: 'Milan',
  tripType: 'mixed',
  datesOrSeason: 'September',
  occasions: 'two business lunches, sightseeing, one nice dinner',
  dayCount: 3,
  occasionsExplicitNone: false,
};

const prior = [{ id: 'u1', role: 'user', content: 'Milan mix September…' }];

const multiOk: MultiDayHttpSuccessBody = {
  content: 'Day 1 smart casual… Day 2… Day 3 evening…',
  hasOutfitRecommendation: true,
  responseType: 'multi',
  lookCount: 3,
  looks: [
    { label: 'Day 1', itemIds: ['49', '59', '84', '122'] },
    { label: 'Day 2', itemIds: ['49', '59', '84', '122'] },
    { label: 'Day 3', itemIds: ['103', '59', '85', '52', '83'] },
  ],
  travelClarify: {
    flow: 'multi_day_travel_clarify',
    state: 'DONE',
    slots,
  },
  wardrobeVisual: {
    layout: 'multi',
    outfits: [{ pieces: [{ id: '49', name: 'Shirt' }] }],
  },
};

const passthroughAttach: AttachWardrobeVisualContract = (
  message,
  _userMessage,
  response,
  _wardrobeItems,
  _tier,
) => ({
  ...message,
  wardrobeVisual: response.wardrobeVisual ?? null,
  visualAuthority: response.visualAuthority ?? 'server',
  hasOutfitRecommendation: response.hasOutfitRecommendation,
  responseType: response.responseType,
  lookCount: response.lookCount,
  looks: response.looks,
});

// --- 1. Successful multi-day response reaches setMessages (messages array) ---
{
  const ui = resolveMultiDayGenerateUi({
    priorMessages: prior,
    result: { ok: true, multi: multiOk },
    userMessage: 'Milan, Mix, September…',
    fallbackSlots: slots,
    wardrobeItems: [{ id: '49', name: 'Shirt' }],
    subscriptionTier: 'core',
    attachFn: passthroughAttach,
    messageId: 'msg_success',
    nowIso: '2026-08-25T08:00:00.000Z',
  });
  assert.equal(ui.usedFailureCopy, false);
  assert.equal(ui.softVisualFail, false);
  assert.equal(ui.messages.length, 2);
  assert.equal(ui.assistantMessage.id, 'msg_success');
  assert.equal(ui.assistantMessage.content, multiOk.content);
  assert.equal(ui.assistantMessage.lookCount, 3);
  assert.equal((ui.assistantMessage.travelClarify as { state: string }).state, 'DONE');
  assert.notEqual(ui.assistantMessage.content, MULTI_DAY_GENERATE_FAIL_COPY);
}

// --- 2. attachWardrobeVisualToMessage receives the correct 5-arg contract ---
{
  let captured: unknown[] | null = null;
  const spy: AttachWardrobeVisualContract = (...args) => {
    captured = args;
    return passthroughAttach(...args);
  };
  const wardrobe = [{ id: '49' }, { id: '59' }];
  attachMultiDaySuccessMessage({
    multi: multiOk,
    userMessage: 'slot reply text',
    fallbackSlots: slots,
    wardrobeItems: wardrobe,
    subscriptionTier: 'premium',
    attachFn: spy,
    messageId: 'msg_args',
  });
  assert.ok(captured, 'attach must be called');
  assert.equal(captured!.length, 5, 'must pass 5 args (message, userMessage, response, wardrobe, tier)');
  const [message, userMessage, response, wardrobeItems, tier] = captured as [
    Record<string, unknown>,
    string,
    Record<string, unknown>,
    unknown[],
    string | null,
  ];
  assert.equal(typeof message, 'object');
  assert.equal(message.role, 'assistant');
  assert.equal(typeof userMessage, 'string');
  assert.equal(userMessage, 'slot reply text');
  assert.equal(typeof response, 'object');
  assert.ok(response.wardrobeVisual, 'response must carry wardrobeVisual');
  assert.equal(response.lookCount, 3);
  assert.ok(Array.isArray(wardrobeItems));
  assert.equal(wardrobeItems.length, 2);
  assert.equal(tier, 'premium');
  // Prove the old 2-arg bug shape is NOT used (2nd arg must not be wardrobe array)
  assert.equal(typeof userMessage === 'string' && !Array.isArray(userMessage), true);
}

// --- 3. If attachment throws, still render server content + multi-day metadata ---
{
  const boom: AttachWardrobeVisualContract = () => {
    throw new TypeError("Cannot read properties of undefined (reading 'wardrobeVisual')");
  };
  const ui = resolveMultiDayGenerateUi({
    priorMessages: prior,
    result: { ok: true, multi: multiOk },
    userMessage: 'Milan…',
    fallbackSlots: slots,
    wardrobeItems: [],
    attachFn: boom,
    messageId: 'msg_soft',
  });
  assert.equal(ui.usedFailureCopy, false, 'must not use HTTP-failure copy');
  assert.equal(ui.softVisualFail, true);
  assert.equal(ui.assistantMessage.content, multiOk.content);
  assert.equal(ui.assistantMessage.lookCount, 3);
  assert.deepEqual(
    (ui.assistantMessage.looks as Array<{ itemIds?: string[] }>).map((l) => l.itemIds),
    multiOk.looks!.map((l) => l.itemIds),
  );
  assert.equal((ui.assistantMessage.travelClarify as { state: string }).state, 'DONE');
  assert.notEqual(ui.assistantMessage.content, MULTI_DAY_GENERATE_FAIL_COPY);
  assert.equal(ui.messages.length, prior.length + 1);
}

// --- 4. HTTP/network failure still uses existing multi-day failure copy ---
{
  const ui = resolveMultiDayGenerateUi({
    priorMessages: prior,
    result: { ok: false },
    userMessage: 'Milan…',
    fallbackSlots: slots,
    wardrobeItems: [],
    attachFn: passthroughAttach,
    messageId: 'msg_fail',
  });
  assert.equal(ui.usedFailureCopy, true);
  assert.equal(ui.softVisualFail, false);
  assert.equal(ui.attachArgs, null);
  assert.equal(ui.assistantMessage.content, MULTI_DAY_GENERATE_FAIL_COPY);
  assert.equal((ui.assistantMessage.travelClarify as { state: string }).state, 'READY');
  assert.deepEqual((ui.assistantMessage.travelClarify as { slots: unknown }).slots, slots);
}

// Empty content falls back to success copy, not fail copy
{
  const ui = resolveMultiDayGenerateUi({
    priorMessages: [],
    result: { ok: true, multi: { lookCount: 2, hasOutfitRecommendation: true } },
    userMessage: 'x',
    fallbackSlots: slots,
    wardrobeItems: [],
    attachFn: passthroughAttach,
  });
  assert.equal(ui.assistantMessage.content, MULTI_DAY_SUCCESS_FALLBACK_COPY);
  assert.equal(ui.usedFailureCopy, false);
}

console.log('multiDayChatSuccess: PASS');

// Source contract: AIStylistScreen must route multi-day success through the helper
// and must not call attachWardrobeVisualToMessage with only (message, wardrobeItems).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const screen = fs.readFileSync(path.join(root, 'screens', 'AIStylistScreen.tsx'), 'utf8');
  assert.match(screen, /resolveMultiDayGenerateUi/, 'screen must use resolveMultiDayGenerateUi');
  assert.doesNotMatch(
    screen,
    /attachWardrobeVisualToMessage\(\{[\s\S]*?\}, wardrobeItems\);/,
    'must not use the broken 2-arg multi-day attach call',
  );
  console.log('multiDayChatSuccess source contract: PASS');
}
