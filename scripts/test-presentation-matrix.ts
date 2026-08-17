/**
 * Launch-blocking client presentation matrix.
 * Run: npx tsx scripts/test-presentation-matrix.ts
 */
import assert from 'node:assert/strict';
import {
  INTERNAL_SENTINELS,
  PRESENTATION_FAILURE,
  SAFE_FALLBACKS,
  SAFE_SURFACE_FALLBACKS,
  assertCanonicalOutfitRender,
  assertNoInternalLeak,
  poisonedEngineContext,
  toSafePresentation,
  type PresentationSurface,
  type SafePresentation,
} from '../utils/stylistPresentationBoundary';
import { sanitizeStylistUserText } from '../utils/sanitizeStylistUserText';

const CTX = poisonedEngineContext();
const DIAG = {
  prompt: CTX,
  context: CTX,
  guardReasons: [INTERNAL_SENTINELS.guard],
  rawVision: INTERNAL_SENTINELS.vision,
  debug: INTERNAL_SENTINELS.debug,
};

const VALID_OUTFIT = {
  pieces: [
    { id: 'top-1', name: 'Navy jacket', role: 'top' },
    { id: 'bottom-1', name: 'Grey trousers', role: 'bottom' },
    { id: 'shoes-1', name: 'Leather oxfords', role: 'shoes' },
  ],
  itemIds: ['top-1', 'bottom-1', 'shoes-1'],
  canonicalItemIds: ['top-1', 'bottom-1', 'shoes-1'],
  proseItemIds: ['top-1', 'bottom-1', 'shoes-1'],
};

const REJECTED_POOL = {
  pieces: [{ id: 'rej-1', name: INTERNAL_SENTINELS.guard, role: 'top' }],
};

function runCase(
  id: string,
  input: Parameters<typeof toSafePresentation>[0],
  opts: { emptyOutfit?: boolean; bodyIncludes?: string; imageState?: SafePresentation['imageState'] } = {},
) {
  const { presentation, diagnostics } = toSafePresentation({ ...input, diagnostics: DIAG });
  assertNoInternalLeak(presentation, id);
  assert.ok(presentation.summary, `${id}: summary`);
  assertCanonicalOutfitRender(presentation, { mustBeEmpty: opts.emptyOutfit !== false });
  if (opts.bodyIncludes) {
    assert.ok(presentation.body.includes(opts.bodyIncludes), `${id}: body`);
  }
  if (opts.imageState) assert.equal(presentation.imageState, opts.imageState);
  assert.ok(String(diagnostics.context).includes(INTERNAL_SENTINELS.system));
  return presentation;
}

console.log('=== Client presentation matrix ===\n');

{
  const { presentation } = toSafePresentation({
    surface: 'qsc',
    failure: PRESENTATION_FAILURE.VISION_NULL,
    modelOutput: CTX,
    outfit: REJECTED_POOL,
    diagnostics: DIAG,
  });
  assertNoInternalLeak(presentation, 'QSC workplace echo');
  assert.equal(presentation.summary, SAFE_FALLBACKS.qsc);
  assertCanonicalOutfitRender(presentation, { mustBeEmpty: true });
  assert.equal(sanitizeStylistUserText(CTX), SAFE_FALLBACKS.qsc);
  console.log('✓ QSC fallback never echoes workplace engine context');
}

