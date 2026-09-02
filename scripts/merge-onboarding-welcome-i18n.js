#!/usr/bin/env node
/**
 * Merge onboarding + entry + decide-for-me chrome i18n keys.
 * Key names match TrustOnboardingScreen (pos0, asp2, tf0, ctrl0, …).
 * Run: node scripts/merge-onboarding-welcome-i18n.js
 * Then: node scripts/generate-all-locales.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const LOCALES_DIR = path.join(ROOT, 'locales');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const PRIORITY = path.join(__dirname, 'spanish-priority.js');

const EN_KEYS = {
  // Entry
  'onboardingEntry.title': 'We decide. You look better.',
  'onboardingEntry.subtitle':
    'Zero effort — your stylist picks the outfit so you outdress the room.',
  'onboardingEntry.decideForMe': 'Decide for me',
  'onboardingEntry.decideForMeSubtitle': 'One answer. Out the door.',
  'onboardingEntry.styleMeProperly': 'Style me properly',
  'onboardingEntry.styleMeProperlySubtitle': 'Using my wardrobe when ready',
  'onboardingEntry.alreadyHaveAccount': 'Already have an account? Sign in',
  'onboardingEntry.seeHowItWorks': 'See how it works before signing up',

  'trustOnboarding.letsGo': "Let's Go",

  'trustOnboarding.pos0.headline': 'Stop overthinking what to wear.',
  'trustOnboarding.pos0.subtext':
    'An opinionated AI stylist that helps you decide what to wear — using your wardrobe when available.',
  'trustOnboarding.pos1.headline': "You've stared at your wardrobe for 20 minutes. Again.",
  'trustOnboarding.pos1.subtext': "Let's fix that. One clear answer, every time.",
  'trustOnboarding.pos2.headline': 'Three outfits on the bed. Zero confidence in any of them.',
  'trustOnboarding.pos2.subtext': "Sound familiar? I'll help you pick which one to wear.",
  'trustOnboarding.pos3.headline': 'Running late because you changed twice.',
  'trustOnboarding.pos3.subtext': 'Get dressed with certainty. First time, every time.',
  'trustOnboarding.pos4.headline': 'The longer you look, the less you know.',
  'trustOnboarding.pos4.subtext': 'Break the spiral. Get a clear answer in seconds.',
  'trustOnboarding.pos5.headline': "Your wardrobe isn't the problem. The decision is.",
  'trustOnboarding.pos5.subtext': "I'll help you make the call. You make the exit.",

  'trustOnboarding.asp0.headline': "Walk in looking like you planned it. Even if you didn't.",
  'trustOnboarding.asp0.subtext':
    "I'll help you pick — so you look like you meant it, without the overthinking.",
  'trustOnboarding.asp1.headline': 'Be the best-dressed person in the room — without trying.',
  'trustOnboarding.asp1.subtext': "Your friends will ask where you shop. You don't have to know.",
  'trustOnboarding.asp2.headline': "Stop being the one who 'doesn't really do fashion.'",
  'trustOnboarding.asp2.subtext': "Nobody taught you? That's fine. I'll help you decide.",
  'trustOnboarding.asp3.headline': 'Look like you have a stylist. Because you do.',
  'trustOnboarding.asp3.subtext': 'One clear outfit. No scrolling. No second-guessing.',
  'trustOnboarding.asp4.headline': 'Think less. Look better.',
  'trustOnboarding.asp4.subtext': "From 'I have nothing to wear' to 'just wear this' in seconds.",
  'trustOnboarding.asp5.headline': 'Date tonight? Work tomorrow? Already handled.',
  'trustOnboarding.asp5.subtext': "Tell me the occasion — I'll help you make the call.",
  'trustOnboarding.asp6.headline': "You don't need taste. You need a decision.",
  'trustOnboarding.asp6.subtext': "Perfect if you've never learned how to dress — we won't judge.",
  'trustOnboarding.asp7.headline': 'Quiet confidence beats loud insecurity.',
  'trustOnboarding.asp7.subtext': 'Dress sharper than your friends without making it a personality.',

  'trustOnboarding.tf0.headline': 'One question. One clear answer. Done.',
  'trustOnboarding.tf0.bullet0': 'No second-guessing',
  'trustOnboarding.tf0.bullet1': 'No infinite options',
  'trustOnboarding.tf0.bullet2': 'Just clarity',
  'trustOnboarding.tf1.headline': 'A stylist who actually commits.',
  'trustOnboarding.tf1.bullet0': 'One clear recommendation',
  'trustOnboarding.tf1.bullet1': 'No scrolling, no trends',
  'trustOnboarding.tf1.bullet2': 'Designed to save time, not steal it',
  'trustOnboarding.tf2.headline': "Clear calls only. No 'maybe this, maybe that.'",
  'trustOnboarding.tf2.bullet0': 'Just: wear this',
  'trustOnboarding.tf2.bullet1': 'One answer, not twenty options',
  'trustOnboarding.tf2.bullet2': 'Get dressed and go',
  'trustOnboarding.tf3.headline': "You ask. I answer. That's it.",
  'trustOnboarding.tf3.bullet0': 'No endless scrolling',
  'trustOnboarding.tf3.bullet1': 'No algorithm games',
  'trustOnboarding.tf3.bullet2': 'Just the outfit you need',
  'trustOnboarding.tf4.headline': 'Built to get you out the door, not glued to a screen.',
  'trustOnboarding.tf4.bullet0': 'Fast, decisive recommendations',
  'trustOnboarding.tf4.bullet1': 'No time-wasting features',
  'trustOnboarding.tf4.bullet2': 'Mission: get you dressed',
  'trustOnboarding.tf5.headline': 'Other apps want your attention. I want you dressed and gone.',
  'trustOnboarding.tf5.bullet0': 'Success = you leaving quickly',
  'trustOnboarding.tf5.bullet1': 'No engagement tricks',
  'trustOnboarding.tf5.bullet2': 'Your time matters more than mine',

  'trustOnboarding.ctrl0.headline': "You're always in control.",
  'trustOnboarding.ctrl0.bullet0': 'You can change your mind anytime',
  'trustOnboarding.ctrl0.bullet1': 'You can ignore any advice',
  'trustOnboarding.ctrl0.bullet2': "Photos aren't shared publicly",
  'trustOnboarding.ctrl1.headline': "Ignore me. Disagree with me. You're still the boss.",
  'trustOnboarding.ctrl1.bullet0': 'My job is to recommend, not command',
  'trustOnboarding.ctrl1.bullet1': 'Your style, your rules',
  'trustOnboarding.ctrl1.bullet2': "I'm just here to help decide",
  'trustOnboarding.ctrl2.headline': 'Your mirror moments stay between us.',
  'trustOnboarding.ctrl2.bullet0': 'Your photos stay private',
  'trustOnboarding.ctrl2.bullet1': 'No comparing with strangers',
  'trustOnboarding.ctrl2.bullet2': 'This is your private space',
  'trustOnboarding.ctrl3.headline':
    'Your clothes stay between you and your stylist — not a social feed.',
  'trustOnboarding.ctrl3.bullet0': "Your wardrobe isn't shared publicly",
  'trustOnboarding.ctrl3.bullet1': 'Calm styling — no crowd comparing',
  'trustOnboarding.ctrl3.bullet2': 'Just honest, helpful advice',
  'trustOnboarding.ctrl4.headline': "Take my advice or don't. I'm not keeping score.",
  'trustOnboarding.ctrl4.bullet0': 'No guilt trips',
  'trustOnboarding.ctrl4.bullet1': 'No passive-aggressive reminders',
  'trustOnboarding.ctrl4.bullet2': 'Just here when you need me',
  'trustOnboarding.ctrl5.headline': 'A private styling space — just you and your stylist.',
  'trustOnboarding.ctrl5.bullet0': 'Your wardrobe personalises advice',
  'trustOnboarding.ctrl5.bullet1': 'Your data, your choice',
  'trustOnboarding.ctrl5.bullet2': 'Trust built on transparency',

  'onboardingProfile.identityTitle': 'Which sounds most like you?',
  'onboardingProfile.identitySubtitle':
    'We will tailor how decisive your stylist is — and how much we explain.',
  'onboardingProfile.identity.never_learned.label': 'I never really learned how to dress',
  'onboardingProfile.identity.never_learned.subtitle': 'No shame — we decide for you.',
  'onboardingProfile.identity.starting_zero.label': 'I am starting from zero',
  'onboardingProfile.identity.starting_zero.subtitle': 'Basics, confidence, zero jargon.',
  'onboardingProfile.identity.level_up.label': 'I dress fine but want to level up',
  'onboardingProfile.identity.level_up.subtitle': 'Look sharper with less effort.',
  'onboardingProfile.identity.impress_someone.label': 'I want to impress someone specific',
  'onboardingProfile.identity.impress_someone.subtitle': 'Date, work, event — we optimise for it.',
  'onboardingProfile.occasionTitle': "What's the occasion?",
  'onboardingProfile.occasionSubtitle':
    "We'll tailor your outfit to the moment — or skip if you're just dressing for yourself.",
  'onboardingProfile.dressFor.work': 'Work / meetings',
  'onboardingProfile.dressFor.date': 'Date or romance',
  'onboardingProfile.dressFor.friends': 'Friends / going out',
  'onboardingProfile.dressFor.event': 'Event / special occasion',
  'onboardingProfile.dressFor.myself': 'Just for me today',
  'onboardingProfile.continue': 'Continue',
  'onboardingProfile.pickOutfits': 'Pick outfits I like',
  'onboardingProfile.skipSurprise': 'Skip — surprise me',

  'preSignupQuiz.curating': 'Curating looks for {occasion}...',
  'preSignupQuiz.almostThere': 'Almost there',
  'preSignupQuiz.loadFailed':
    'We could not load style picks for this occasion. Continue and your stylist will still decide for you.',
  'preSignupQuiz.readingPicks': 'Reading your style picks...',
  'preSignupQuiz.vibeFallback': 'We know your vibe',
  'preSignupQuiz.summaryFallback': "Got it — we'll use your picks to style you.",
  'preSignupQuiz.nextHint': 'Next, choose how you want your stylist to help.',
  'preSignupQuiz.showOutfitsFor': 'Show me outfits for',
  'preSignupQuiz.women': 'Women',
  'preSignupQuiz.men': 'Men',
  'preSignupQuiz.progress': '{current} of {total} — tap like or skip',
  'preSignupQuiz.continue': 'Continue',
  'preSignupQuiz.dressFor.work': 'work / meetings',
  'preSignupQuiz.dressFor.date': 'a date or romance',
  'preSignupQuiz.dressFor.friends': 'going out with friends',
  'preSignupQuiz.dressFor.event': 'an event or special occasion',
  'preSignupQuiz.dressFor.myself': 'yourself today',
  'preSignupQuiz.copy.work.title': 'Which work look feels like you?',
  'preSignupQuiz.copy.work.subtitle':
    'Office-ready styles only — swipe to teach your stylist your professional vibe.',
  'preSignupQuiz.copy.date.title': 'Which date-night look is you?',
  'preSignupQuiz.copy.date.subtitle': 'Romantic and polished picks — no random athleisure here.',
  'preSignupQuiz.copy.friends.title': 'What would you wear out with friends?',
  'preSignupQuiz.copy.friends.subtitle': 'Going-out energy only — help us nail your social style.',
  'preSignupQuiz.copy.event.title': 'What kind of event look is you?',
  'preSignupQuiz.copy.event.subtitle':
    'Gala, theatre, wedding, festival — swipe across the full range of occasions.',
  'preSignupQuiz.copy.myself.title': 'What feels good for you today?',
  'preSignupQuiz.copy.myself.subtitle': 'Comfort-first everyday looks — your off-duty style in seconds.',

  'decideForMe.title': 'Decide for me',
  'decideForMe.rubysPick': "Ruby's Pick",
  'decideForMe.yourRecommendation': 'Your outfit recommendation',
  'decideForMe.styleRule': 'Style Rule',
  'decideForMe.saveOutfit': 'Save outfit',
  'decideForMe.anotherOption': 'Another option',
  'decideForMe.loading': 'Loading...',
  'decideForMe.updatingOutfit': 'Updating your outfit...',
  'decideForMe.calibrationMessage':
    'If you want me to dial this in, tell me anything you want me to know...',
  'decideForMe.expressionPlaceholder': 'I live in jeans and trainers',
  'decideForMe.wantPersonalised': 'Want this personalised to your wardrobe?',
  'decideForMe.yesPersonalise': 'Yes, personalise it',
  'decideForMe.justBrowsing': "I'm just browsing",
  'decideForMe.keepOutfit': 'Keep this outfit?',
  'decideForMe.createAccountToSave': 'Create a free account to save it forever',
  'decideForMe.signUpToSave': 'Sign up to save',
  'decideForMe.notNow': 'Not now',
  'decideForMe.savesLeft': '({n} saves left)',
  'decideForMe.rubyDeciding': 'Ruby is deciding your outfit...',
  'decideForMe.rubyDecidingFor': 'Ruby is deciding your outfit for {occasion}...',
  'decideForMe.tellMeOccasion': "Tell me what you're dressing for — I'll decide the outfit.",
  'decideForMe.occasion.work': 'Work',
  'decideForMe.occasion.date': 'Date',
  'decideForMe.occasion.casual': 'Casual',
  'decideForMe.occasion.event': 'Event',
  'decideForMe.occasion.browsing': 'Just browsing',
  'decideForMe.weatherIn': '{temp}° in {location}',
  'decideForMe.style.masculine': 'Masculine',
  'decideForMe.style.feminine': 'Feminine',
  'decideForMe.style.androgynous': 'Androgynous',
  'decideForMe.style.not_sure': 'Not sure yet',
  'decideForMe.startAgain': 'Start again',
  'decideForMe.sendFeedback': 'Send feedback to Ruby',
  'decideForMe.reasoningFallback':
    'This look balances comfort with style, perfect for your occasion.',
  'decideForMe.updatedReasoning': 'Updated based on what you told me.',
};

const ES_KEYS = {
  'onboardingEntry.title': 'Nosotros decidimos. Tú luces mejor.',
  'onboardingEntry.subtitle':
    'Cero esfuerzo — tu estilista elige el outfit para que destaques sin pensarlo.',
  'onboardingEntry.decideForMe': 'Decide por mí',
  'onboardingEntry.decideForMeSubtitle': 'Una respuesta. Y a la calle.',
  'onboardingEntry.styleMeProperly': 'Estílame bien',
  'onboardingEntry.styleMeProperlySubtitle': 'Con mi armario cuando esté listo',
  'onboardingEntry.alreadyHaveAccount': '¿Ya tienes cuenta? Inicia sesión',
  'onboardingEntry.seeHowItWorks': 'Mira cómo funciona antes de registrarte',

  'trustOnboarding.letsGo': 'Vamos',

  'trustOnboarding.pos0.headline': 'Deja de darle mil vueltas a qué ponerte.',
  'trustOnboarding.pos0.subtext':
    'Un estilista de IA con criterio que te dice qué ponerte — usando tu armario cuando esté disponible.',
  'trustOnboarding.pos1.headline': 'Llevas 20 minutos mirando el armario. Otra vez.',
  'trustOnboarding.pos1.subtext': 'Lo arreglamos. Una respuesta clara, siempre.',
  'trustOnboarding.pos2.headline': 'Tres outfits en la cama. Cero confianza en ninguno.',
  'trustOnboarding.pos2.subtext': '¿Te suena? Yo te digo cuál ponerte.',
  'trustOnboarding.pos3.headline': 'Llegas tarde porque te has cambiado dos veces.',
  'trustOnboarding.pos3.subtext': 'Vístete con certeza. A la primera, siempre.',
  'trustOnboarding.pos4.headline': 'Cuanto más miras, menos lo tienes claro.',
  'trustOnboarding.pos4.subtext': 'Rompe el bucle. Una respuesta clara en segundos.',
  'trustOnboarding.pos5.headline': 'El problema no es tu armario. Es la decisión.',
  'trustOnboarding.pos5.subtext': 'Yo decido. Tú sales.',

  'trustOnboarding.asp0.headline': 'Entra como si lo hubieras planeado. Aunque no sea así.',
  'trustOnboarding.asp0.subtext':
    'Decidimos qué te pones — para que luces mejor que el resto sin esfuerzo.',
  'trustOnboarding.asp1.headline': 'Sé la persona mejor vestida de la sala — sin intentarlo.',
  'trustOnboarding.asp1.subtext': 'Tus amigos preguntarán dónde compras. No hace falta que lo sepas.',
  'trustOnboarding.asp2.headline': 'Deja de ser quien «no va mucho de moda».',
  'trustOnboarding.asp2.subtext': '¿Nadie te enseñó? No pasa nada. Nosotros decidimos por ti.',
  'trustOnboarding.asp3.headline': 'Parece que tienes estilista. Porque lo tienes.',
  'trustOnboarding.asp3.subtext': 'Un outfit claro. Sin scroll. Sin dudas.',
  'trustOnboarding.asp4.headline': 'Piensa menos. Luce mejor.',
  'trustOnboarding.asp4.subtext':
    'De «no tengo nada que ponerme» a «ponte esto» en segundos.',
  'trustOnboarding.asp5.headline': '¿Cita esta noche? ¿Trabajo mañana? Ya está resuelto.',
  'trustOnboarding.asp5.subtext': 'Dinos la ocasión — nosotros decidimos.',
  'trustOnboarding.asp6.headline': 'No necesitas gusto. Necesitas una decisión.',
  'trustOnboarding.asp6.subtext': 'Ideal si nunca aprendiste a vestirte — sin juicios.',
  'trustOnboarding.asp7.headline': 'La confianza discreta gana a la inseguridad ruidosa.',
  'trustOnboarding.asp7.subtext':
    'Vístete mejor que tus amigos sin convertirlo en tu personalidad.',

  'trustOnboarding.tf0.headline': 'Una pregunta. Un outfit. Listo.',
  'trustOnboarding.tf0.bullet0': 'Sin darle mil vueltas',
  'trustOnboarding.tf0.bullet1': 'Sin opciones infinitas',
  'trustOnboarding.tf0.bullet2': 'Solo claridad',
  'trustOnboarding.tf1.headline': 'Un estilista que de verdad decide.',
  'trustOnboarding.tf1.bullet0': 'Una recomendación clara',
  'trustOnboarding.tf1.bullet1': 'Sin scroll, sin tendencias',
  'trustOnboarding.tf1.bullet2': 'Diseñado para ahorrar tiempo, no robártelo',
  'trustOnboarding.tf2.headline': 'Solo decisiones claras. Sin «tal vez esto, tal vez aquello».',
  'trustOnboarding.tf2.bullet0': 'Solo: ponte esto',
  'trustOnboarding.tf2.bullet1': 'Una respuesta, no veinte opciones',
  'trustOnboarding.tf2.bullet2': 'Vístete y sal',
  'trustOnboarding.tf3.headline': 'Tú preguntas. Yo respondo. Punto.',
  'trustOnboarding.tf3.bullet0': 'Sin scroll infinito',
  'trustOnboarding.tf3.bullet1': 'Sin juegos del algoritmo',
  'trustOnboarding.tf3.bullet2': 'Solo el outfit que necesitas',
  'trustOnboarding.tf4.headline': 'Hecho para sacarte por la puerta, no para pegarte a la pantalla.',
  'trustOnboarding.tf4.bullet0': 'Recomendaciones rápidas y decisivas',
  'trustOnboarding.tf4.bullet1': 'Sin funciones que hacen perder el tiempo',
  'trustOnboarding.tf4.bullet2': 'Misión: vestirte',
  'trustOnboarding.tf5.headline': 'Otras apps quieren tu atención. Yo quiero que te vistas y te vayas.',
  'trustOnboarding.tf5.bullet0': 'Éxito = que salgas rápido',
  'trustOnboarding.tf5.bullet1': 'Sin trucos de engagement',
  'trustOnboarding.tf5.bullet2': 'Tu tiempo importa más que el mío',

  'trustOnboarding.ctrl0.headline': 'Siempre tienes el control.',
  'trustOnboarding.ctrl0.bullet0': 'Puedes cambiar de opinión cuando quieras',
  'trustOnboarding.ctrl0.bullet1': 'Puedes ignorar cualquier consejo',
  'trustOnboarding.ctrl0.bullet2': 'Las fotos no se comparten públicamente',
  'trustOnboarding.ctrl1.headline': 'Ignórame. Discúlpame. Sigues mandando tú.',
  'trustOnboarding.ctrl1.bullet0': 'Mi trabajo es recomendar, no mandar',
  'trustOnboarding.ctrl1.bullet1': 'Tu estilo, tus reglas',
  'trustOnboarding.ctrl1.bullet2': 'Solo estoy para ayudarte a decidir',
  'trustOnboarding.ctrl2.headline': 'Tus momentos frente al espejo se quedan entre nosotros.',
  'trustOnboarding.ctrl2.bullet0': 'Tus fotos se quedan privadas',
  'trustOnboarding.ctrl2.bullet1': 'Sin compararte con extraños',
  'trustOnboarding.ctrl2.bullet2': 'Este es tu espacio privado',
  'trustOnboarding.ctrl3.headline':
    'Tu ropa queda entre tú y tu estilista — no es un feed social.',
  'trustOnboarding.ctrl3.bullet0': 'Tu armario no se comparte públicamente',
  'trustOnboarding.ctrl3.bullet1': 'Estilo calmado — sin multitud comparando',
  'trustOnboarding.ctrl3.bullet2': 'Solo consejos honestos y útiles',
  'trustOnboarding.ctrl4.headline': 'Sigue mi consejo o no. No llevo la cuenta.',
  'trustOnboarding.ctrl4.bullet0': 'Sin culpabilizarte',
  'trustOnboarding.ctrl4.bullet1': 'Sin recordatorios pasivo-agresivos',
  'trustOnboarding.ctrl4.bullet2': 'Aquí cuando me necesites',
  'trustOnboarding.ctrl5.headline': 'Un espacio de estilo privado — solo tú y tu estilista.',
  'trustOnboarding.ctrl5.bullet0': 'Tu armario personaliza los consejos',
  'trustOnboarding.ctrl5.bullet1': 'Tus datos, tu decisión',
  'trustOnboarding.ctrl5.bullet2': 'Confianza basada en transparencia',

  'onboardingProfile.identityTitle': '¿Cuál te describe mejor?',
  'onboardingProfile.identitySubtitle':
    'Ajustaremos lo decisivo que es tu estilista — y cuánto te explica.',
  'onboardingProfile.identity.never_learned.label': 'Nunca aprendí bien a vestirme',
  'onboardingProfile.identity.never_learned.subtitle': 'Sin vergüenza — nosotros decidimos por ti.',
  'onboardingProfile.identity.starting_zero.label': 'Empiezo desde cero',
  'onboardingProfile.identity.starting_zero.subtitle': 'Básicos, confianza, cero jerga.',
  'onboardingProfile.identity.level_up.label': 'Me visto bien, pero quiero subir de nivel',
  'onboardingProfile.identity.level_up.subtitle': 'Luce más afilado con menos esfuerzo.',
  'onboardingProfile.identity.impress_someone.label': 'Quiero impresionar a alguien concreto',
  'onboardingProfile.identity.impress_someone.subtitle': 'Cita, trabajo, evento — lo optimizamos.',
  'onboardingProfile.occasionTitle': '¿Cuál es la ocasión?',
  'onboardingProfile.occasionSubtitle':
    'Adaptaremos tu outfit al momento — o sáltalo si solo te vistes para ti.',
  'onboardingProfile.dressFor.work': 'Trabajo / reuniones',
  'onboardingProfile.dressFor.date': 'Cita o romance',
  'onboardingProfile.dressFor.friends': 'Amigos / salir',
  'onboardingProfile.dressFor.event': 'Evento / ocasión especial',
  'onboardingProfile.dressFor.myself': 'Solo para mí hoy',
  'onboardingProfile.continue': 'Continuar',
  'onboardingProfile.pickOutfits': 'Elegir outfits que me gusten',
  'onboardingProfile.skipSurprise': 'Saltar — sorpréndeme',

  'preSignupQuiz.curating': 'Preparando looks para {occasion}...',
  'preSignupQuiz.almostThere': 'Casi listo',
  'preSignupQuiz.loadFailed':
    'No pudimos cargar looks para esta ocasión. Continúa y tu estilista seguirá decidiendo por ti.',
  'preSignupQuiz.readingPicks': 'Leyendo tus elecciones de estilo...',
  'preSignupQuiz.vibeFallback': 'Ya captamos tu vibe',
  'preSignupQuiz.summaryFallback': 'Entendido — usaremos tus elecciones para estilarte.',
  'preSignupQuiz.nextHint': 'Ahora elige cómo quieres que te ayude tu estilista.',
  'preSignupQuiz.showOutfitsFor': 'Muéstrame outfits para',
  'preSignupQuiz.women': 'Mujer',
  'preSignupQuiz.men': 'Hombre',
  'preSignupQuiz.progress': '{current} de {total} — toca me gusta o saltar',
  'preSignupQuiz.continue': 'Continuar',
  'preSignupQuiz.dressFor.work': 'trabajo / reuniones',
  'preSignupQuiz.dressFor.date': 'una cita o romance',
  'preSignupQuiz.dressFor.friends': 'salir con amigos',
  'preSignupQuiz.dressFor.event': 'un evento u ocasión especial',
  'preSignupQuiz.dressFor.myself': 'ti hoy',
  'preSignupQuiz.copy.work.title': '¿Qué look de trabajo te representa?',
  'preSignupQuiz.copy.work.subtitle':
    'Solo estilos de oficina — desliza para enseñar a tu estilista tu vibe profesional.',
  'preSignupQuiz.copy.date.title': '¿Qué look de cita eres tú?',
  'preSignupQuiz.copy.date.subtitle': 'Opciones románticas y cuidadas — nada de athleisure al azar.',
  'preSignupQuiz.copy.friends.title': '¿Qué te pondrías para salir con amigos?',
  'preSignupQuiz.copy.friends.subtitle': 'Energía de salir — ayúdanos a clavar tu estilo social.',
  'preSignupQuiz.copy.event.title': '¿Qué look de evento eres tú?',
  'preSignupQuiz.copy.event.subtitle':
    'Gala, teatro, boda, festival — desliza por todo el abanico de ocasiones.',
  'preSignupQuiz.copy.myself.title': '¿Qué te sienta bien hoy?',
  'preSignupQuiz.copy.myself.subtitle':
    'Looks cotidianos con comodidad primero — tu estilo off-duty en segundos.',

  'decideForMe.title': 'Decide por mí',
  'decideForMe.rubysPick': 'La elección de Ruby',
  'decideForMe.yourRecommendation': 'Tu recomendación de outfit',
  'decideForMe.styleRule': 'Regla de estilo',
  'decideForMe.saveOutfit': 'Guardar outfit',
  'decideForMe.anotherOption': 'Otra opción',
  'decideForMe.loading': 'Cargando...',
  'decideForMe.updatingOutfit': 'Actualizando tu outfit...',
  'decideForMe.calibrationMessage':
    'Si quieres que lo afine, dime lo que quieras que sepa...',
  'decideForMe.expressionPlaceholder': 'Vivo en vaqueros y zapatillas',
  'decideForMe.wantPersonalised': '¿Quieres personalizarlo con tu armario?',
  'decideForMe.yesPersonalise': 'Sí, personalízalo',
  'decideForMe.justBrowsing': 'Solo estoy mirando',
  'decideForMe.keepOutfit': '¿Guardar este outfit?',
  'decideForMe.createAccountToSave': 'Crea una cuenta gratis para guardarlo para siempre',
  'decideForMe.signUpToSave': 'Regístrate para guardar',
  'decideForMe.notNow': 'Ahora no',
  'decideForMe.savesLeft': '({n} guardados restantes)',
  'decideForMe.rubyDeciding': 'Ruby está decidiendo tu outfit...',
  'decideForMe.rubyDecidingFor': 'Ruby está decidiendo tu outfit para {occasion}...',
  'decideForMe.tellMeOccasion': 'Dime para qué te vistes — yo decido el outfit.',
  'decideForMe.occasion.work': 'Trabajo',
  'decideForMe.occasion.date': 'Cita',
  'decideForMe.occasion.casual': 'Casual',
  'decideForMe.occasion.event': 'Evento',
  'decideForMe.occasion.browsing': 'Solo mirando',
  'decideForMe.weatherIn': '{temp}° en {location}',
  'decideForMe.style.masculine': 'Masculino',
  'decideForMe.style.feminine': 'Femenino',
  'decideForMe.style.androgynous': 'Andrógino',
  'decideForMe.style.not_sure': 'Aún no lo sé',
  'decideForMe.startAgain': 'Empezar de nuevo',
  'decideForMe.sendFeedback': 'Enviar feedback a Ruby',
  'decideForMe.reasoningFallback':
    'Este look equilibra comodidad y estilo, perfecto para tu ocasión.',
  'decideForMe.updatedReasoning': 'Actualizado según lo que me contaste.',
  'decideForMe.browsingDoneTitle':
    'Eso es todo lo que tengo en modo exploración — ¡pero fue un placer ayudarte!',
  'decideForMe.browsingDoneMessage':
    'Crea una cuenta para desbloquear tu estilista personal y guardar tus elecciones.',
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

// Drop obsolete long-form trust keys from earlier draft if present
const OBSOLETE_PREFIXES = [
  'trustOnboarding.positioning_',
  'trustOnboarding.aspiration_',
  'trustOnboarding.framing_',
  'trustOnboarding.control_',
];

const enFlat = fs.existsSync(EN_FLAT) ? loadJson(EN_FLAT) : {};
for (const k of Object.keys(enFlat)) {
  if (OBSOLETE_PREFIXES.some((p) => k.startsWith(p))) delete enFlat[k];
}
const nEn = upsert(enFlat, EN_KEYS);
saveJson(EN_FLAT, enFlat);
console.log(`en-flat.json: upserted ${nEn} (total ${Object.keys(enFlat).length})`);

if (fs.existsSync(KEYS_FILE)) {
  const existing = fs.readFileSync(KEYS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const keySet = new Set([...existing, ...Object.keys(EN_KEYS)]);
  for (const k of [...keySet]) {
    if (OBSOLETE_PREFIXES.some((p) => k.startsWith(p))) keySet.delete(k);
  }
  fs.writeFileSync(KEYS_FILE, [...keySet].sort().join('\n') + '\n');
}

for (const file of fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))) {
  const lang = file.replace('.json', '');
  const p = path.join(LOCALES_DIR, file);
  const data = loadJson(p);
  for (const k of Object.keys(data)) {
    if (OBSOLETE_PREFIXES.some((pref) => k.startsWith(pref))) delete data[k];
  }
  let n = 0;
  for (const [k, enVal] of Object.entries(EN_KEYS)) {
    const next = lang === 'es' && ES_KEYS[k] ? ES_KEYS[k] : lang === 'en' ? enVal : data[k] && data[k] !== '' ? data[k] : enVal;
    // Force ES curated + EN source; other langs keep existing translation or interim EN
    const force = lang === 'en' || lang === 'es' || !data[k] || data[k] === '';
    if (force && data[k] !== next) {
      data[k] = next;
      n++;
    } else if (lang === 'es' && ES_KEYS[k] && data[k] !== ES_KEYS[k]) {
      data[k] = ES_KEYS[k];
      n++;
    } else if (lang === 'en' && data[k] !== enVal) {
      data[k] = enVal;
      n++;
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
  }
  saveJson(p, data);
  console.log(`updated ${lang} (+${n})`);
}

// Patch spanish-priority.js
if (fs.existsSync(PRIORITY)) {
  let src = fs.readFileSync(PRIORITY, 'utf8');
  if (!src.includes("'trustOnboarding.asp2.headline'")) {
    const insert =
      '\n  // ─── Onboarding entry / trust / profile / decide-for-me ───\n' +
      Object.entries(ES_KEYS)
        .map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`)
        .join('\n') +
      '\n';
    const lastBrace = src.lastIndexOf('};');
    if (lastBrace !== -1) {
      src = src.slice(0, lastBrace) + insert + src.slice(lastBrace);
      fs.writeFileSync(PRIORITY, src);
      console.log('spanish-priority.js: appended keys');
    }
  } else {
    console.log('spanish-priority.js: already has trust keys');
  }
}

console.log('done');
