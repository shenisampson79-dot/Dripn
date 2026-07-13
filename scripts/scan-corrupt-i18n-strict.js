const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'locales', 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// High-confidence corruption heuristics from the bad i18n extract
const ICON_NAMES = /^(more-horizontal|message-square|message-circle|grid|user|camera|zap|star|alert-circle|scissors|credit-card|book-open|calendar|inbox|headphones|settings|home|login|log-out|chevron-|arrow-|check-circle|x-circle|plus-circle|minus-circle|help-circle|alert-triangle|external-link|sliders|eye-off|skip-forward|skip-back)$/i;
const PLACEHOLDER = /^(Label|Description|Title|Subtitle|Placeholder|Text|Button|Icon|Value|Key|Name)$/;
const CODEY = /(response\.message|Alert\.alert|\|\|\s*[`'"]|t\(['"`]|=>\s*\{|\.trim\(\)|console\.|JSON\.stringify)/;
const TRUNC = /^(We couldn|Couldn|You haven|It doesn|I don|We don|That won|This isn|Something isn)$/i;
const TYPESCALE = /^(h1|h2|h3|h4|body|small|caption|react)$/i;

const hits = [];
for (const [key, value] of Object.entries(en)) {
  if (typeof value !== 'string') continue;
  const v = value.trim();
  let reasons = [];
  if (PLACEHOLDER.test(v) && !key.endsWith('Label') && !key.includes('placeholder') && !key.endsWith('.titleLabel') && !key.endsWith('.descriptionLabel') && !key.endsWith('titleLabel')) {
    // "Title"/"Description" as section labels can be valid; flag when used as type labels / ratings / categories
    if (/\.(type|category|rating|required|thankYou|submission|screenTitle)\b/.test(key) || /\.label$/.test(key) || /\.description$/.test(key)) {
      reasons.push('placeholder-token');
    }
  }
  if (PLACEHOLDER.test(v) && /\.(type|category|rating)\./.test(key)) reasons.push('placeholder-token');
  if (ICON_NAMES.test(v) && !/^(nav\.|common\.|settings\.title$)/.test(key)) reasons.push('icon-as-copy');
  if (CODEY.test(v)) reasons.push('code-fragment');
  if (TRUNC.test(v)) reasons.push('truncated');
  if (TYPESCALE.test(v)) reasons.push('typescale-token');
  // sibling type labels all identical generic
  if (reasons.length) hits.push({ key, value: v, reasons: [...new Set(reasons)] });
}

// Also detect clusters: same wrong value repeated across type.*.label
const typeLabels = Object.entries(en).filter(([k]) => /\.type\.[^.]+\.label$/.test(k));
const byVal = {};
for (const [k, v] of typeLabels) {
  byVal[v] = byVal[v] || [];
  byVal[v].push(k);
}
for (const [v, keys] of Object.entries(byVal)) {
  if (keys.length >= 3 && PLACEHOLDER.test(v)) {
    for (const k of keys) hits.push({ key: k, value: v, reasons: ['repeated-placeholder'] });
  }
}

// Deduplicate
const seen = new Set();
const uniq = [];
for (const h of hits) {
  if (seen.has(h.key)) continue;
  seen.add(h.key);
  uniq.push(h);
}

console.log(JSON.stringify({ count: uniq.length, hits: uniq.sort((a,b)=>a.key.localeCompare(b.key)) }, null, 2));

// Also scan ALL locales for code-fragment / truncated / typescale / icon-as-copy (high confidence only)
const dir = path.join(__dirname, '..', 'locales');
const all = [];
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue;
    const v = value.trim();
    const reasons = [];
    if (CODEY.test(v)) reasons.push('code-fragment');
    if (TRUNC.test(v)) reasons.push('truncated');
    if (TYPESCALE.test(v)) reasons.push('typescale-token');
    if (ICON_NAMES.test(v) && !/^(nav\.|common\.share$|common\.home$|settings\.title$)/.test(key) && !['Share','Home','Settings'].includes(v)) {
      reasons.push('icon-as-copy');
    }
    if (PLACEHOLDER.test(v) && /\.(type|category|rating)\./.test(key)) reasons.push('placeholder-token');
    if (reasons.length) all.push({ file, key, value: v, reasons });
  }
}
console.log('---ALL_LOCALES_HIGH_CONF---');
console.log(JSON.stringify({ count: all.length, sample: all.slice(0, 80) }, null, 2));
