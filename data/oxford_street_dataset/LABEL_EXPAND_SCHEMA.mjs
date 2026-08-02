/**
 * Oxford expand-label schema (match gold_labels_batch_*.json).
 * Agents write labels_expand_batch_NN.json as a JSON ARRAY of these objects.
 *
 * label_status MUST be "labeled" (not gold).
 * Discard non-windows: label_status "discarded", rules.valid false, violations ["not_shop_window"].
 * Pedestal-only shoes: footwear null.
 * Primary mannequin only.
 */
export const EXAMPLE = {
  id: 'oxford_002',
  source: 'oxford_street',
  image_path: 'images/002.jpg',
  brand: null,
  price_tier: 'high_street',
  outfit: {
    top: { category: 't-shirt', subcategory: 'crew_neck', color: 'white' },
    bottom: { category: 'jeans', subcategory: 'straight', color: 'blue' },
    outerwear: null,
    footwear: { category: 'shoes', subcategory: 'sneakers', color: 'white' },
    accessory: null,
  },
  style: { primary: 'casual', secondary: ['street'] },
  colour_palette: ['white', 'blue'],
  features: { layering: 'none', contrast: 'medium', silhouette: 'relaxed' },
  style_tags: ['casual'],
  notes: 'Centre mannequin in white tee and blue jeans with white sneakers',
  confidence: 0.85,
  score_hint: { base_score: 75, boost: false },
  rules: { valid: true, violations: [] },
  use_for_detection: true,
  label_status: 'labeled',
};
