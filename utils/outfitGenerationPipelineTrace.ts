/**
 * Staff-only outfit generation pipeline stages (client presentation gate).
 * Never show to customers — mirrors server outfitGenerationPipelineTrace.
 */
import { isStaffUser } from '@/utils/staffAccess';

export const PIPELINE_STAGES = [
  'CONTEXT_RESOLVED',
  'METADATA_READY',
  'CANDIDATES_GENERATED',
  'GUARD_PASS',
  'EVALUATOR_PASS',
  'TOP_CANDIDATE',
  'PUBLISHED',
] as const;

export type OutfitPipelineStage = (typeof PIPELINE_STAGES)[number];

export function isOutfitPipelineStaff(user: unknown): boolean {
  return isStaffUser(user as never);
}

/** Attach server pipelineTrace to UI only for staff. */
export function staffVisiblePipelineTrace(
  user: unknown,
  pipelineTrace: unknown,
): unknown {
  if (!isOutfitPipelineStaff(user)) return undefined;
  return pipelineTrace || undefined;
}
