#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const EN = {
  'decideForMe.firstMessage': "Tell me what you're dressing for — I'll decide the outfit.",
  'decideForMe.tempInLocation': '{temp}° in {location}',
  'decideForMe.keepOutfitTitle': 'Keep this outfit?',
  'decideForMe.keepOutfitSubtitle': 'Create a free account to save it forever',
  'decideForMe.yourOutfitRecommendation': 'Your outfit recommendation',
  'decideForMe.rubyAdjusting': 'Ruby is adjusting your look...',
  'decideForMe.disclaimer': "I'm choosing generally. With your wardrobe, I'd choose specifically.",
  'decideForMe.visualizing': 'Visualizing your outfit...',
  'decideForMe.sendFeedbackA11y': 'Send feedback to Ruby',
  'decideForMe.justBrowsingCta': "I'm just browsing",
  'decideForMe.defaultReasoning': 'This look balances comfort with style, perfect for your occasion.',
};

const ES = {
  'decideForMe.firstMessage': 'Dime para qué te vistes — yo decido el outfit.',
  'decideForMe.tempInLocation': '{temp}° en {location}',
  'decideForMe.keepOutfitTitle': '¿Guardar este outfit?',
  'decideForMe.keepOutfitSubtitle': 'Crea una cuenta gratis para guardarlo para siempre',
  'decideForMe.yourOutfitRecommendation': 'Tu recomendación de outfit',
  'decideForMe.rubyAdjusting': 'Ruby está ajustando tu look...',
  'decideForMe.disclaimer': 'Estoy eligiendo en general. Con tu armario, elegiría de forma específica.',
  'decideForMe.visualizing': 'Visualizando tu outfit...',
  'decideForMe.sendFeedbackA11y': 'Enviar feedback a Ruby',
  'decideForMe.justBrowsingCta': 'Solo estoy mirando',
  'decideForMe.defaultReasoning': 'Este look equilibra comodidad y estilo, perfecto para tu ocasión.',
};

function save(p, obj) {
  const s = {};
  for (const k of Object.keys(obj).sort()) s[k] = obj[k];
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
}

const enFlatPath = path.join(__dirname, 'en-flat.json');
const enFlat = JSON.parse(fs.readFileSync(enFlatPath, 'utf8'));
Object.assign(enFlat, EN);
save(enFlatPath, enFlat);

const localesDir = path.join(__dirname, '..', 'locales');
for (const f of fs.readdirSync(localesDir).filter((x) => x.endsWith('.json'))) {
  const lang = f.replace('.json', '');
  const p = path.join(localesDir, f);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(EN)) {
    if (lang === 'en') d[k] = v;
    else if (lang === 'es') d[k] = ES[k];
    else if (!d[k]) d[k] = v;
  }
  save(p, d);
}
console.log('alias keys added');