const cases: Array<{
  id: string;
  surface: PresentationSurface;
  failure: string;
  modelOutput: string;
  emptyOutfit?: boolean;
  bodyIncludes: string;
  extra?: Parameters<typeof toSafePresentation>[0];
}> = [
  { id: 'Q1', surface: 'qsc', failure: PRESENTATION_FAILURE.VISION_NULL, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.qsc },
  { id: 'Q2', surface: 'qsc', failure: PRESENTATION_FAILURE.VISION_THROW, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.qsc },
  { id: 'Q3', surface: 'qsc', failure: PRESENTATION_FAILURE.ALT_FAIL, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.qscAlternative },
  { id: 'Q4', surface: 'qsc', failure: PRESENTATION_FAILURE.WORK_FALLBACK, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.qsc },
  { id: 'Q5', surface: 'qsc', failure: PRESENTATION_FAILURE.GUARD_REJECT, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.qscGuardReject },
  { id: 'G1', surface: 'gon', failure: PRESENTATION_FAILURE.SCAN_FAIL, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.gonScan },
  { id: 'G2', surface: 'gon', failure: PRESENTATION_FAILURE.NO_CANDIDATE, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.gonLooks },
  { id: 'G4', surface: 'gon', failure: PRESENTATION_FAILURE.WORK_GEN_FAIL, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.gonLooks },
  { id: 'C1', surface: 'chat', failure: PRESENTATION_FAILURE.PIPELINE_THROW, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.chat },
  { id: 'C2', surface: 'chat', failure: PRESENTATION_FAILURE.GUARD_REFUSE, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.chatRefuse },
  { id: 'C3', surface: 'chat', failure: PRESENTATION_FAILURE.CONTINUITY_MALFORMED, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.chatClarify },
  { id: 'C4', surface: 'chat', failure: PRESENTATION_FAILURE.WORK_REQUEST, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.chat },
  { id: 'E1', surface: 'events', failure: PRESENTATION_FAILURE.EVENT_GEN_FAIL, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.events },
  { id: 'E2', surface: 'events', failure: PRESENTATION_FAILURE.EVENT_REJECT_ALL, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.eventsIncomplete },
  { id: 'E4', surface: 'events', failure: PRESENTATION_FAILURE.EVENT_INCOMPLETE, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.eventsIncomplete },
  { id: 'S1', surface: 'shopping', failure: PRESENTATION_FAILURE.SHOP_VISION_FAIL, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.shopping },
  { id: 'S2', surface: 'shopping', failure: PRESENTATION_FAILURE.SHOP_WORK_REJECT, modelOutput: CTX, bodyIncludes: SAFE_FALLBACKS.shopping },
  { id: 'S3', surface: 'shopping', failure: PRESENTATION_FAILURE.SHOP_SOLVER_FAIL, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.shoppingUnsure },
  { id: 'S4', surface: 'shopping', failure: PRESENTATION_FAILURE.SHOP_HANDOFF, modelOutput: CTX, bodyIncludes: SAFE_SURFACE_FALLBACKS.shoppingHandoff },
];

for (const c of cases) {
  runCase(c.id, {
    surface: c.surface,
    failure: c.failure,
    modelOutput: c.modelOutput,
    outfit: REJECTED_POOL,
  }, { bodyIncludes: c.bodyIncludes.slice(0, 18) });
  console.log(`✓ ${c.id}`);
}

{
  const p = runCase('G3', {
    surface: 'gon',
    failure: PRESENTATION_FAILURE.PARTIAL_LOOK,
    modelOutput: 'Two looks from your wardrobe.',
    looks: [VALID_OUTFIT, REJECTED_POOL],
    outfit: VALID_OUTFIT,
  }, { emptyOutfit: false });
  assert.equal(p.looks.length, 1);
  console.log('✓ G3');
}

{
  const p = runCase('G5', {
    surface: 'gon',
    failure: PRESENTATION_FAILURE.HYDRATION_FAIL,
    modelOutput: 'Wear the navy jacket with the grey trousers.',
    outfit: VALID_OUTFIT,
  }, { emptyOutfit: false, imageState: 'unavailable' });
  assert.ok(p.outfit?.pieces.every((piece) => piece.alt === SAFE_SURFACE_FALLBACKS.gonImage));
  console.log('✓ G5');
}

{
  const p = runCase('C5', {
    surface: 'chat',
    failure: PRESENTATION_FAILURE.HYDRATION_PARTIAL,
    modelOutput: 'Wear the navy jacket and grey trousers.',
    outfit: {
      ...VALID_OUTFIT,
      pieces: [...VALID_OUTFIT.pieces, { id: 'ghost-9', name: INTERNAL_SENTINELS.debug }],
    },
  }, { emptyOutfit: false, imageState: 'partial' });
  assert.ok(!p.outfit?.itemIds.includes('ghost-9'));
  console.log('✓ C5');
}

{
  const p = runCase('E3', {
    surface: 'events',
    failure: PRESENTATION_FAILURE.EVENT_OVERRIDE,
    modelOutput: 'For the interview, keep it tailored — navy jacket, grey trousers, and leather shoes.',
    outfit: VALID_OUTFIT,
  }, { emptyOutfit: false });
  assert.match(p.body, /interview/i);
  console.log('✓ E3');
}

console.log('\nclient presentation-matrix: 20/20 passed');
