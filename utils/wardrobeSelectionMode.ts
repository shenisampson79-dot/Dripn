import { getDecisionWardrobeGroup } from '@/utils/decisionWardrobeGroups';

/** How manual wardrobe picks should be interpreted by the stylist decision engine. */
export type WardrobeSelectionMode = 'evaluate_outfit' | 'pick_one';

type SelectionItem = {
  id?: string | number;
  category?: string | null;
  name?: string;
  subcategory?: string;
};

/**
 * Mixed categories (or a single piece) → sanity-check the proposed look.
 * Two or more items in the same category (e.g. multiple outerwear) → pick one.
 */
export function resolveWardrobeSelectionMode(
  selectedIds: Array<string | number>,
  items: SelectionItem[],
): WardrobeSelectionMode | null {
  if (!selectedIds?.length) return null;

  const byId = new Map(items.map((item) => [String(item.id), item]));
  const selected = selectedIds
    .map((id) => byId.get(String(id)))
    .filter((item): item is SelectionItem => Boolean(item));

  if (selected.length === 0) return null;

  const groups = new Set(selected.map((item) => getDecisionWardrobeGroup(item)));
  if (selected.length >= 2 && groups.size === 1) return 'pick_one';
  return 'evaluate_outfit';
}
