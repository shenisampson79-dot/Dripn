/**
 * Launch trainer eligibility contract (mirrors Dripn-Server/services/trainerEligibility.js).
 *
 * Conservative where silhouette confidence is low — do not parse every trainer.
 *
 *   Business formal        → no trainers
 *   Business casual        → no trainers
 *   Smart casual work      → no trainers
 *   Creative workplace     → clean/minimal lifestyle only (not performance/chunky/tech)
 *   Non-work smart casual  → clean/minimal lifestyle only
 *   Running/trail/gym/tech/chunky → hard-block from tailored or work-smart outfits
 */
export {
  evaluateTrainerEligibility,
  isCleanMinimalLifestyleTrainer,
  isTrainerLike,
  trainerAllowedForAsk,
} from '@/utils/outfitClashRules';
