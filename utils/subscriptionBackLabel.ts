/**
 * Label for Subscription header back control — where dismiss returns.
 */
type Translate = (key: string) => string;

/** Analytics / funnel `source` → short return-path label. */
const SOURCE_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  stylist_chat: { key: 'common.chat', fallback: 'Chat' },
  chat: { key: 'common.chat', fallback: 'Chat' },
  profile: { key: 'navTitles.profile', fallback: 'Profile' },
  settings: { key: 'settings.title', fallback: 'Settings' },
  shopping: { key: 'navTitles.choosingWhatToBuy', fallback: 'Choosing what to buy' },
  'event-outfit': { key: 'navTitles.eventOutfit', fallback: 'Outfit for an event' },
  'sanity-check': { key: 'navTitles.sanityCheck', fallback: 'Quick sanity check' },
  live: { key: 'live.screenTitle', fallback: 'Live' },
  stylist_hub: { key: 'navTitles.stylist', fallback: 'Stylist' },
  wardrobe: { key: 'navTitles.myWardrobe', fallback: 'Wardrobe' },
  decide_for_me: { key: 'navTitles.todaysDecision', fallback: 'Decide' },
  get_outfits: { key: 'wardrobe.getOutfitsNow', fallback: 'Get outfits now' },
};

/** Previous stack route name → label (when `source` was omitted). */
const ROUTE_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  AIStylist: { key: 'common.chat', fallback: 'Chat' },
  Profile: { key: 'navTitles.profile', fallback: 'Profile' },
  Settings: { key: 'settings.title', fallback: 'Settings' },
  ChoosingWhatToBuy: { key: 'navTitles.choosingWhatToBuy', fallback: 'Choosing what to buy' },
  EventOutfit: { key: 'navTitles.eventOutfit', fallback: 'Outfit for an event' },
  SanityCheck: { key: 'navTitles.sanityCheck', fallback: 'Quick sanity check' },
  LiveStylist: { key: 'live.screenTitle', fallback: 'Live' },
  StylistHub: { key: 'navTitles.stylist', fallback: 'Stylist' },
  Wardrobe: { key: 'navTitles.myWardrobe', fallback: 'Wardrobe' },
  DecideForMe: { key: 'navTitles.todaysDecision', fallback: 'Decide' },
  ScanWardrobe: { key: 'wardrobe.getOutfitsNow', fallback: 'Get outfits now' },
  OutfitCalendar: { key: 'navTitles.outfitCalendar', fallback: 'Outfit Calendar' },
};

function labelFromMap(
  map: Record<string, { key: string; fallback: string }>,
  id: string | undefined,
  t: Translate,
): string | null {
  if (!id) return null;
  const entry = map[id];
  if (!entry) return null;
  return t(entry.key) || entry.fallback;
}

type NavStateLike = {
  getState?: () => {
    routes?: Array<{ name: string }>;
    index?: number;
  } | undefined;
};

export function resolveSubscriptionBackLabel(opts: {
  t: Translate;
  source?: string | null;
  backLabel?: string | null;
  navigation?: NavStateLike;
}): string | null {
  const explicit = String(opts.backLabel || '').trim();
  if (explicit) return explicit;

  const fromSource = labelFromMap(SOURCE_LABEL_KEYS, String(opts.source || '').trim(), opts.t);
  if (fromSource) return fromSource;

  const state = opts.navigation?.getState?.();
  const idx = state?.index;
  const routes = state?.routes;
  if (typeof idx === 'number' && routes && idx > 0) {
    const prev = routes[idx - 1]?.name;
    const fromRoute = labelFromMap(ROUTE_LABEL_KEYS, prev, opts.t);
    if (fromRoute) return fromRoute;
  }

  return null;
}
