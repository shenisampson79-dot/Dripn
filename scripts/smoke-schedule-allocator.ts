/**
 * Smoke checks for schedule-driven lookbook allocation (no Expo runtime).
 * Run: npx tsx scripts/smoke-schedule-allocator.ts
 */

import type { WardrobeItem } from '../contexts/WardrobeContext';
import {
  allocateScheduleDrivenLookbook,
  buildUsagePlan,
  LOOKBOOK_REUSE_RULES,
  outfitsTooSimilar,
  validateLookbook,
} from '../utils/scheduleDrivenAllocator';
import { isTopItem } from '../utils/completeOutfit';

function item(
  id: string,
  category: WardrobeItem['category'],
  name: string,
  extras: Partial<WardrobeItem> = {},
): WardrobeItem {
  return {
    id,
    category,
    name,
    color: extras.color || 'navy',
    imageUri: '',
    createdAt: new Date().toISOString(),
    ...extras,
  } as WardrobeItem;
}

const capsule: WardrobeItem[] = [
  item('t1', 'tops', 'White Tee'),
  item('t2', 'tops', 'Black Shirt'),
  item('t3', 'tops', 'Linen Shirt'),
  item('t4', 'tops', 'Oxford Shirt'),
  item('t5', 'tops', 'Liverpool FC Jersey'), // statement
  item('b1', 'bottoms', 'Blue Jeans'),
  item('b2', 'bottoms', 'Grey Chinos'),
  item('b3', 'bottoms', 'Black Trousers'),
  item('s1', 'shoes', 'White Sneakers'),
  item('s2', 'shoes', 'Brown Loafers'),
  item('l1', 'outerwear', 'Navy Overshirt'),
];

const activities = Array.from({ length: 14 }, (_, i) =>
  i === 0 || i === 13 ? ('flight' as const) : ('explore' as const),
);

const plan = buildUsagePlan(capsule, 14);
console.log('Usage plan (tops):');
for (const top of capsule.filter(isTopItem)) {
  console.log(`  ${top.name}: days ${(plan.usagePlan[top.id] || []).join(', ') || '(none)'}`);
}

const result = allocateScheduleDrivenLookbook({
  capsule,
  totalDays: 14,
  dayActivities: activities,
});

if (!result) {
  console.error('FAIL: allocator returned null');
  process.exit(1);
}

const topUses = new Map<string, number[]>();
result.outfits.forEach((outfit, idx) => {
  const top = outfit.find(isTopItem);
  if (!top) return;
  const days = topUses.get(top.name) || [];
  days.push(idx + 1);
  topUses.set(top.name, days);
});

console.log('\nActual top days:');
for (const [name, days] of topUses) {
  console.log(`  ${name}: ${days.join(', ')} (${days.length} uses)`);
}

let consecutive = 0;
for (let i = 1; i < result.outfits.length; i++) {
  const a = result.outfits[i - 1].find(isTopItem);
  const b = result.outfits[i].find(isTopItem);
  if (a && b && a.id === b.id) consecutive++;
  if (outfitsTooSimilar(result.outfits[i], result.outfits[i - 1])) {
    console.warn(`  similar collision day ${i + 1}`);
  }
}

const validation = validateLookbook(result.outfits);
console.log('\nValidation:', validation);
console.log('Consecutive same top count:', consecutive);
console.log('Max top uses allowed:', LOOKBOOK_REUSE_RULES.maxUsesTop);
console.log('Statement max:', LOOKBOOK_REUSE_RULES.maxUsesStatement);

const jerseyDays = topUses.get('Liverpool FC Jersey') || [];
if (jerseyDays.length > LOOKBOOK_REUSE_RULES.maxUsesStatement) {
  console.error('FAIL: statement overused');
  process.exit(1);
}
if (consecutive > 0) {
  console.error('FAIL: consecutive same tops');
  process.exit(1);
}
for (const [, days] of topUses) {
  if (days.length > LOOKBOOK_REUSE_RULES.maxUsesTop) {
    console.error('FAIL: top overused', days);
    process.exit(1);
  }
}

console.log('\nPASS schedule-driven allocator smoke');
