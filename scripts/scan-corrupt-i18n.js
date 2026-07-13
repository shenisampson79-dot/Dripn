const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'locales');
const ICONISH = new Set([
  'more-horizontal','message-square','message-circle','grid','user','camera','zap','star',
  'alert-circle','scissors','credit-card','book-open','calendar','inbox','headphones',
  'check','x','plus','minus','edit','trash','settings','home','search','heart','bell',
  'login','log-out','lock','unlock','mail','phone','globe','map','image','video','mic',
  'volume','play','pause','stop','skip-forward','skip-back','repeat','shuffle','share',
  'download','upload','link','external-link','menu','filter','sliders','eye','eye-off',
  'chevron-down','chevron-up','chevron-left','chevron-right','arrow-left','arrow-right',
  'info','help-circle','alert-triangle','check-circle','x-circle','plus-circle','minus-circle',
]);
const TOKENS = new Set(['label','description','h1','h2','h3','h4','body','small','caption','react','text']);

function reasonFor(key, value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return 'empty';
  const lower = v.toLowerCase();
  if (TOKENS.has(lower)) return 'ui-token';
  if (ICONISH.has(lower)) return 'icon-name';
  if (/response\.|Alert\.alert|t\(['`]|\|\|/.test(v)) return 'code-fragment';
  if (/(couldn|don|isn|won|wouldn|shouldn|hasn|haven|didn)$/i.test(v)) return 'truncated';
  if (/^text:\s*['"]/.test(v)) return 'style-literal';
  if (key.endsWith('.screenTitle') && ['wardrobe','settings','profile','stylist','home'].includes(lower)) {
    // only flag if value looks like nav section not page title
    if (key.startsWith('feedback.') || key.startsWith('support.')) return 'wrong-nav-title';
  }
  return null;
}

const byPrefix = {};
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const [key, value] of Object.entries(data)) {
    const reason = reasonFor(key, value);
    if (!reason) continue;
    const prefix = key.split('.')[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push({ file, key, value, reason });
  }
}

// Focus en.json report
const en = byPrefix;
const enHits = [];
for (const hits of Object.values(byPrefix)) {
  for (const h of hits) if (h.file === 'en.json') enHits.push(h);
}

console.log('EN_CORRUPT_COUNT', enHits.length);
console.log('--- EN BY PREFIX ---');
const prefixes = {};
for (const h of enHits) {
  const p = h.key.split('.')[0];
  prefixes[p] = (prefixes[p] || 0) + 1;
}
console.log(JSON.stringify(prefixes, null, 2));
console.log('--- EN HITS ---');
for (const h of enHits.sort((a,b)=>a.key.localeCompare(b.key))) {
  console.log(`${h.reason}\t${h.key}\t${JSON.stringify(h.value)}`);
}
console.log('--- ALL FILES COUNT ---');
const fileCounts = {};
for (const hits of Object.values(byPrefix)) {
  for (const h of hits) fileCounts[h.file] = (fileCounts[h.file] || 0) + 1;
}
console.log(JSON.stringify(fileCounts, null, 2));
