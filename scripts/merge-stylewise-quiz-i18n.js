#!/usr/bin/env node
/**
 * Localize pre-signup quiz looks, vibe summary, Decide-for-me style rules, soft signup gate.
 * Run: node scripts/merge-stylewise-quiz-i18n.js
 * Then: node scripts/generate-all-locales.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const PRIORITY = path.join(__dirname, 'spanish-priority.js');
const OUTFITS = path.join(ROOT, 'constants/preSignupQuizOutfits.ts');

function quizLabelSlug(label) {
  return label
    .replace(/[\/·|,]+/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function parseOutfits(src) {
  const blocks = [...src.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?style:\s*'([^']+)'[\s\S]*?occasion:\s*'([^']+)'/g)];
  return blocks.map((m) => ({ id: m[1], name: m[2], style: m[3], occasion: m[4] }));
}

const outfits = parseOutfits(fs.readFileSync(OUTFITS, 'utf8'));
const styles = [...new Set(outfits.map((o) => o.style))];
const occasions = [...new Set(outfits.map((o) => o.occasion))];

const EN_KEYS = {
  // Vibe completion templates
  'preSignupQuiz.headline.vibe': 'We know your vibe',
  'preSignupQuiz.headline.work': 'We know your work style',
  'preSignupQuiz.summary.leaned':
    "For {occasion}, you leaned {styles}. We'll use that to style you.",
  'preSignupQuiz.summary.workLiked':
    "For {occasion}, you liked {names} — {styles}. We'll dress you that way.",
  'preSignupQuiz.summary.workLean':
    "You lean {styles} for the office. We'll keep it sharp and intentional.",
  'preSignupQuiz.workLeanFallback': 'sharp and professional',

  // Soft signup gate
  'softSignup.msg.second_opinion_urgent': 'Sign up to get Fast feedback from our community',
  'softSignup.msg.quick_start': 'Want me to remember this and keep styling for you?',
  'softSignup.msg.inspirations_only': 'Want me to remember your preferences?',
  'softSignup.msg.done_for_you': 'Create an account to complete your setup.',
  'softSignup.msg.browsing': 'Save your style picks for next time?',
  'softSignup.msg.default': 'Want me to remember this for next time?',
  'softSignup.benefit.urgent.0': 'Get real feedback from real people',
  'softSignup.benefit.urgent.1': 'Quick responses within 45 minutes',
  'softSignup.benefit.urgent.2': 'Know if your outfit works',
  'softSignup.benefit.browse.0': 'Save outfits you like',
  'softSignup.benefit.browse.1': 'Browse your style history',
  'softSignup.benefit.browse.2': 'Get personalised picks',
  'softSignup.benefit.default.0': 'Save your recommendations',
  'softSignup.benefit.default.1': 'Get better styling over time',
  'softSignup.benefit.default.2': 'Unlock all AI stylist features',
  'softSignup.cta.getFastFeedback': 'Get Fast feedback',
  'softSignup.cta.saveMyPicks': 'Save my picks',
  'softSignup.cta.signUpToSave': 'Sign up to save',
  'softSignup.cta.maybeLater': 'Maybe later',
  'softSignup.cta.browseAsGuest': 'Browse as guest',
  'softSignup.cta.continueWithoutSaving': 'Continue without saving',

  // Style rules (Decide for me)
  'decideForMe.rules.work.0':
    'The Rule of Three: Limit your outfit to three main colors for a polished, professional look.',
  'decideForMe.rules.work.1':
    'Fit Over Fashion: A well-fitted basic beats an ill-fitting trend every time.',
  'decideForMe.rules.work.2':
    'The One Statement Rule: Choose one standout piece and keep everything else understated.',
  'decideForMe.rules.work.3':
    'Texture Mixing: Combine smooth and textured fabrics for visual interest without bold patterns.',
  'decideForMe.rules.date.0':
    'The 60-30-10 Rule: 60% dominant color, 30% secondary, 10% accent for balanced appeal.',
  'decideForMe.rules.date.1':
    'Show or Tell: If showing skin up top, cover below (and vice versa) for elegant allure.',
  'decideForMe.rules.date.2':
    "Comfort is Confidence: You'll look your best in clothes you feel amazing in.",
  'decideForMe.rules.date.3':
    'The Soft Touch: Incorporate one touchable fabric to invite connection.',
  'decideForMe.rules.casual.0':
    'Elevated Basics: Quality basics styled intentionally always beat cheap trends.',
  'decideForMe.rules.casual.1':
    'The Anchor Piece: Build your outfit around one quality item you love.',
  'decideForMe.rules.casual.2':
    'Tonal Dressing: Wearing similar shades creates effortless sophistication.',
  'decideForMe.rules.casual.3':
    'Proportional Play: Balance volume - if loose on top, fitted below.',
  'decideForMe.rules.event.0':
    'The Silhouette Secret: Choose clothes that accentuate your best feature.',
  'decideForMe.rules.event.1':
    'Less is More: One bold accessory makes more impact than many competing pieces.',
  'decideForMe.rules.event.2':
    'Occasion Appropriate: Slightly overdressed shows respect; underdressed shows indifference.',
  'decideForMe.rules.event.3':
    'The Final Edit: Remove one thing before you leave - usually the right choice.',
  'decideForMe.rules.browsing.0':
    'Capsule Thinking: Invest in pieces that work with 5+ items in your wardrobe.',
  'decideForMe.rules.browsing.1':
    'Cost Per Wear: A £200 jacket worn 100 times costs less than a £50 one worn twice.',
  'decideForMe.rules.browsing.2':
    "The Mirror Test: If you don't love it in the changing room, you won't wear it at home.",
  'decideForMe.rules.browsing.3':
    'Quality Over Quantity: One perfect piece beats five mediocre ones.',

  'decideForMe.explanations.work.0':
    'This look commands respect while remaining approachable. The structure projects competence, while thoughtful details show attention to presentation.',
  'decideForMe.explanations.work.1':
    "Professional doesn't mean boring. This outfit balances authority with personality, helping you stand out for the right reasons.",
  'decideForMe.explanations.work.2':
    'The key here is polish. Every element works together seamlessly, suggesting someone who has their act together.',
  'decideForMe.explanations.date.0':
    "This outfit strikes the perfect balance - put-together without looking like you tried too hard. It says 'I care' without screaming it.",
  'decideForMe.explanations.date.1':
    'The silhouette flatters while remaining comfortable. When you feel good, that confidence is your best accessory.',
  'decideForMe.explanations.date.2':
    'Romantic undertones with modern edge. This look creates intrigue and suggests depth.',
  'decideForMe.explanations.casual.0':
    'Effortless style is about intention disguised as ease. This look appears thrown-together but every piece earns its place.',
  'decideForMe.explanations.casual.1':
    "Comfort and style aren't opposites. This outfit proves you can have both without compromise.",
  'decideForMe.explanations.casual.2':
    'The secret to great casual style is quality basics. Nothing here screams for attention, yet everything works beautifully.',
  'decideForMe.explanations.event.0':
    'Events call for impact. This look makes an entrance while remaining tasteful - memorable for all the right reasons.',
  'decideForMe.explanations.event.1':
    'The drama is intentional but controlled. Statement-making without overwhelming the occasion or your personality.',
  'decideForMe.explanations.event.2':
    'Special occasions deserve special effort. This outfit shows you understand the assignment.',
  'decideForMe.explanations.browsing.0':
    'Versatility is key. This combination works across multiple settings with simple accessory changes.',
  'decideForMe.explanations.browsing.1':
    'Investment dressing at its finest. These pieces will serve you well for years, not just this season.',
  'decideForMe.explanations.browsing.2':
    "The foundation of a great wardrobe. Build from here and you'll always have something to wear.",
};

for (const o of outfits) {
  EN_KEYS[`preSignupQuiz.look.${o.id}`] = o.name;
}
for (const style of styles) {
  EN_KEYS[`preSignupQuiz.styleTag.${quizLabelSlug(style)}`] = style;
}
for (const occasion of occasions) {
  EN_KEYS[`preSignupQuiz.occasionTag.${quizLabelSlug(occasion)}`] = occasion;
}

const ES_KEYS = {
  'preSignupQuiz.headline.vibe': 'Ya captamos tu vibe',
  'preSignupQuiz.headline.work': 'Ya conocemos tu estilo de trabajo',
  'preSignupQuiz.summary.leaned':
    'Para {occasion}, te inclinaste por {styles}. Lo usaremos para estilarte.',
  'preSignupQuiz.summary.workLiked':
    'Para {occasion}, te gustaron {names} — {styles}. Te vestiremos así.',
  'preSignupQuiz.summary.workLean':
    'En la oficina te inclinas por {styles}. Lo mantendremos afilado e intencional.',
  'preSignupQuiz.workLeanFallback': 'afilado y profesional',

  'softSignup.msg.second_opinion_urgent': 'Regístrate para recibir feedback rápido de nuestra comunidad',
  'softSignup.msg.quick_start': '¿Quieres que lo recuerde y siga estilándote?',
  'softSignup.msg.inspirations_only': '¿Quieres que recuerde tus preferencias?',
  'softSignup.msg.done_for_you': 'Crea una cuenta para completar tu configuración.',
  'softSignup.msg.browsing': '¿Guardar tus elecciones de estilo para la próxima?',
  'softSignup.msg.default': '¿Quieres que lo recuerde para la próxima vez?',
  'softSignup.benefit.urgent.0': 'Feedback real de personas reales',
  'softSignup.benefit.urgent.1': 'Respuestas rápidas en unos 45 minutos',
  'softSignup.benefit.urgent.2': 'Saber si tu outfit funciona',
  'softSignup.benefit.browse.0': 'Guarda los outfits que te gusten',
  'softSignup.benefit.browse.1': 'Consulta tu historial de estilo',
  'softSignup.benefit.browse.2': 'Recibe picks personalizados',
  'softSignup.benefit.default.0': 'Guarda tus recomendaciones',
  'softSignup.benefit.default.1': 'Mejor estilo con el tiempo',
  'softSignup.benefit.default.2': 'Desbloquea todas las funciones del estilista IA',
  'softSignup.cta.getFastFeedback': 'Pedir feedback rápido',
  'softSignup.cta.saveMyPicks': 'Guardar mis picks',
  'softSignup.cta.signUpToSave': 'Regístrate para guardar',
  'softSignup.cta.maybeLater': 'Quizá más tarde',
  'softSignup.cta.browseAsGuest': 'Explorar como invitado',
  'softSignup.cta.continueWithoutSaving': 'Continuar sin guardar',

  'decideForMe.rules.work.0':
    'La regla de tres: limita el outfit a tres colores principales para un look pulido y profesional.',
  'decideForMe.rules.work.1':
    'El ajuste manda: un básico bien cortado gana siempre a una tendencia mal puesta.',
  'decideForMe.rules.work.2':
    'Una sola pieza statement: elige un protagonista y deja el resto en segundo plano.',
  'decideForMe.rules.work.3':
    'Mezcla de texturas: combina tejidos lisos y con relieve para interés visual sin estampados fuertes.',
  'decideForMe.rules.date.0':
    'La regla 60-30-10: 60% color dominante, 30% secundario, 10% acento para un equilibrio atractivo.',
  'decideForMe.rules.date.1':
    'Mostrar o sugerir: si enseñas piel arriba, cubre abajo (y viceversa) para un magnetismo elegante.',
  'decideForMe.rules.date.2':
    'La comodidad es confianza: lucirás mejor en lo que te hace sentir increíble.',
  'decideForMe.rules.date.3':
    'El toque suave: incorpora un tejido agradable al tacto que invite a la cercanía.',
  'decideForMe.rules.casual.0':
    'Básicos elevados: básicos de calidad bien estilados siempre ganan a tendencias baratas.',
  'decideForMe.rules.casual.1':
    'La pieza ancla: construye el outfit alrededor de una prenda de calidad que ames.',
  'decideForMe.rules.casual.2':
    'Vestir en tonos: tonos similares crean sofisticación sin esfuerzo.',
  'decideForMe.rules.casual.3':
    'Juego de proporciones: equilibra volumen — si va holgado arriba, ajustado abajo.',
  'decideForMe.rules.event.0':
    'El secreto de la silueta: elige prendas que resalten tu mejor rasgo.',
  'decideForMe.rules.event.1':
    'Menos es más: un accesorio fuerte impacta más que varias piezas compitiendo.',
  'decideForMe.rules.event.2':
    'A la altura de la ocasión: ir un poco más vestido muestra respeto; ir corto, indiferencia.',
  'decideForMe.rules.event.3':
    'La edición final: quítate una cosa antes de salir — casi siempre es la decisión correcta.',
  'decideForMe.rules.browsing.0':
    'Pensamiento cápsula: invierte en piezas que combinen con 5+ ítems de tu armario.',
  'decideForMe.rules.browsing.1':
    'Coste por uso: una chaqueta de 200 € usada 100 veces cuesta menos que una de 50 € usada dos.',
  'decideForMe.rules.browsing.2':
    'La prueba del espejo: si no te encanta en el probador, no te la pondrás en casa.',
  'decideForMe.rules.browsing.3':
    'Calidad sobre cantidad: una pieza perfecta gana a cinco mediocres.',

  'decideForMe.explanations.work.0':
    'Este look impone respeto sin dejar de ser cercano. La estructura proyecta competencia y los detalles cuidan la presentación.',
  'decideForMe.explanations.work.1':
    'Profesional no significa aburrido. Este outfit equilibra autoridad y personalidad para destacar por las razones correctas.',
  'decideForMe.explanations.work.2':
    'La clave es el pulido. Cada elemento encaja sin esfuerzo y transmite alguien que lo tiene claro.',
  'decideForMe.explanations.date.0':
    'Equilibrio perfecto: cuidado sin parecer que te esforzaste de más. Dice «me importa» sin gritarlo.',
  'decideForMe.explanations.date.1':
    'La silueta favorece y sigue siendo cómoda. Cuando te sientes bien, esa confianza es tu mejor accesorio.',
  'decideForMe.explanations.date.2':
    'Toques románticos con filo moderno. Este look genera intrigue y sugiere profundidad.',
  'decideForMe.explanations.casual.0':
    'El estilo effortless es intención disfrazada de facilidad. Parece improvisado, pero cada pieza aporta.',
  'decideForMe.explanations.casual.1':
    'Comodidad y estilo no son opuestos. Este outfit demuestra que puedes tener ambos.',
  'decideForMe.explanations.casual.2':
    'El secreto del buen casual son los básicos de calidad. Nada grita atención, y todo funciona.',
  'decideForMe.explanations.event.0':
    'Los eventos piden impacto. Este look hace entrada con gusto — memorable por las razones correctas.',
  'decideForMe.explanations.event.1':
    'El drama es intencional pero controlado. Afirmas presencia sin ahogar la ocasión ni tu personalidad.',
  'decideForMe.explanations.event.2':
    'Las ocasiones especiales merecen esfuerzo especial. Este outfit demuestra que entendiste el brief.',
  'decideForMe.explanations.browsing.0':
    'La versatilidad manda. Esta combinación funciona en varios contextos con un cambio de accesorios.',
  'decideForMe.explanations.browsing.1':
    'Inversión en estado puro. Estas piezas te servirán años, no solo esta temporada.',
  'decideForMe.explanations.browsing.2':
    'La base de un gran armario. Construye desde aquí y siempre tendrás algo que ponerte.',

  // Style tags
  'preSignupQuiz.styleTag.smartCasual': 'Smart casual',
  'preSignupQuiz.styleTag.business': 'Business',
  'preSignupQuiz.styleTag.businessCasual': 'Business casual',
  'preSignupQuiz.styleTag.luxury': 'Luxury',
  'preSignupQuiz.styleTag.chic': 'Chic',
  'preSignupQuiz.styleTag.boho': 'Boho',
  'preSignupQuiz.styleTag.classic': 'Clásico',
  'preSignupQuiz.styleTag.streetwear': 'Streetwear',
  'preSignupQuiz.styleTag.sporty': 'Deportivo',
  'preSignupQuiz.styleTag.creative': 'Creativo',

  // Occasion tags
  'preSignupQuiz.occasionTag.work': 'Trabajo',
  'preSignupQuiz.occasionTag.date': 'Cita',
  'preSignupQuiz.occasionTag.goingOut': 'Salir',
  'preSignupQuiz.occasionTag.formalGala': 'Gala formal',
  'preSignupQuiz.occasionTag.cocktailParty': 'Cóctel',
  'preSignupQuiz.occasionTag.theatreArts': 'Teatro / artes',
  'preSignupQuiz.occasionTag.artOpening': 'Inauguración',
  'preSignupQuiz.occasionTag.outdoorEvent': 'Evento al aire libre',
  'preSignupQuiz.occasionTag.festival': 'Festival',
  'preSignupQuiz.occasionTag.outdoorFestival': 'Festival outdoor',
  'preSignupQuiz.occasionTag.liveMusic': 'Música en vivo',
  'preSignupQuiz.occasionTag.wedding': 'Boda',
  'preSignupQuiz.occasionTag.ceremony': 'Ceremonia',
  'preSignupQuiz.occasionTag.gardenParty': 'Garden party',
  'preSignupQuiz.occasionTag.everyday': 'Día a día',

  // Look titles (marketing Spanish)
  'preSignupQuiz.look.work_f_1': 'Oficina impecable',
  'preSignupQuiz.look.work_f_2': 'Lista para la reunión',
  'preSignupQuiz.look.work_f_3': 'Profesional creativa',
  'preSignupQuiz.look.work_f_4': 'Blazer y denim en la oficina',
  'preSignupQuiz.look.work_m_1': 'Traje ejecutivo',
  'preSignupQuiz.look.work_m_2': 'Reunión de poder',
  'preSignupQuiz.look.work_m_3': 'Afilado en la junta',
  'preSignupQuiz.look.work_m_4': 'Oficina moderna',
  'preSignupQuiz.look.work_m_5': 'Comida con cliente',
  'preSignupQuiz.look.work_m_6': 'Casual de escritorio',
  'preSignupQuiz.look.date_f_1': 'Romance de noche',
  'preSignupQuiz.look.date_f_2': 'Cita a cenar',
  'preSignupQuiz.look.date_f_3': 'Atractivo sin esfuerzo',
  'preSignupQuiz.look.date_f_4': 'Romántico suave',
  'preSignupQuiz.look.date_m_1': 'Noche de cita impecable',
  'preSignupQuiz.look.date_m_2': 'Encanto relajado',
  'preSignupQuiz.look.date_m_3': 'Listo para el wine bar',
  'preSignupQuiz.look.date_m_4': 'Vestido para impresionar',
  'preSignupQuiz.look.friends_f_1': 'Noche chic',
  'preSignupQuiz.look.friends_f_2': 'Brunch casual',
  'preSignupQuiz.look.friends_f_3': 'Energía de finde',
  'preSignupQuiz.look.friends_f_4': 'De bar en bar',
  'preSignupQuiz.look.friends_f_5': 'Festival con amigas',
  'preSignupQuiz.look.friends_m_1': 'Finde cool',
  'preSignupQuiz.look.friends_m_2': 'Noche street',
  'preSignupQuiz.look.friends_m_3': 'Listo para el pub',
  'preSignupQuiz.look.friends_m_4': 'Crew casual',
  'preSignupQuiz.look.friends_m_5': 'Look de concierto',
  'preSignupQuiz.look.event_f_1': 'Glamour de gala',
  'preSignupQuiz.look.event_f_2': 'Hora del cóctel',
  'preSignupQuiz.look.event_f_3': 'Noche de teatro',
  'preSignupQuiz.look.event_f_4': 'Inauguración de galería',
  'preSignupQuiz.look.event_f_5': 'Garden party',
  'preSignupQuiz.look.event_f_6': 'Espíritu festival',
  'preSignupQuiz.look.event_f_7': 'Fest de verano',
  'preSignupQuiz.look.event_f_8': 'Noche de concierto',
  'preSignupQuiz.look.event_m_1': 'Black tie',
  'preSignupQuiz.look.event_m_2': 'Invitado de boda',
  'preSignupQuiz.look.event_m_3': 'Noche de premios',
  'preSignupQuiz.look.event_m_4': 'Teatro smart',
  'preSignupQuiz.look.event_m_5': 'Lounge de cóctel',
  'preSignupQuiz.look.event_m_6': 'Soirée de verano',
  'preSignupQuiz.look.event_m_7': 'Fit de festival',
  'preSignupQuiz.look.event_m_8': 'Fest outdoor',
  'preSignupQuiz.look.event_m_9': 'Crew de concierto',
  'preSignupQuiz.look.myself_f_1': 'Athleisure cozy',
  'preSignupQuiz.look.myself_f_2': 'Boho fácil',
  'preSignupQuiz.look.myself_f_3': 'Capas suaves',
  'preSignupQuiz.look.myself_f_4': 'Comodidad off-duty',
  'preSignupQuiz.look.myself_f_5': 'Recados con estilo',
  'preSignupQuiz.look.myself_m_1': 'Loungewear luxe',
  'preSignupQuiz.look.myself_m_2': 'Paseo relajado',
  'preSignupQuiz.look.myself_m_3': 'Fácil del finde',
  'preSignupQuiz.look.myself_m_4': 'Café al paso',
  'preSignupQuiz.look.myself_m_5': 'De casa a la calle',
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
}

function upsert(target, keys) {
  let n = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (target[k] !== v) {
      target[k] = v;
      n++;
    }
  }
  return n;
}

const enFlat = fs.existsSync(EN_FLAT) ? loadJson(EN_FLAT) : {};
const nEn = upsert(enFlat, EN_KEYS);
// Keep vibeFallback / summaryFallback aligned with new headlines
enFlat['preSignupQuiz.vibeFallback'] = EN_KEYS['preSignupQuiz.headline.vibe'];
enFlat['preSignupQuiz.summaryFallback'] =
  "Got it — we'll use your picks to style you.";
saveJson(EN_FLAT, enFlat);
console.log(`en-flat.json: upserted ${nEn} (total ${Object.keys(enFlat).length})`);
console.log(`  looks=${outfits.length} styles=${styles.length} occasions=${occasions.length}`);

if (fs.existsSync(KEYS_FILE)) {
  const existing = fs.readFileSync(KEYS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const keySet = new Set([...existing, ...Object.keys(EN_KEYS)]);
  fs.writeFileSync(KEYS_FILE, [...keySet].sort().join('\n') + '\n');
}

for (const file of fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))) {
  const lang = file.replace('.json', '');
  const p = path.join(LOCALES_DIR, file);
  const data = loadJson(p);
  let n = 0;
  for (const [k, enVal] of Object.entries(EN_KEYS)) {
    if (lang === 'en') {
      if (data[k] !== enVal) {
        data[k] = enVal;
        n++;
      }
    } else if (lang === 'es' && ES_KEYS[k]) {
      if (data[k] !== ES_KEYS[k]) {
        data[k] = ES_KEYS[k];
        n++;
      }
    } else if (!data[k]) {
      data[k] = enVal;
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
    data['preSignupQuiz.vibeFallback'] = ES_KEYS['preSignupQuiz.headline.vibe'];
    data['preSignupQuiz.summaryFallback'] =
      'Entendido — usaremos tus elecciones para estilarte.';
  }
  if (lang === 'en') {
    data['preSignupQuiz.vibeFallback'] = EN_KEYS['preSignupQuiz.headline.vibe'];
  }
  saveJson(p, data);
  console.log(`updated ${lang} (+${n})`);
}

// Upsert spanish-priority.js entries
if (fs.existsSync(PRIORITY)) {
  let src = fs.readFileSync(PRIORITY, 'utf8');
  const marker = '// ─── StyleWise quiz / soft signup / style rules ───';
  const block =
    `\n  ${marker}\n` +
    Object.entries(ES_KEYS)
      .map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`)
      .join('\n') +
    '\n';
  if (src.includes(marker)) {
    // Replace existing block through closing };
    const start = src.indexOf(marker);
    const before = src.slice(0, src.lastIndexOf('\n', start));
    // Find last }; of module.exports
    const lastBrace = src.lastIndexOf('};');
    // Keep keys before marker: find line start of marker section
    const cutAt = src.lastIndexOf('\n', start);
    src = src.slice(0, cutAt) + block + src.slice(lastBrace);
  } else {
    const lastBrace = src.lastIndexOf('};');
    src = src.slice(0, lastBrace) + block + src.slice(lastBrace);
  }
  fs.writeFileSync(PRIORITY, src);
  console.log('spanish-priority.js: upserted quiz/softSignup/rules keys');
}

console.log('done');
