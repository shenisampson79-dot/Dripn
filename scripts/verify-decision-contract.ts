/**
 * Decision contract smoke tests (shopping multi-compare).
 * Run: npx tsx scripts/verify-decision-contract.ts
 */
import {
  DecisionContractError,
  enforceDecisionContract,
  resolveContractRecommendedIndex,
  safeEnforceDecisionContract,
} from '../utils/decisionContract';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('=== Decision contract (StyleWise) ===\n');

{
  const r = enforceDecisionContract(
    { decision: 'Go with option 2.', recommendedIndex: 1 },
    { optionCount: 3 },
  );
  assert(r.recommendedIndex === 1, 'valid multi index preserved');
}

{
  let threw = false;
  try {
    enforceDecisionContract({ decision: 'Nice picks.' }, { optionCount: 2 });
  } catch (e) {
    threw = e instanceof DecisionContractError && e.code === 'recommendedIndex_required';
  }
  assert(threw, 'multi without index throws recommendedIndex_required');
}

{
  const soft = safeEnforceDecisionContract(
    { decision: 'Both work.', recommendedIndex: null },
    { optionCount: 2 },
  );
  assert(soft.ok === false, 'safeEnforce marks multi missing index as not ok');
  assert(
    soft.payload.recommendedIndex === undefined,
    'safeEnforce must not invent recommendedIndex 0 for multi',
  );
}

{
  const soft = safeEnforceDecisionContract(
    { decision: 'Pick one.', recommendedIndex: 9 },
    { optionCount: 2 },
  );
  assert(soft.ok === false, 'out of bounds fails');
  assert(
    soft.payload.recommendedIndex === undefined,
    'out of bounds must not become 0',
  );
}

{
  const r = enforceDecisionContract({ decision: 'Looks good.' }, { optionCount: 1 });
  assert(r.recommendedIndex === 0, 'single option gets index 0');
}

{
  const idx = resolveContractRecommendedIndex(
    { decision: 'Wear this.\nSELECTED_OPTION:2' },
    3,
  );
  assert(idx === 1, 'SELECTED_OPTION:2 → index 1');
}

console.log('All decision-contract checks passed.');
