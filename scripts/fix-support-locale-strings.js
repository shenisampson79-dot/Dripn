const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'locales');

const enFixes = {
  'support.clear': 'Clear',
  'support.clearChatMessage':
    'This will remove your conversation with Julia. You can always start a new chat anytime.',
  'support.clearChatTitle': 'Clear chat history?',
  'support.createTicket': 'Create Support Ticket',
  'support.issuePlaceholder': 'Tell us what happened and how we can help…',
  'support.juliaName': 'Julia',
  'support.missingInfoMessage': 'Please choose a category and describe your issue.',
  'support.missingInfoTitle': 'Missing information',
  'support.responseFailed': 'Could not get a response. Please try again.',
  'support.screenTitle': 'Ask Julia',
  'support.sendFailed': 'Could not send your message. Please try again.',
  'support.ticketFailed':
    'Could not create your ticket. Please try again or email support@dripnapp.com.',
  'support.quickAction.app-slow': 'App is running slow',
  'support.quickAction.login-issues': 'Cannot log in',
  'support.quickAction.subscription-not-working': 'Subscription features not working',
  'support.quickAction.photos-not-uploading': 'Photos not uploading',
  'support.quickAction.notifications-not-working': 'Not receiving notifications',
  'support.ticketCategory.subscription': 'Subscription & Plans',
  'support.ticketCategory.account': 'Account Issues',
  'support.ticketCategory.app-issue': 'App Problems',
  'support.ticketCategory.billing': 'Billing & Payments',
  'support.ticketCategory.styling': 'Styling Features',
  'support.ticketCategory.feature-request': 'Feature Requests',
  'support.ticketCategory.other': 'Other',
};

const screenTitles = {
  es: 'Pregunta a Julia',
  fr: 'Demander à Julia',
  de: 'Julia fragen',
  it: 'Chiedi a Julia',
  pt: 'Pergunte a Julia',
  nl: 'Vraag het Julia',
  pl: 'Zapytaj Julię',
  ja: 'Juliaに質問',
  zh: '询问 Julia',
  ko: 'Julia에게 묻기',
  ru: 'Спросить Julia',
  sv: 'Fråga Julia',
  no: 'Spør Julia',
  da: 'Spørg Julia',
  fi: 'Kysy Julialta',
  tr: "Julia'ya sor",
  ar: 'اسأل Julia',
  hi: 'Julia से पूछें',
};

const createTickets = {
  es: 'Crear ticket de soporte',
  fr: 'Créer un ticket',
  de: 'Support-Ticket erstellen',
  it: 'Crea ticket di supporto',
  pt: 'Criar ticket de suporte',
  nl: 'Supportticket maken',
  pl: 'Utwórz zgłoszenie',
  ja: 'サポートチケットを作成',
  zh: '创建支持工单',
  ko: '지원 티켓 만들기',
  ru: 'Создать обращение',
  sv: 'Skapa supportärende',
  no: 'Opprett supportbillett',
  da: 'Opret supportbillet',
  fi: 'Luo tukipyyntö',
  tr: 'Destek bileti oluştur',
  ar: 'إنشاء تذكرة دعم',
  hi: 'सहायता टिकट बनाएँ',
};

const clears = {
  es: 'Borrar',
  fr: 'Effacer',
  de: 'Löschen',
  it: 'Cancella',
  pt: 'Limpar',
  nl: 'Wissen',
  pl: 'Wyczyść',
  ja: 'クリア',
  zh: '清除',
  ko: '지우기',
  ru: 'Очистить',
  sv: 'Rensa',
  no: 'Tøm',
  da: 'Ryd',
  fi: 'Tyhjennä',
  tr: 'Temizle',
  ar: 'مسح',
  hi: 'साफ़ करें',
};

for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'))) {
  const lang = path.basename(file, '.json');
  const full = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));

  for (const [key, value] of Object.entries(enFixes)) {
    data[key] = value;
  }

  if (lang !== 'en') {
    data['support.juliaName'] = 'Julia';
    if (screenTitles[lang]) data['support.screenTitle'] = screenTitles[lang];
    if (createTickets[lang]) data['support.createTicket'] = createTickets[lang];
    if (clears[lang]) data['support.clear'] = clears[lang];
  }

  const ordered = {};
  for (const key of Object.keys(data).sort()) {
    ordered[key] = data[key];
  }

  fs.writeFileSync(full, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  console.log('fixed', lang);
}
