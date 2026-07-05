import type { ClothingCategory } from '@/contexts/WardrobeContext';
import type { OnboardingProfile } from '@/services/OnboardingProfileService';
import type { Gender, UserProfile } from '@/contexts/AuthContext';

export type PresentationGender = 'male' | 'female' | 'neutral';

const VALID_CATEGORIES: ClothingCategory[] = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'bags',
  'accessories',
  'activewear_tops',
  'activewear_bottoms',
  'swimwear',
  'sleepwear',
  'formal',
];

const CATEGORY_ALIASES: Record<string, ClothingCategory> = {
  unknown: 'tops',
  top: 'tops',
  shirt: 'tops',
  shirts: 'tops',
  blouse: 'tops',
  sweater: 'tops',
  hoodie: 'tops',
  jersey: 'tops',
  tee: 'tops',
  tshirt: 'tops',
  't-shirt': 'tops',
  polo: 'tops',
  tank: 'tops',
  bottom: 'bottoms',
  pant: 'bottoms',
  pants: 'bottoms',
  jean: 'bottoms',
  jeans: 'bottoms',
  trouser: 'bottoms',
  trousers: 'bottoms',
  short: 'bottoms',
  shorts: 'bottoms',
  skirt: 'bottoms',
  chino: 'bottoms',
  chinos: 'bottoms',
  legging: 'bottoms',
  leggings: 'bottoms',
  dress: 'dresses',
  gown: 'dresses',
  romper: 'dresses',
  jumpsuit: 'dresses',
  outer: 'outerwear',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  cardigan: 'outerwear',
  parka: 'outerwear',
  shoe: 'shoes',
  footwear: 'shoes',
  sneaker: 'shoes',
  sneakers: 'shoes',
  boot: 'shoes',
  boots: 'shoes',
  trainer: 'shoes',
  trainers: 'shoes',
  bag: 'bags',
  handbag: 'bags',
  purse: 'bags',
  backpack: 'bags',
  tote: 'bags',
  accessory: 'accessories',
  accessories: 'accessories',
  hat: 'accessories',
  scarf: 'accessories',
  belt: 'accessories',
  watch: 'accessories',
  jewellery: 'accessories',
  jewelry: 'accessories',
  activewear: 'activewear_tops',
  athleisure: 'activewear_tops',
  swim: 'swimwear',
  sleep: 'sleepwear',
  loungewear: 'sleepwear',
  suit: 'formal',
};

const ACTIVEWEAR_BOTTOM_KEYWORDS = [
  'jogger',
  'joggers',
  'track',
  'legging',
  'leggings',
  'sweatpant',
  'short',
  'shorts',
  'pant',
  'pants',
  'bottom',
  'tight',
  'capri',
];

const ACTIVEWEAR_TOP_KEYWORDS = [
  'jersey',
  'top',
  'shirt',
  'bra',
  'tank',
  'vest',
  'tee',
  'hoodie',
  'sweatshirt',
  'singlet',
  'pullover',
];

const BOTTOM_KEYWORDS = ['pant', 'jean', 'short', 'trouser', 'skirt', 'jogger', 'chino', 'legging'];
const TOP_KEYWORDS = ['shirt', 'tee', 'top', 'jersey', 'hoodie', 'polo', 'sweater', 'blouse', 'jacket'];

export function normalizePresentationGender(input?: string | null): PresentationGender {
  const value = (input || '').toLowerCase().trim();
  if (['man', 'male', 'men', 'm'].includes(value)) return 'male';
  if (['woman', 'female', 'women', 'f'].includes(value)) return 'female';
  return 'neutral';
}

export function resolveUserPresentationGender(
  user?: UserProfile | null,
  onboardingProfile?: OnboardingProfile | null,
): PresentationGender {
  const direct = normalizePresentationGender(user?.gender);
  if (direct !== 'neutral') return direct;

  const profileDataGender = normalizePresentationGender(
    (user as UserProfile & { profileData?: { gender?: string } })?.profileData?.gender,
  );
  if (profileDataGender !== 'neutral') return profileDataGender;

  const embeddedQuizGender = user?.onboardingProfile?.quizGender;
  if (embeddedQuizGender === 'male') return 'male';
  if (embeddedQuizGender === 'female') return 'female';

  if (onboardingProfile?.quizGender === 'male') return 'male';
  if (onboardingProfile?.quizGender === 'female') return 'female';

  return 'neutral';
}

export function isMalePresentationGender(gender: PresentationGender): boolean {
  return gender === 'male';
}

function splitActivewearCategory(text: string): ClothingCategory {
  const lower = text.toLowerCase();
  if (ACTIVEWEAR_BOTTOM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'activewear_bottoms';
  }
  return 'activewear_tops';
}

function inferCategoryFromText(text: string): ClothingCategory | null {
  const lower = text.toLowerCase();
  if (lower.includes('dress') || lower.includes('gown') || lower.includes('romper')) return 'dresses';
  if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot') || lower.includes('trainer')) {
    return 'shoes';
  }
  if (lower.includes('bag') || lower.includes('backpack') || lower.includes('tote') || lower.includes('purse')) {
    return 'bags';
  }
  if (lower.includes('jacket') || lower.includes('coat') || lower.includes('blazer') || lower.includes('parka')) {
    return 'outerwear';
  }
  if (ACTIVEWEAR_BOTTOM_KEYWORDS.some((kw) => lower.includes(kw))) return 'activewear_bottoms';
  if (ACTIVEWEAR_TOP_KEYWORDS.some((kw) => lower.includes(kw))) return 'activewear_tops';
  if (BOTTOM_KEYWORDS.some((kw) => lower.includes(kw))) return 'bottoms';
  if (TOP_KEYWORDS.some((kw) => lower.includes(kw))) return 'tops';
  return null;
}

