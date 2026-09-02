/**
 * Free Chat allowance banner must not start clipped under the sticky stylist header.
 * Run: npx tsx utils/freeAllowanceBannerLayout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldHoldListAtStartForAllowanceBanner } from './stylistChatScroll';
import { remainingMonthlyChatActions } from './freeChatMonthlyAllowance';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

// 1–2. First-open Free thread (greeting only) holds list at start so the
// "10 messages remaining this month" line is not scrolled under the header.
assert.equal(
  shouldHoldListAtStartForAllowanceBanner({ showUpgradeTeaser: true, messageCount: 0 }),
  true,
);
assert.equal(
  shouldHoldListAtStartForAllowanceBanner({ showUpgradeTeaser: true, messageCount: 1 }),
  true,
);
assert.equal(
  shouldHoldListAtStartForAllowanceBanner({ showUpgradeTeaser: true, messageCount: 2 }),
  false,
  'after a real exchange, stick-to-latest resumes',
);

// 8. Paid / no-banner: never hold
assert.equal(
  shouldHoldListAtStartForAllowanceBanner({ showUpgradeTeaser: false, messageCount: 0 }),
  false,
);
assert.equal(
  shouldHoldListAtStartForAllowanceBanner({ showUpgradeTeaser: false, messageCount: 1 }),
  false,
);

const chatSrc = read('screens/AIStylistScreen.tsx');

// Wired into the only scroll-to-end helper (covers focus, onLayout, inset effects)
assert.match(chatSrc, /if \(holdAllowanceBannerInViewRef\.current\) return;/);
assert.match(chatSrc, /shouldHoldListAtStartForAllowanceBanner\(\{/);
assert.match(
  chatSrc,
  /ListHeaderComponent=\{renderScrollChatHeader\}/,
);
assert.match(chatSrc, /showUpgradeTeaser \? \(/);
assert.match(chatSrc, /messages remaining this month/);

// 3. Sticky header still a sibling above the list, not inside it
const stickyIdx = chatSrc.indexOf('<View style={styles.headerContent}>{renderStickyChatHeader()}</View>');
const listIdx = chatSrc.indexOf('        <FlatList');
assert.ok(stickyIdx > 0 && listIdx > stickyIdx, 'sticky header remains above FlatList');

// 4. Persona row (avatar + name in sticky header) unchanged
assert.match(chatSrc, /const renderStickyChatHeader = \(\) => \(/);
assert.match(chatSrc, /\{stylist\.name\}/);
assert.match(chatSrc, /stylistAvatarInitial\(stylist\.name\)/);

// 5. Composer unchanged
assert.match(chatSrc, /<KeyboardStickyView offset=\{\{ closed: -tabBarHeight, opened: 0 \}\} style=\{styles\.inputSticky\}>/);
assert.match(chatSrc, /\{renderInputBar\(\)\}/);

// Banner chrome unchanged
assert.match(chatSrc, /upgradeTeaserCard:/);
assert.match(chatSrc, /marginBottom: Spacing\.lg/);

// 6. Free 10/month logic unchanged
{
  const r = remainingMonthlyChatActions({ monthlyChatCount: 0, chatHardCap: 10 });
  assert.equal(r.cap, 10);
  assert.equal(r.remaining, 10);
}
assert.match(read('utils/tierMatrix.ts'), /aiChatMessagesPerDay: 10,/);
assert.match(chatSrc, /remainingMessages !== Infinity && remainingMessages <= 10 && tier === 'free'/);

// 7. Guest 5-message trial unchanged
const guestSrc = read('screens/GuestBrowseScreen.tsx');
assert.match(guestSrc, /useState\(5\)/);
assert.match(guestSrc, /\{messagesRemaining \?\? 5\} messages left/);

console.log('freeAllowanceBannerLayout: all passed');
