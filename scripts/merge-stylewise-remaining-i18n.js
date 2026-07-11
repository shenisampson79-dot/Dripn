#!/usr/bin/env node
/**
 * Merge remaining StyleWise onboarding i18n: vibe summary templates + Decide-for-me tips.
 * Run: node scripts/merge-stylewise-remaining-i18n.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const PRIORITY = path.join(__dirname, 'spanish-priority.js');

const EN_KEYS = {
  'preSignupQuiz.vibeWorkHeadline': 'We know your work style',
  'preSignupQuiz.summaryWithStyles':
    "For {occasion}, you leaned {styles}. We'll use that to style you.",
  'preSignupQuiz.summaryWorkLiked':
    "For {occasion}, you liked {names} — {styles}. We'll dress you that way.",
  'preSignupQuiz.summaryWorkLean':
    "You lean {styles} for the office. We'll keep it sharp and intentional.",
  'preSignupQuiz.sharpProfessional': 'sharp and professional',

  'decideForMe.tips.work.0':
    'This look commands respect while remaining approachable. The structure projects competence, while thoughtful details show attention to presentation.',
  'decideForMe.tips.work.1':
    "Professional doesn't mean boring. This outfit balances authority with personality, helping you stand out for the right reasons.",
  'decideForMe.tips.work.2':
    'The key here is polish. Every element works together seamlessly, suggesting someone who has their act together.',
  'decideForMe.tips.date.0':
    "This outfit strikes the perfect balance - put-together without looking like you tried too hard. It says 'I care' without screaming it.",
  'decideForMe.tips.date.1':
    'The silhouette flatters while remaining comfortable. When you feel good, that confidence is your best accessory.',
  'decideForMe.tips.date.2':
    'Romantic undertones with modern edge. This look creates intrigue and suggests depth.',
  'decideForMe.tips.casual.0':
    'Effortless style is about intention disguised as ease. This look appears thrown-together but every piece earns its place.',
  'decideForMe.tips.casual.1':
    "Comfort and style aren't opposites. This outfit proves you can have both without compromise.",
  'decideForMe.tips.casual.2':
    'The secret to great casual style is quality basics. Nothing here screams for attention, yet everything works beautifully.',
  'decideForMe.tips.event.0':
    'Events call for impact. This look makes an entrance while remaining tasteful - memorable for all the right reasons.',
  'decideForMe.tips.event.1':
    'The drama is intentional but controlled. Statement-making without overwhelming the occasion or your personality.',
  'decideForMe.tips.event.2':
    'Special occasions deserve special effort. This outfit shows you understand the assignment.',
  'decideForMe.tips.browsing.0':
    'Versatility is key. This combination works across multiple settings with simple accessory changes.',
  'decideForMe.tips.browsing.1':
    'Investment dressing at its finest. These pieces will serve you well for years, not just this season.',
  'decideForMe.tips.browsing.2':
    "The foundation of a great wardrobe. Build from here and you'll always have something to wear.",

  // Polish a few Spanish-facing style labels that were still pure English
  'preSignupQuiz.styleTag.business': 'Business',
  'preSignupQuiz.styleTag.luxury': 'Luxury',
  'common.saveMyPicks': 'Save my picks',
};

const ES_KEYS = {
  'preSignupQuiz.vibeFallback': 'Ya captamos tu vibe',
  'preSignupQuiz.vibeWorkHeadline': 'Ya captamos tu estilo de trabajo',
  'preSignupQuiz.summaryFallback': 'Entendido — usaremos tus elecciones para estilarte.',
  'preSignupQuiz.summaryWithStyles':
    'Para {occasion}, te inclinaste por {styles}. Lo usaremos para estilarte.',
  'preSignupQuiz.summaryWorkLiked':
    'Para {occasion}, te gustaron {names} — {styles}. Te vestiremos así.',
  'preSignupQuiz.summaryWorkLean':
    'Tiendes a {styles} en la oficina. Lo mantendremos afilado e intencional.',
  'preSignupQuiz.sharpProfessional': 'afilado y profesional',

  'preSignupQuiz.look.date_m_1': 'Cita nocturna impecable',
  'preSignupQuiz.styleTag.classic': 'Clásico',
  'preSignupQuiz.styleTag.smartCasual': 'Smart casual',
  'preSignupQuiz.styleTag.business': 'Business',
  'preSignupQuiz.styleTag.businessCasual': 'Business casual',
  'preSignupQuiz.styleTag.luxury': 'Luxury',
  'preSignupQuiz.styleTag.sporty': 'Deportivo',
  'preSignupQuiz.styleTag.creative': 'Creativo',
  'preSignupQuiz.occasionTag.date': 'Cita',

  'decideForMe.tips.work.0':
    'Este look impone respeto sin perder cercanía. La estructura proyecta competencia, y los detalles cuidan la presentación.',
  'decideForMe.tips.work.1':
    'Profesional no significa aburrido. Este outfit equilibra autoridad y personalidad para destacar por las razones correctas.',
  'decideForMe.tips.work.2':
    'La clave es el acabado. Cada elemento encaja sin esfuerzo, como alguien que tiene todo bajo control.',
  'decideForMe.tips.date.0':
    'Equilibrio perfecto: cuidado sin parecer que te esforzaste demasiado. Dice «me importa» sin gritarlo.',
  'decideForMe.tips.date.1':
    'La silueta favorece y sigue siendo cómoda. Cuando te sientes bien, esa confianza es tu mejor accesorio.',
  'decideForMe.tips.date.2':
    'Toques románticos con filo moderno. Este look genera intriga y sugiere profundidad.',
  'decideForMe.tips.casual.0':
    'El estilo sin esfuerzo es intención disfrazada de facilidad. Parece improvisado, pero cada pieza aporta.',
  'decideForMe.tips.casual.1':
    'Comodidad y estilo no son opuestos. Este outfit demuestra que puedes tener ambos sin renunciar a nada.',
  'decideForMe.tips.casual.2':
    'El secreto del casual excelente son los básicos de calidad. Nada grita atención, y todo funciona.',
  'decideForMe.tips.event.0':
    'Los eventos piden impacto. Este look hace una entrada memorable y con buen gusto.',
  'decideForMe.tips.event.1':
    'El drama es intencional pero controlado. Statement sin tapar la ocasión ni tu personalidad.',
  'decideForMe.tips.event.2':
    'Las ocasiones especiales merecen un esfuerzo especial. Este outfit demuestra que entendiste el brief.',
  'decideForMe.tips.browsing.0':
    'La versatilidad es clave. Esta combinación funciona en varios contextos solo cambiando accesorios.',
  'decideForMe.tips.browsing.1':
    'Inversión inteligente: estas piezas te acompañarán años, no solo esta temporada.',
  'decideForMe.tips.browsing.2':
    'La base de un gran armario. Construye desde aquí y siempre tendrás algo que ponerte.',

  'common.saveMyPicks': 'Guardar mis picks',
  'softSignup.cta.saveMyPicks': 'Guardar mis picks',
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, data) {
  const sorted = {};
  for (const k of Object.keys(data).sort()) sorted[k] = data[k];
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
}

const enFlat = loadJson(EN_FLAT);
let enAdded = 0;
for (const [k, v] of Object.entries(EN_KEYS)) {
  if (enFlat[k] !== v) {
    enFlat[k] = v;
    enAdded++;
  }
}
saveJson(EN_FLAT, enFlat);
console.log(`en-flat.json: ${enAdded} keys set`);

const localeFiles = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
for (const file of localeFiles) {
  const lang = file.replace('.json', '');
  const p = path.join(LOCALES_DIR, file);
  const data = loadJson(p);
  let n = 0;
  for (const [k, enVal] of Object.entries(EN_KEYS)) {
    const next =
      lang === 'es' && ES_KEYS[k]
        ? ES_KEYS[k]
        : lang === 'en'
          ? enVal
          : data[k] && data[k] !== ''
            ? data[k]
            : enVal;
    if (data[k] !== next) {
      data[k] = next;
      n++;
    }
  }
  if (lang === 'es') {
    for (const [k, v] of Object.entries(ES_KEYS)) {
      if (data[k] !== v) {
        data[k] = v;
        n++;
      }
    }
  }
  saveJson(p, data);
  console.log(`updated ${lang} (+${n})`);
}

// Append missing keys to i18n-keys.txt
if (fs.existsSync(KEYS_FILE)) {
  const existing = new Set(
    fs
      .readFileSync(KEYS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  let appended = 0;
  const lines = [];
  for (const k of Object.keys(EN_KEYS).sort()) {
    if (!existing.has(k)) {
      lines.push(k);
      appended++;
    }
  }
  if (appended) {
    fs.appendFileSync(KEYS_FILE, '\n' + lines.join('\n') + '\n');
    console.log(`i18n-keys.txt: +${appended}`);
  }
}

// Patch spanish-priority.js with any missing ES keys
if (fs.existsSync(PRIORITY)) {
  let src = fs.readFileSync(PRIORITY, 'utf8');
  let added = 0;
  const insertLines = [];
  for (const [k, v] of Object.entries(ES_KEYS)) {
    if (!src.includes(`'${k}'`) && !src.includes(`"${k}"`)) {
      insertLines.push(`  '${k}': ${JSON.stringify(v)},`);
      added++;
    }
  }
  if (insertLines.length) {
    const lastBrace = src.lastIndexOf('};');
    if (lastBrace !== -1) {
      src =
        src.slice(0, lastBrace) +
        '\n  // ─── Remaining StyleWise vibe / tips ───\n' +
        insertLines.join('\n') +
        '\n' +
        src.slice(lastBrace);
      fs.writeFileSync(PRIORITY, src);
      console.log(`spanish-priority.js: +${added}`);
    }
  } else {
    console.log('spanish-priority.js: already has keys');
  }
}

console.log('done');
