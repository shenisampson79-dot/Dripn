/**
 * Informational QSC selection summary. Does not validate or constrain picks.
 */
import {
  DECISION_WARDROBE_GROUPS,
  getDecisionWardrobeGroup,
  type DecisionWardrobeGroupKey,
} from '@/utils/decisionWardrobeGroups';

export type QscSelectionCounterItem = {
  id?: string | number;
  category?: string | null;
  name?: string;
  subcategory?: string;
};

export function formatQscSelectionCounter(args: {
  selectedIds: Array<string | number>;
  items: QscSelectionCounterItem[];
  selectedLabel: (count: number) => string;
  labelForGroup: (key: DecisionWardrobeGroupKey) => string;
  separator?: string;
}): string {
  const ids = Array.isArray(args.selectedIds) ? args.selectedIds.map(String) : [];
  const byId = new Map(
    (args.items || []).map((item) => [String(item.id), item]),
  );
  const counts = new Map<DecisionWardrobeGroupKey, number>();

  for (const id of ids) {
    const item = byId.get(id);
    const group = item ? getDecisionWardrobeGroup(item) : 'other';
    counts.set(group, (counts.get(group) || 0) + 1);
  }

  const parts = [args.selectedLabel(ids.length)];
  for (const def of DECISION_WARDROBE_GROUPS) {
    const n = counts.get(def.key) || 0;
    if (n <= 0) continue;
    parts.push(`${args.labelForGroup(def.key)} ${n}`);
  }

  return parts.join(args.separator || ' · ');
}