export function normalizeWardrobeCategory(
  raw?: string | null,
  hints?: { name?: string; subcategory?: string },
): ClothingCategory {
  const cleaned = (raw || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (CATEGORY_ALIASES[cleaned]) return CATEGORY_ALIASES[cleaned];
  if (VALID_CATEGORIES.includes(cleaned as ClothingCategory)) return cleaned as ClothingCategory;

  if (cleaned === 'activewear') {
    return splitActivewearCategory(`${hints?.name || ''} ${hints?.subcategory || ''}`);
  }

  const inferred = inferCategoryFromText(`${hints?.name || ''} ${hints?.subcategory || ''} ${cleaned}`);
  if (inferred) return inferred;

  return 'tops';
}

export function normalizeWardrobeCategoryForGender(
  raw?: string | null,
  gender: PresentationGender = 'neutral',
  hints?: { name?: string; subcategory?: string },
): ClothingCategory {
  let category = normalizeWardrobeCategory(raw, hints);

  if (gender === 'male' && category === 'dresses') {
    const inferred = inferCategoryFromText(`${hints?.name || ''} ${hints?.subcategory || ''}`);
    category = inferred && inferred !== 'dresses' ? inferred : 'tops';
  }

  return category;
}

export function itemMatchesWardrobeCategory(
  item: { category?: string | null; name?: string; subcategory?: string },
  category: ClothingCategory | 'all',
  gender: PresentationGender = 'neutral',
): boolean {
  if (category === 'all') return true;
  const normalized = normalizeWardrobeCategoryForGender(item.category, gender, {
    name: item.name,
    subcategory: item.subcategory,
  });
  return normalized === category;
}

export function countItemsForWardrobeCategory(
  items: Array<{ category?: string | null; name?: string; subcategory?: string }>,
  category: ClothingCategory | 'all',
  gender: PresentationGender = 'neutral',
): number {
  return items.filter((item) => itemMatchesWardrobeCategory(item, category, gender)).length;
}

export type WardrobeCategoryTab = {
  key: ClothingCategory | 'all';
  icon: string;
  iconSet: 'feather' | 'material';
  translationKey: string;
};

export const WARDROBE_CATEGORY_TABS: WardrobeCategoryTab[] = [
  { key: 'all', icon: 'grid', iconSet: 'feather', translationKey: 'wardrobe.categoryAll' },
  { key: 'tops', icon: 'tshirt-crew', iconSet: 'material', translationKey: 'wardrobe.categoryTops' },
  { key: 'bottoms', icon: 'layers', iconSet: 'feather', translationKey: 'wardrobe.categoryBottoms' },
  { key: 'dresses', icon: 'human-female', iconSet: 'material', translationKey: 'wardrobe.categoryDresses' },
  { key: 'outerwear', icon: 'cloud', iconSet: 'feather', translationKey: 'wardrobe.categoryOuterwear' },
  { key: 'shoes', icon: 'shoe-formal', iconSet: 'material', translationKey: 'wardrobe.categoryShoes' },
  { key: 'activewear_tops', icon: 'run-fast', iconSet: 'material', translationKey: 'wardrobe.categoryActivewearTops' },
  { key: 'activewear_bottoms', icon: 'run', iconSet: 'material', translationKey: 'wardrobe.categoryActivewearBottoms' },
  { key: 'formal', icon: 'bow-tie', iconSet: 'material', translationKey: 'wardrobe.categoryFormal' },
  { key: 'bags', icon: 'briefcase', iconSet: 'material', translationKey: 'wardrobe.categoryBags' },
  { key: 'accessories', icon: 'watch', iconSet: 'material', translationKey: 'wardrobe.categoryAccessories' },
];

export function getWardrobeCategoryTabs(gender: PresentationGender): WardrobeCategoryTab[] {
  if (gender === 'male') {
    return WARDROBE_CATEGORY_TABS.filter((tab) => tab.key !== 'dresses');
  }
  return WARDROBE_CATEGORY_TABS;
}

export function getManualAddCategoryTabs(gender: PresentationGender): Array<{
  key: ClothingCategory;
  icon: string;
  iconSet: 'feather' | 'material';
}> {
  const isMale = gender === 'male';
  return [
    { key: 'tops', icon: 'tshirt-crew', iconSet: 'material' },
    { key: 'bottoms', icon: 'layers', iconSet: 'feather' },
    ...(isMale ? [] : [{ key: 'dresses' as ClothingCategory, icon: 'human-female', iconSet: 'material' as const }]),
    { key: 'outerwear', icon: 'cloud', iconSet: 'feather' },
    { key: 'shoes', icon: isMale ? 'shoe-formal' : 'shoe-heel', iconSet: 'material' },
    { key: 'activewear_tops', icon: 'run-fast', iconSet: 'material' },
    { key: 'activewear_bottoms', icon: 'dumbbell', iconSet: 'material' },
    { key: 'formal', icon: 'bow-tie', iconSet: 'material' },
    { key: 'bags', icon: isMale ? 'briefcase' : 'bag-personal', iconSet: 'material' },
    { key: 'accessories', icon: isMale ? 'watch' : 'necklace', iconSet: 'material' },
    { key: 'swimwear', icon: 'swim', iconSet: 'material' },
    { key: 'sleepwear', icon: 'bed', iconSet: 'material' },
  ];
}
