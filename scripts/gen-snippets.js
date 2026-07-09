const fs = require('fs');
const path = require('path');
const { flatToNested } = require('./translation-utils');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-flat.json'), 'utf8'));
const es = JSON.parse(fs.readFileSync(path.join(__dirname, 'es-flat.json'), 'utf8'));
const CORE = new Set([
  'locale', 'localeInfo', 'common', 'nav', 'stylist', 'wardrobe', 'profile',
  'stylistHub', 'bodyScan', 'colorScan', 'quiz', 'onboarding', 'styleArchetypes',
  'styleSelection', 'settings', 'home', 'auth', 'aiStylist',
]);

const ext = {};
for (const [k, v] of Object.entries(en)) {
  if (!CORE.has(k.split('.')[0])) ext[k] = v;
}
const nested = flatToNested(ext);

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fmt(o, d = 1) {
  const pad = '  '.repeat(d);
  let out = '';
  for (const [k, v] of Object.entries(o)) {
    const key = /^[a-zA-Z_]\w*$/.test(k) ? k : `'${k}'`;
    if (typeof v === 'string') {
      out += `${pad}${key}: '${esc(v)}',\n`;
    } else {
      out += `${pad}${key}: {\n${fmt(v, d + 1)}${pad}},\n`;
    }
  }
  return out;
}

fs.writeFileSync(path.join(__dirname, '_extended-en-snippet.txt'), fmt(nested));
const esLines = Object.entries(es)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `    '${esc(k)}': '${esc(v)}',`);
fs.writeFileSync(path.join(__dirname, '_es-snippet.txt'), esLines.join('\n'));
console.log('extended sections:', Object.keys(nested).length, '| es keys:', esLines.length);
