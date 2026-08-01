/**
 * Apply street_label_reviews decisions into croydon / brixton / sloane dataset.json
 * Usage: node data/street_label_reviews/apply-decisions.mjs [path-to-decisions.json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, '..');

const STREET_DIR = {
  croydon: 'croydon_mall_dataset',
  brixton: 'brixton_high_street_dataset',
  sloane: 'sloane_street_dataset',
};

const decisionsPath =
  process.argv[2] ||
  path.join(__dirname, 'decisions.json');

const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));

function loadDataset(street) {
  const file = path.join(dataRoot, STREET_DIR[street], 'dataset.json');
  return { file, rows: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function findRow(rows, street, id) {
  const num = String(id).padStart(3, '0');
  return rows.find((r) => r.id === `${street}_${num}` || r.id.endsWith(`_${num}`));
}

function paletteFromOutfit(outfit, extra = []) {
  const colors = new Set(extra.filter(Boolean));
  for (const piece of Object.values(outfit || {})) {
    if (piece && piece.color) colors.add(piece.color);
  }
  return [...colors];
}

function discardRow(row, reason) {
  row.rules = {
    valid: false,
    violations: [reason],
  };
  row.score_hint = { base_score: 0, boost: false };
  row.notes = `${row.notes || ''} [user discarded: ${reason}]`.trim();
  row.confidence = Math.min(row.confidence ?? 0.5, 0.5);
}

function patch(row, mutator) {
  mutator(row);
  if (row.rules?.valid !== false) {
    row.colour_palette = paletteFromOutfit(row.outfit, row.colour_palette);
  }
}

const datasets = {
  croydon: loadDataset('croydon'),
  brixton: loadDataset('brixton'),
  sloane: loadDataset('sloane'),
};

const report = [];

function touch(street, id, fn) {
  const { rows } = datasets[street];
  const row = findRow(rows, street, id);
  if (!row) {
    report.push(`MISSING ${street}_${id}`);
    return;
  }
  fn(row);
  report.push(`OK ${row.id}`);
}

// --- Explicit edits from decisions + user notes ---

// Croydon must-fix / your-call
touch('croydon', '002', (row) =>
  patch(row, (r) => {
    r.outfit.footwear = {
      category: 'shoes',
      subcategory: 'sneakers',
      color: 'silver',
    };
    r.notes =
      'Foot Locker taller adult mannequin taupe tee + light blue jersey shorts + silver & white sneakers';
  }),
);

touch('croydon', '003', (row) =>
  patch(row, (r) => {
    r.features = { ...(r.features || {}), layering: 'light' };
    r.notes =
      'Primary right/center stripe knit open over brown under-tee, light-wash denim shorts, clog slides and sunglasses';
    // keep structured top as visible outer shirt; underlayer captured in notes
  }),
);

touch('croydon', '006', (row) =>
  patch(row, (r) => {
    r.outfit.footwear = {
      category: 'shoes',
      subcategory: 'loafers',
      color: 'beige',
    };
    r.notes =
      'Center-right mannequin in red palm-embroidered short-sleeve shirt with off-white trousers and beige loafers';
  }),
);

touch('croydon', '012', (row) =>
  patch(row, (r) => {
    r.outfit.accessory = {
      category: 'hat',
      subcategory: 'baseball_cap',
      color: 'maroon',
    };
    r.notes =
      'Left foreground mannequin in white Adidas Originals ringer tee, black shorts, sneakers, maroon NY cap; maroon backpack also present';
  }),
);

touch('croydon', '014', (row) =>
  patch(row, (r) => {
    r.outfit.accessory = {
      category: 'bag',
      subcategory: 'backpack',
      color: 'black',
    };
    r.notes =
      'Central male mannequin in white logo tee, tan chinos, sneakers, black backpack; silver aviators also worn';
  }),
);

touch('croydon', '018', (row) =>
  patch(row, (r) => {
    r.outfit.bottom = {
      category: 'trousers',
      subcategory: 'slim_chinos',
      color: 'grey',
    };
    r.notes =
      'Male mannequin in white textured quarter-zip polo, grey slim trousers and white low-top sneakers';
  }),
);

touch('croydon', '019', (row) =>
  patch(row, (r) => {
    r.features = { ...(r.features || {}), layering: 'light' };
    r.outfit.footwear = {
      category: 'shoes',
      subcategory: 'sneakers',
      color: 'silver',
    };
    r.notes =
      'Center female mannequin: white cropped sweatshirt over black & white Nike Pro sports bra; white sweat shorts over black & white Nike Pro cycling shorts; silver & white trainers';
  }),
);

touch('croydon', '007', (row) => discardRow(row, 'user_discarded_uncertain'));
touch('croydon', '011', (row) => discardRow(row, 'user_discarded_uncertain'));

touch('croydon', '010', (row) =>
  patch(row, (r) => {
    r.outfit.top = {
      category: 'shirt',
      subcategory: 'vertical_stripe_button_down',
      color: 'multicolor',
    };
    r.outfit.bottom = {
      category: 'jeans',
      subcategory: 'cropped_straight',
      color: 'dark blue',
    };
    r.outfit.footwear = {
      category: 'shoes',
      subcategory: 'sandals',
      color: 'beige',
    };
    r.outfit.accessory = {
      category: 'eyewear',
      subcategory: 'sunglasses',
      color: 'gold',
    };
    r.notes =
      'Center mannequin in multicolor vertical-stripe button-down, dark blue cropped jeans, beige sandals, gold sunglasses';
  }),
);

touch('croydon', '021', (row) =>
  patch(row, (r) => {
    r.outfit.bottom = {
      category: 'shorts',
      subcategory: 'sweat_shorts',
      color: 'beige',
    };
    r.notes =
      'Right adult male mannequin in white oversized tee, beige sweat shorts, white crew socks, chunky white sneakers and white cap';
  }),
);

// Brixton
touch('brixton', '002', (row) =>
  patch(row, (r) => {
    r.outfit.top = {
      category: 'bikini_top',
      subcategory: 'bikini_top',
      color: 'multicolor',
    };
    r.features = { ...(r.features || {}), layering: 'light' };
    r.notes =
      'H&M swim/beach display: multicolor floral bikini top primary; pink-white striped shirt+shorts cover-up and straw tote also present';
  }),
);

touch('brixton', '005', (row) =>
  patch(row, (r) => {
    r.outfit.top = {
      category: 'dress',
      subcategory: 'draped_mini',
      color: 'brown',
    };
    r.outfit.bottom = null;
    r.outfit.footwear = {
      category: 'shoes',
      subcategory: 'heels',
      color: 'brown',
    };
    r.outfit.accessory = {
      category: 'hat',
      subcategory: 'fascinator',
      color: 'brown',
    };
    r.notes =
      'Primary foreground brown draped mini + brown heels/fascinator; lime satin midi is secondary';
    r.colour_palette = ['brown', 'cream', 'green'];
  }),
);

touch('brixton', '010', (row) =>
  patch(row, (r) => {
    r.outfit.top = {
      category: 'blouse',
      subcategory: 'embroidered_sleeveless',
      color: 'brown',
    };
    r.outfit.bottom = {
      category: 'trousers',
      subcategory: 'wide_leg',
      color: 'brown',
    };
    r.outfit.accessory = {
      category: 'hat',
      subcategory: 'straw_hat',
      color: 'natural',
    };
    r.notes =
      'Apricot embroidered sleeveless top + wide-leg trousers in brown with natural straw hat; polka-dot dress secondary';
  }),
);

touch('brixton', '015', (row) =>
  patch(row, (r) => {
    r.outfit.bottom = {
      category: 'shorts',
      subcategory: 'athletic_shorts',
      color: 'black',
    };
    r.outfit.outerwear = {
      category: 'jacket',
      subcategory: 'windbreaker',
      color: 'black',
    };
    r.outfit.accessory = {
      category: 'hat',
      subcategory: 'baseball_cap',
      color: 'brown',
    };
    r.notes =
      'JD Nike window: black zip windbreaker + white tee + black athletic shorts + Nike sneakers + brown baseball cap; black crossbody also present';
  }),
);

touch('brixton', '021', (row) =>
  patch(row, (r) => {
    r.outfit.bottom = {
      category: 'shorts',
      subcategory: 'sweat_shorts',
      color: 'grey',
    };
    r.notes =
      'JD trio: white Unlike Humans tee + grey sweat shorts + Nike runners + Yankees cap (primary adult)';
  }),
);

touch('brixton', '028', (row) => discardRow(row, 'user_discarded_fitting_room'));

// Sloane
touch('sloane', '014', (row) => discardRow(row, 'user_discarded_label_mismatch'));

touch('sloane', '020', (row) =>
  patch(row, (r) => {
    r.outfit.top = {
      category: 'blouse',
      subcategory: 'blouse',
      color: 'multicolor',
    };
    r.outfit.bottom = {
      category: 'skirt',
      subcategory: 'skirt',
      color: 'multicolor',
    };
    r.outfit.outerwear = null;
    r.notes =
      'Two-piece: multicolor blouse + multicolor skirt with midriff cutout (not a single dress)';
    r.colour_palette = ['multicolor', 'beige', 'black', 'rust'];
  }),
);

touch('sloane', '029', (row) => discardRow(row, 'user_discarded_kids'));

// Keep-only rows (no structural change): 004,005,008,009,017,022 croydon; 016,027,029 brixton; 001,003,004,024,026,036 sloane
// Record approval stamp in notes lightly for keep+note footwear confirmations
touch('sloane', '004', (row) => {
  if (!/user approved footwear/i.test(row.notes || '')) {
    row.notes = `${row.notes || ''} User approved: sandals go with outfit.`.trim();
  }
});
touch('sloane', '026', (row) => {
  if (!/user approved footwear/i.test(row.notes || '')) {
    row.notes = `${row.notes || ''} User approved: footwear goes with dress.`.trim();
  }
});

// Persist decisions copy + datasets
fs.copyFileSync(decisionsPath, path.join(__dirname, 'decisions.json'));

for (const { file, rows } of Object.values(datasets)) {
  fs.writeFileSync(file, JSON.stringify(rows, null, 2) + '\n');
}

const summary = {
  applied_at: new Date().toISOString(),
  source_decisions: decisionsPath,
  decision_count: decisions.count ?? decisions.items?.length,
  patches: report,
  discarded: report.filter((x) => x.includes('007') || x.includes('011') || x.includes('028') || x.includes('014') || x.includes('029')),
};
fs.writeFileSync(path.join(__dirname, 'apply_report.json'), JSON.stringify(summary, null, 2));
console.log(report.join('\n'));
console.log('\nWrote datasets + apply_report.json');
