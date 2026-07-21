import type { DFYAccessStatus, DfyPackageSummary, DFYTier } from '@/services/DFYService';

/** Subtitle for Profile Style plans rows: `Active` or `14 looks · Jul 2026`. */
export function formatDfyPackageSubtitle(pkg: DfyPackageSummary): string {
  if (pkg.isActive) return 'Active';
  const looks =
    pkg.outfitCount === 1 ? '1 look' : `${pkg.outfitCount || 0} looks`;
  const date = new Date(pkg.createdAt);
  if (Number.isNaN(date.getTime())) return looks;
  const monthYear = date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
  return `${looks} · ${monthYear}`;
}

export function dfyPackageTierLabel(tier: DFYTier): string {
  return tier === 'core' ? 'Full Wardrobe Setup' : 'Occasion Ready';
}

const DFY_CORE_SUBSCRIPTION_TIERS = new Set([
  'core',
  'core_wardrobe',
  'done_for_you_core',
  'dfy_core',
]);

/** True when subscription tier string(s) indicate Core / Full Wardrobe Setup. */
export function subscriptionIndicatesDfyCore(
  subscriptionTier?: string | string[] | null,
): boolean {
  const raw = Array.isArray(subscriptionTier)
    ? subscriptionTier.join(',')
    : String(subscriptionTier || '');
  if (!raw.trim()) return false;
  return raw
    .toLowerCase()
    .split(/[,|\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => DFY_CORE_SUBSCRIPTION_TIERS.has(token));
}

/** Prefer active Lite package, else newest Lite by createdAt. */
export function pickLiteLookbookPackage(
  packages: DfyPackageSummary[],
): DfyPackageSummary | null {
  const lite = packages.filter((pkg) => pkg.tier === 'lite');
  if (lite.length === 0) return null;
  const active = lite.filter((pkg) => pkg.isActive);
  const pool = active.length > 0 ? active : lite;
  return pool.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

/**
 * Lookbook day grid is Lite-only. Use this to decide Core empty/redirect UX
 * when there is no Lite delivery to show.
 */
export function hasCoreLookbookRedirectSignal(options: {
  access?: DFYAccessStatus | null;
  packages?: DfyPackageSummary[];
  localDeliveryTier?: DFYTier | null;
  subscriptionTier?: string | string[] | null;
}): boolean {
  const { access, packages = [], localDeliveryTier, subscriptionTier } = options;
  if (access?.tier === 'core') return true;
  if (localDeliveryTier === 'core') return true;
  if (packages.some((pkg) => pkg.tier === 'core')) return true;
  if (subscriptionIndicatesDfyCore(subscriptionTier)) return true;
  return false;
}
