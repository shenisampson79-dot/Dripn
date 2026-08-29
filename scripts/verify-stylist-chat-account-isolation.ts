/**
 * P1 — Stylist Chat account isolation on auth transitions.
 * Run: npx tsx scripts/verify-stylist-chat-account-isolation.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  __resetStylistChatAccountSessionForTests,
  beginStylistChatHydrate,
  establishStylistChatAccountSession,
  getActiveStylistChatUserId,
  getCachedStylistChatMessagesSync,
  isStylistChatHydrateCurrent,
  isStylistChatSessionActive,
  rememberStylistChatMessages,
  relinquishStylistChatAccountSession,
  resumeStylistChatSession,
  shouldPreserveStylistChatLocal,
  STYLIST_CHAT_STORAGE_KEY,
  STYLIST_DAILY_MESSAGES_KEY,
  STYLIST_PENDING_RETRY_KEY,
} from '../utils/stylistChatAccountSession';
import { STYLIST_CHAT_CLEARED_TOMBSTONE_KEY } from '../utils/stylistFreshThread';
import {
  applyServerHydrateMerge,
  evaluateServerHydrateAcceptance,
  mapServerChatHistoryRows,
} from '../utils/stylistChatServerHydrate';

const root = dirname(fileURLToPath(import.meta.url));

const msgA = {
  id: 'a_user_1',
  role: 'user' as const,
  content: 'Sharon-only message',
  timestamp: new Date().toISOString(),
};

const msgB = {
  id: 'b_user_1',
  role: 'user' as const,
  content: 'Phil-only message',
  timestamp: new Date().toISOString(),
};

async function run(): Promise<void> {
// CASE 1 — A → logout → B
{
  __resetStylistChatAccountSessionForTests();
  resumeStylistChatSession('user-a');
  rememberStylistChatMessages([msgA]);
  await relinquishStylistChatAccountSession();
  assert.equal(getCachedStylistChatMessagesSync(), null);
  assert.equal(getActiveStylistChatUserId(), null);
  await establishStylistChatAccountSession('user-b', { preserveLocal: false });
  assert.equal(getActiveStylistChatUserId(), 'user-b');
  assert.equal(getCachedStylistChatMessagesSync(), null);
  const genB = beginStylistChatHydrate('user-b');
  assert.equal(isStylistChatHydrateCurrent(genB, 'user-b'), true);
  assert.equal(isStylistChatSessionActive('user-a'), false);
}

// CASE 2 — B → logout → A (reverse)
{
  __resetStylistChatAccountSessionForTests();
  resumeStylistChatSession('user-b');
  rememberStylistChatMessages([msgB]);
  await relinquishStylistChatAccountSession();
  await establishStylistChatAccountSession('user-a', { preserveLocal: false });
  assert.equal(getCachedStylistChatMessagesSync(), null);
  assert.equal(getActiveStylistChatUserId(), 'user-a');
}

// CASE 3 — stale async race: A hydrate invalidated when B becomes active
{
  __resetStylistChatAccountSessionForTests();
  const genA = beginStylistChatHydrate('user-a');
  assert.equal(isStylistChatHydrateCurrent(genA, 'user-a'), true);
  await establishStylistChatAccountSession('user-b', { preserveLocal: false });
  assert.equal(isStylistChatHydrateCurrent(genA, 'user-a'), false);
  assert.equal(isStylistChatHydrateCurrent(genA, 'user-b'), false);
  const genB = beginStylistChatHydrate('user-b');
  assert.equal(isStylistChatHydrateCurrent(genB, 'user-b'), true);
}

// CASE 4 — same-user session resume preserves local memory cache
{
  __resetStylistChatAccountSessionForTests();
  rememberStylistChatMessages([msgA]);
  await establishStylistChatAccountSession('user-a', { preserveLocal: true });
  assert.equal(getActiveStylistChatUserId(), 'user-a');
  assert.equal(getCachedStylistChatMessagesSync()?.[0]?.content, 'Sharon-only message');
  assert.equal(shouldPreserveStylistChatLocal('user-a', 'user-a'), true);
  assert.equal(shouldPreserveStylistChatLocal('user-a', 'user-b'), false);
}

// CASE 5 — clear-chat + auth reset wiring still present in product code
{
  const screen = readFileSync(join(root, '../screens/AIStylistScreen.tsx'), 'utf8');
  const auth = readFileSync(join(root, '../contexts/AuthContext.tsx'), 'utf8');
  assert.match(screen, /const clearChat = async \(\) =>/);
  assert.match(screen, /apiService\.clearChatHistory\(stylistId\)/);
  assert.match(
    screen,
    /import[\s\S]*STYLIST_CHAT_STORAGE_KEY[\s\S]*from '@\/utils\/stylistChatAccountSession'/,
    'AIStylistScreen must import canonical STYLIST_CHAT_STORAGE_KEY',
  );
  assert.match(
    screen,
    /import[\s\S]*STYLIST_DAILY_MESSAGES_KEY[\s\S]*from '@\/utils\/stylistChatAccountSession'/,
    'AIStylistScreen must import canonical STYLIST_DAILY_MESSAGES_KEY',
  );
  assert.doesNotMatch(
    screen,
    /STYLIST_STYLIST_/,
    'AIStylistScreen must not reference typo storage constant names',
  );
  assert.match(auth, /relinquishStylistChatAccountSession/);
  assert.match(auth, /transitionStylistChatSessionForAuth/);
  assert.match(auth, /resumeStylistChatSession/);
  assert.doesNotMatch(
    screen,
    /if \(threadHasUserMessage\(getCachedStylistChatMessagesSync\(\)/,
    'server hydrate must not be suppressed by stale global cache',
  );
}

// CASE 6 — same-user logout/reset → re-auth → mocked server history accepted
{
  __resetStylistChatAccountSessionForTests();
  resumeStylistChatSession('user-sharon');
  rememberStylistChatMessages([msgA]);
  await relinquishStylistChatAccountSession();
  assert.equal(getCachedStylistChatMessagesSync(), null);
  await establishStylistChatAccountSession('user-sharon', { preserveLocal: false });
  assert.equal(getActiveStylistChatUserId(), 'user-sharon');
  assert.equal(getCachedStylistChatMessagesSync(), null);

  const sessionGen = beginStylistChatHydrate('user-sharon');
  assert.equal(isStylistChatHydrateCurrent(sessionGen, 'user-sharon'), true);
  assert.equal(isStylistChatSessionActive('user-sharon'), true);

  const mockedServerRows = [
    {
      id: 101,
      role: 'user' as const,
      content: 'Sharon prior ask',
      createdAt: '2026-08-29T08:00:00.000Z',
    },
    {
      id: 102,
      role: 'assistant' as const,
      content: 'Sharon prior reply',
      createdAt: '2026-08-29T08:00:01.000Z',
    },
  ];
  const mapped = mapServerChatHistoryRows(mockedServerRows);
  assert.equal(evaluateServerHydrateAcceptance(mapped), 'accepted');
  assert.equal(mapped.some((m) => m.role === 'user'), true);

  const seedOnly = [
    {
      id: 'msg_seed_init',
      role: 'assistant' as const,
      content: 'Hello!',
      timestamp: new Date().toISOString(),
    },
  ];
  const merged = applyServerHydrateMerge(seedOnly, mapped);
  assert.equal(merged.some((m) => m.content === 'Sharon prior ask'), true);
  assert.equal(merged.some((m) => m.content === 'Sharon prior reply'), true);
  assert.equal(isStylistChatHydrateCurrent(sessionGen, 'user-sharon'), true);
}

// Storage keys remain canonical (reset targets documented in session module)
assert.equal(STYLIST_CHAT_STORAGE_KEY, '@dripn_ai_stylist_chat');
assert.equal(STYLIST_DAILY_MESSAGES_KEY, '@dripn_ai_daily_messages');
assert.equal(STYLIST_PENDING_RETRY_KEY, '@dripn_stylist_pending_retry');
assert.equal(STYLIST_CHAT_CLEARED_TOMBSTONE_KEY, '@dripn_ai_stylist_chat_cleared');

console.log('verify-stylist-chat-account-isolation: all cases passed');
}

void run();
