const OpenAI = require('openai');
const https = require('https');
const { getBestModel } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============ ELEVENLABS MODEL ============
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

// ============ MARCH 16 VOICE CHARACTER MAPPINGS ============

// RUBY — Authentic voices: English: Rachel (warm, natural) | Italian: Luca (native) | Spanish: Lucia (native) | French: Léa (native) | German: Hans (native) | Portuguese: Marina (native) | Multilingual: Giancarlo
const RUBY_VOICES = {
  en: '21m00Tcm4TlvDq8ikWAM',      // Rachel (warm, professional, authentic English)
  it: 'YEKdqKwBnXc34v33nVQn',      // Luca (authentic Italian male)
  es: 'VR6AewLTigWG4xSOukaG',      // Sofia (authentic Spanish female)
  fr: 'jBpfuIE2acCO8z3wKNLl',      // Léa (authentic French female)
  de: 'onwK4e9ZLuTAKqWW03F9',      // Hans (authentic German male)
  pt: 'Xb7hH8MSUJpSbSDYk0k2',      // Marina (authentic Portuguese female)
  default: 'pNInz6obpgDQGcFmaJgB', // Giancarlo (warm, multilingual fallback)
};

// MAX — English by voice range: Josh(tenor) / Adam(baritone) / Arnold(bass) | Non-English: Daniel
const MAX_ENGLISH_VOICES = {
  tenor: 'TxGEqnHWrfWFTfGW9XjX',   // Josh
  baritone: 'pNInz6obpgDQGcFmaJgB', // Adam
  bass: 'VR6AewLTigWG4xSOukaG',     // Arnold
  default: 'pNInz6obpgDQGcFmaJgB',  // Adam (baritone default)
};
const MAX_NON_ENGLISH_VOICE = 'onwK4e9ZLuTAKqWW03F9'; // Daniel

// ACE — English: Callum | Non-English (all): Daniel (multilingual)
const ACE_VOICES = {
  en: 'N2lVS1w4EtoT3dr4eOWO',      // Callum (English all accents)
  default: 'onwK4e9ZLuTAKqWW03F9', // Daniel (multilingual non-English fallback)
};

// IVY — English: Charlotte | Italian: Manuela | All other non-English: Charlotte
const IVY_VOICES = {
  en: 'XB0fDUnXU5powFXDhCwa',      // Charlotte (English all accents)
  it: 'oVJbgLwL0s5pk9e2U6QH',      // Manuela (Italian only)
  default: 'XB0fDUnXU5powFXDhCwa', // Charlotte (all other non-English)
};

// ============ LANGUAGE CODE HELPERS ============

const LANGUAGE_NAME_TO_CODE = {
  english: 'en', italian: 'it', spanish: 'es', french: 'fr',
  german: 'de', portuguese: 'pt', japanese: 'ja', korean: 'ko',
  mandarin: 'zh', chinese: 'zh', arabic: 'ar', hindi: 'hi',
  dutch: 'nl', russian: 'ru', swedish: 'sv', polish: 'pl',
  turkish: 'tr', danish: 'da', finnish: 'fi', norwegian: 'no',
  greek: 'el', hebrew: 'he', hungarian: 'hu', indonesian: 'id',
  malay: 'ms', romanian: 'ro', thai: 'th', vietnamese: 'vi',
  ukrainian: 'uk', czech: 'cs', slovak: 'sk',
};

function normalizeLanguage(language) {
  if (!language) return 'en';
  const l = language.toLowerCase().trim();
  if (l.length === 2 || l.length === 3) return l.substring(0, 2);
  return LANGUAGE_NAME_TO_CODE[l] || 'en';
}

function isEnglish(langCode) {
  return langCode === 'en' || langCode === 'en-gb' || langCode === 'en-us' || langCode === 'en-au';
}

// ============ VOICE ID SELECTION ============

function getVoiceId(stylistId, language, voiceRange) {
  const lang = normalizeLanguage(language);
  const english = isEnglish(lang);

  switch ((stylistId || 'ruby').toLowerCase()) {
    case 'ruby':
      return RUBY_VOICES[lang] || RUBY_VOICES.default;

    case 'max':
      if (english) {
        const range = (voiceRange || 'baritone').toLowerCase();
        return MAX_ENGLISH_VOICES[range] || MAX_ENGLISH_VOICES.default;
      }
      return MAX_NON_ENGLISH_VOICE;

    case 'ace':
      return english ? ACE_VOICES.en : ACE_VOICES.default;

    case 'ivy':
      if (english) return IVY_VOICES.en;
      return IVY_VOICES[lang] || IVY_VOICES.default;

    default:
      return RUBY_VOICES[lang] || RUBY_VOICES.default;
  }
}

function getVoiceCharacterName(stylistId, language, voiceRange) {
  const lang = normalizeLanguage(language);
  const english = isEnglish(lang);

  switch ((stylistId || 'ruby').toLowerCase()) {
    case 'ruby':
      if (english) return 'Tiffany';
      const rubyNames = { it: 'Rachel', es: 'Glinda', fr: 'Grace', de: 'Emily', pt: 'Alice' };
      return rubyNames[lang] || 'Jessica';
    case 'max':
      if (english) {
        const range = (voiceRange || 'baritone').toLowerCase();
        const maxNames = { tenor: 'Josh', baritone: 'Adam', bass: 'Arnold' };
        return maxNames[range] || 'Adam';
      }
      return 'Daniel';
    case 'ace':
      return english ? 'Callum' : 'Arnold';
    case 'ivy':
      if (english) return 'Charlotte';
      return lang === 'it' ? 'Manuela' : 'Charlotte';
    default:
      return 'Tiffany';
  }
}

// ============ ECHO-FREE VOICE SETTINGS (new settings to keep) ============

function isDeepVoiceRange(voiceRange) {
  return voiceRange === 'bass' || voiceRange === 'contralto';
}

function getVoiceSettings(voiceRange) {
  if (isDeepVoiceRange(voiceRange)) {
    return {
      stability: 0.60,
      similarity_boost: 0.65,
      style: 0.0,
      use_speaker_boost: false,
    };
  }
  return {
    stability: 0.50,
    similarity_boost: 0.60,
    style: 0.0,
    use_speaker_boost: false,
  };
}

// ============ ELEVENLABS TTS API CALL ============

function callElevenLabsTTS(text, voiceId, voiceSettings) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return reject(new Error('ELEVENLABS_API_KEY not configured'));
    }

    const body = JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: voiceSettings,
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          const errBody = Buffer.concat(chunks).toString();
          reject(new Error(`ElevenLabs TTS failed (${res.statusCode}): ${errBody.substring(0, 300)}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============ TEXT CLEANING ============

function cleanTextForTTS(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============ MAIN SYNTHESIS FUNCTION ============

async function synthesizeSpeech(text, options = {}) {
  const {
    stylistId = 'ruby',
    language = 'en',
    voiceRange = null,
    highQuality = true,
  } = options;

  const cleanText = cleanTextForTTS(text);
  const voiceId = getVoiceId(stylistId, language, voiceRange);
  const voiceSettings = getVoiceSettings(voiceRange);
  const characterName = getVoiceCharacterName(stylistId, language, voiceRange);

  console.log(`[VoiceService] ElevenLabs TTS → ${stylistId} | lang: ${normalizeLanguage(language)} | character: ${characterName} | voiceId: ${voiceId} | settings: stability=${voiceSettings.stability}, similarity=${voiceSettings.similarity_boost}`);

  try {
    const audioBuffer = await callElevenLabsTTS(cleanText, voiceId, voiceSettings);

    return {
      success: true,
      audioBuffer,
      voice: characterName,
      voiceId,
      modelUsed: ELEVENLABS_MODEL,
      format: 'mp3',
      textLength: cleanText.length,
    };
  } catch (error) {
    console.error('[VoiceService] ElevenLabs synthesis error:', error.message);
    return {
      success: false,
      error: error.message,
      audioBuffer: null,
    };
  }
}

// ============ TRANSCRIPTION (OpenAI Whisper — unchanged) ============

async function transcribeAudio(audioBuffer, options = {}) {
  const {
    language = null,
    mimeType = 'audio/webm',
    prompt = 'Fashion, style, outfit, wardrobe, clothing, accessories',
  } = options;

  try {
    const sttModel = await getBestModel('stt');
    console.log(`[VoiceService] Transcribing with model: ${sttModel}`);

    const filename = mimeType === 'audio/m4a' ? 'audio.m4a'
      : mimeType === 'audio/mp4' ? 'audio.mp4'
      : mimeType === 'audio/wav' ? 'audio.wav'
      : mimeType === 'audio/mp3' ? 'audio.mp3'
      : 'audio.webm';

    const file = new File([audioBuffer], filename, { type: mimeType });

    const transcriptionOptions = {
      file,
      model: sttModel,
      prompt,
      response_format: 'verbose_json',
    };

    if (language) {
      transcriptionOptions.language = language;
    }

    const transcription = await openai.audio.transcriptions.create(transcriptionOptions);

    return {
      success: true,
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments,
      modelUsed: sttModel,
    };
  } catch (error) {
    console.error('[VoiceService] Transcription error:', error.message);
    return {
      success: false,
      error: error.message,
      text: null,
    };
  }
}

// ============ VOICE PREVIEW (intro phrases per language) ============

const VOICE_PREVIEW_PHRASES = {
  ruby: {
    English: "Hi there! I'm Ruby, your personal stylist. I'm warm, encouraging, and I love helping you discover your best style. Let me guide your fashion journey!",
    French: "Bonjour! Je suis Ruby, votre styliste personnelle. Je suis chaleureuse, encourageante, et j'adore vous aider à découvrir votre meilleur style!",
    Spanish: "Hola! Soy Ruby, tu estilista personal. Soy cálida, alentadora, y me encanta ayudarte a descubrir tu mejor estilo!",
    German: "Hallo! Ich bin Ruby, deine persönliche Stylistin. Ich bin warmherzig, ermutigend, und ich liebe es, dir zu helfen, deinen besten Stil zu entdecken!",
    Italian: "Ciao! Sono Ruby, la tua stilista personale. Sono calorosa, incoraggiante, e adoro aiutarti a scoprire il tuo stile migliore!",
    Portuguese: "Olá! Sou Ruby, sua estilista pessoal. Sou calorosa, encorajadora, e adoro ajudá-la a descobrir seu melhor estilo!",
    Japanese: "こんにちは!私はルビー、あなたのパーソナルスタイリストです。温かく、励ましながら、あなたの最高のスタイルを見つけるお手伝いをします!",
    Korean: "안녕하세요! 저는 루비, 당신의 개인 스타일리스트입니다. 따뜻하고 격려하며, 최고의 스타일을 찾도록 도와드리는 것을 좋아해요!",
    Chinese: "你好!我是Ruby,你的私人造型师。我热情、鼓励,喜欢帮助你发现最好的风格!",
    Arabic: "مرحبا! أنا روبي، مصممة الأزياء الشخصية الخاصة بك. أنا دافئة ومشجعة!",
    Hindi: "नमस्ते! मैं रूबी हूं, आपकी पर्सनल स्टाइलिस्ट। मैं गर्मजोश, प्रोत्साहित करने वाली हूं!",
    Russian: "Привет! Я Руби, ваш личный стилист. Я теплая, ободряющая, и я люблю помогать вам открыть свой лучший стиль!",
    Dutch: "Hallo! Ik ben Ruby, jouw persoonlijke stylist. Ik ben warm, bemoedigend, en ik hou ervan je te helpen jouw beste stijl te ontdekken!",
    Swedish: "Hej! Jag är Ruby, din personliga stylist. Jag är varm, uppmuntrande, och jag älskar att hjälpa dig upptäcka din bästa stil!",
    Polish: "Cześć! Jestem Ruby, twoja osobista stylistka. Jestem ciepła, zachęcająca, i uwielbiam pomagać ci odkryć swój najlepszy styl!",
    Turkish: "Merhaba! Ben Ruby, kişisel stilistiniz. Sıcak, cesaretlendirici biriyim ve en iyi tarzınızı keşfetmenize yardımcı olmayı seviyorum!",
  },
  max: {
    English: "Hey! I'm Max, your go-to guy for style. I keep it real and help you look effortlessly cool. Ready to level up your wardrobe?",
    French: "Salut! Je suis Max, ton expert style. Je reste authentique et je t'aide à avoir l'air cool sans effort. Prêt à améliorer ta garde-robe?",
    Spanish: "Hey! Soy Max, tu experto en estilo. Soy auténtico y te ayudo a verte genial sin esfuerzo. Listo para mejorar tu guardarropa?",
    German: "Hey! Ich bin Max, dein Stil-Experte. Ich bleibe authentisch und helfe dir, mühelos cool auszusehen. Bereit, deine Garderobe aufzuwerten?",
    Italian: "Ehi! Sono Max, il tuo esperto di stile. Resto autentico e ti aiuto a sembrare cool senza sforzo. Pronto a migliorare il tuo guardaroba?",
    Portuguese: "E aí! Sou Max, seu especialista em estilo. Sou autêntico e ajudo você a parecer descolado sem esforço. Pronto para melhorar seu guarda-roupa?",
    Japanese: "やあ!僕はマックス、あなたのスタイル担当だよ。本物志向で、楽にカッコよく見えるようサポートするよ!",
    Korean: "안녕! 나는 맥스, 너의 스타일 전문가야. 진정성 있게, 힘들이지 않고 멋져 보이게 도와줄게!",
    Chinese: "嘿!我是Max,你的时尚专家。我保持真实,帮你轻松展现酷感。准备好升级你的衣橱了吗?",
    Arabic: "مرحبا! أنا ماكس، خبير الأناقة الخاص بك. أبقى صادقا وأساعدك على الظهور بمظهر رائع!",
    Hindi: "हे! मैं मैक्स हूं, तुम्हारा स्टाइल एक्सपर्ट। मैं असली रहता हूं और तुम्हें बिना मेहनत के कूल दिखने में मदद करता हूं!",
    Russian: "Привет! Я Макс, твой эксперт по стилю. Я остаюсь настоящим и помогу тебе выглядеть круто без усилий!",
    Dutch: "Hey! Ik ben Max, jouw stijlexpert. Ik blijf echt en help je moeiteloos cool te ogen. Klaar om je garderobe te upgraden?",
    Swedish: "Hej! Jag är Max, din stilexpert. Jag håller det äkta och hjälper dig se cool ut utan ansträngning!",
    Polish: "Hej! Jestem Max, twój ekspert od stylu. Jestem autentyczny i pomagam ci wyglądać na wyluzowanego bez wysiłku!",
    Turkish: "Selam! Ben Max, senin stil uzmanın. Gerçekçi kalıyorum ve zahmetsizce havalı görünmene yardımcı oluyorum!",
  },
  ace: {
    English: "What's up! I'm Ace — streetwear, culture, real style. No fluff, just what actually works. Let's talk fashion.",
    French: "Salut! Je suis Ace — streetwear, culture, style réel. Pas de chichi, juste ce qui marche vraiment. On parle mode?",
    Spanish: "Qué pasa! Soy Ace — streetwear, cultura, estilo real. Sin rodeos, solo lo que funciona de verdad. Hablemos de moda.",
    German: "Hey! Ich bin Ace — Streetwear, Kultur, echter Stil. Kein Blödsinn, nur was wirklich funktioniert. Reden wir über Mode.",
    Italian: "Ciao! Sono Ace — streetwear, cultura, stile vero. Niente fronzoli, solo ciò che funziona davvero. Parliamo di moda.",
    Portuguese: "E aí! Sou Ace — streetwear, cultura, estilo real. Sem frescura, só o que funciona de verdade. Bora falar de moda.",
    Japanese: "よ!僕はエース — ストリートウェア、カルチャー、リアルなスタイル。無駄なし、本当に使えるやつだけ。ファッション話そう。",
    Korean: "안녕! 나는 에이스 — 스트리트웨어, 문화, 진짜 스타일. 허튼 소리 없이, 진짜 통하는 것만. 패션 얘기하자.",
    Chinese: "嘿!我是Ace — 街头服饰、文化、真实风格。没废话,只说真正管用的。聊聊时尚吧。",
    Arabic: "مرحبا! أنا أيس — ملابس الشارع، الثقافة، الأسلوب الحقيقي. لا كلام فارغ، فقط ما يصلح فعلاً. نتكلم موضة؟",
    Hindi: "क्या हाल है! मैं Ace हूं — स्ट्रीटवियर, कल्चर, असली स्टाइल। बकवास नहीं, बस जो सच में काम करे। फैशन बात करते हैं।",
    Russian: "Привет! Я Эйс — уличная мода, культура, реальный стиль. Без лишних слов, только то, что реально работает. Поговорим о моде.",
    Dutch: "Hey! Ik ben Ace — streetwear, cultuur, echte stijl. Geen onzin, alleen wat echt werkt. Laten we het over mode hebben.",
    Swedish: "Tja! Jag är Ace — streetwear, kultur, riktig stil. Ingen fluff, bara det som faktiskt funkar. Vi pratar mode.",
    Polish: "Hej! Jestem Ace — streetwear, kultura, prawdziwy styl. Bez ściemy, tylko to co naprawdę działa. Pogadajmy o modzie.",
    Turkish: "Selam! Ben Ace — sokak giyimi, kültür, gerçek stil. Saçmalık yok, sadece gerçekten işe yarayan. Moda hakkında konuşalım.",
  },
  ivy: {
    English: "Hello. I'm Ivy — editorial, precise, and uncompromising. I see proportion, silhouette, and intention in everything. Shall we talk style?",
    French: "Bonjour. Je suis Ivy — éditorial, précis, et sans compromis. Je vois la proportion, la silhouette et l'intention dans tout. Parlons style?",
    Spanish: "Hola. Soy Ivy — editorial, precisa e implacable. Veo proporción, silueta e intención en todo. ¿Hablamos de estilo?",
    German: "Hallo. Ich bin Ivy — redaktionell, präzise und kompromisslos. Ich sehe Proportion, Silhouette und Absicht in allem. Reden wir über Stil?",
    Italian: "Buongiorno. Sono Ivy — editoriale, precisa e senza compromessi. Vedo proporzione, silhouette e intenzione in tutto. Parliamo di stile?",
    Portuguese: "Olá. Sou Ivy — editorial, precisa e inflexível. Vejo proporção, silhueta e intenção em tudo. Vamos falar de estilo?",
    Japanese: "こんにちは。私はアイビー — エディトリアル、的確、妥協なし。あらゆるものにプロポーション、シルエット、意図を見出します。スタイルについて話しましょうか?",
    Korean: "안녕하세요. 저는 아이비 — 에디토리얼하고, 정확하며, 타협 없는 스타일리스트예요. 모든 것에서 비율, 실루엣, 의도를 봅니다. 스타일 얘기 할까요?",
    Chinese: "你好。我是Ivy — 编辑风格,精准,毫不妥协。我在一切中看到比例、剪影和意图。我们来谈谈风格吧?",
    Arabic: "مرحبا. أنا آيفي — تحريري، دقيق، وبلا تنازلات. أرى النسب والخط والنية في كل شيء. نتحدث عن الأسلوب؟",
    Hindi: "नमस्ते। मैं Ivy हूं — एडिटोरियल, सटीक, और बिना समझौते के। मैं हर चीज में अनुपात, सिल्हूट और इरादा देखती हूं। स्टाइल की बात करें?",
    Russian: "Привет. Я Айви — редакционный, точный и бескомпромиссный стиль. Я вижу пропорцию, силуэт и намерение во всём. Поговорим о стиле?",
    Dutch: "Hallo. Ik ben Ivy — redactioneel, precies en oncompromittend. Ik zie proporties, silhouet en intentie in alles. Zullen we het over stijl hebben?",
    Swedish: "Hej. Jag är Ivy — redaktionell, precis och kompromisslös. Jag ser proportion, silhuett och avsikt i allt. Ska vi prata stil?",
    Polish: "Cześć. Jestem Ivy — redakcyjna, precyzyjna i bezkompromisowa. Widzę proporcje, sylwetkę i intencję we wszystkim. Porozmawiamy o stylu?",
    Turkish: "Merhaba. Ben Ivy — editoryal, hassas ve uzlaşmasız. Her şeyde orantı, siluet ve niyet görürüm. Stil hakkında konuşalım mı?",
  },
};

async function generateVoicePreview(stylistId, language = 'English', voiceRange = null, customText = null) {
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) {
    return {
      success: false,
      error: `Unknown stylist: ${stylistId}. Valid options: ruby, max, ace, ivy`,
    };
  }

  const text = customText || phrases[language] || phrases['English'];
  const langCode = normalizeLanguage(language);

  console.log(`[VoiceService] Generating preview for ${stylistId} in ${language} (${langCode}), voiceRange: ${voiceRange}`);

  return synthesizeSpeech(text, {
    stylistId,
    language: langCode,
    voiceRange,
    highQuality: true,
  });
}

// ============ UTILITY FUNCTIONS ============

function processVoiceMessage(audioBuffer, stylistId = 'ruby') {
  return transcribeAudio(audioBuffer).then((transcription) => {
    if (!transcription.success) {
      return {
        success: false,
        error: transcription.error,
        stage: 'transcription',
      };
    }
    return {
      success: true,
      transcribedText: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      stylistId,
    };
  });
}

async function createVoiceResponse(responseText, stylistId = 'ruby', options = {}) {
  const resolvedLanguage = options.language || options.transcriptionLanguage || 'en';
  const synthesis = await synthesizeSpeech(responseText, {
    stylistId,
    language: resolvedLanguage,
    voiceRange: options.voiceRange || null,
    highQuality: options.highQuality !== false,
  });

  if (!synthesis.success) {
    return {
      success: false,
      error: synthesis.error,
      stage: 'synthesis',
    };
  }

  return {
    success: true,
    audioBuffer: synthesis.audioBuffer,
    voice: synthesis.voice,
    format: synthesis.format,
  };
}

function getVoiceForStylist(stylistId) {
  return getVoiceCharacterName(stylistId, 'en', null);
}

function getAllVoices() {
  return [
    { id: 'tiffany', description: 'Ruby — English (gritty, husky)', stylist: 'ruby', lang: 'en' },
    { id: 'rachel', description: 'Ruby — Italian', stylist: 'ruby', lang: 'it' },
    { id: 'glinda', description: 'Ruby — Spanish', stylist: 'ruby', lang: 'es' },
    { id: 'grace', description: 'Ruby — French', stylist: 'ruby', lang: 'fr' },
    { id: 'emily', description: 'Ruby — German', stylist: 'ruby', lang: 'de' },
    { id: 'alice', description: 'Ruby — Portuguese', stylist: 'ruby', lang: 'pt' },
    { id: 'jessica', description: 'Ruby — All other languages', stylist: 'ruby', lang: 'other' },
    { id: 'josh', description: 'Max — English Tenor', stylist: 'max', lang: 'en', range: 'tenor' },
    { id: 'adam', description: 'Max — English Baritone', stylist: 'max', lang: 'en', range: 'baritone' },
    { id: 'arnold', description: 'Max — English Bass', stylist: 'max', lang: 'en', range: 'bass' },
    { id: 'daniel', description: 'Max — All non-English', stylist: 'max', lang: 'other' },
    { id: 'callum', description: 'Ace — English', stylist: 'ace', lang: 'en' },
    { id: 'arnold', description: 'Ace — All non-English', stylist: 'ace', lang: 'other' },
    { id: 'charlotte', description: 'Ivy — English & most languages', stylist: 'ivy', lang: 'en' },
    { id: 'manuela', description: 'Ivy — Italian', stylist: 'ivy', lang: 'it' },
  ];
}

function getSupportedLanguages() {
  return Object.keys(VOICE_PREVIEW_PHRASES.ruby);
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  getVoiceForStylist,
  getVoiceId,
  getVoiceCharacterName,
  getVoiceSettings,
  getAllVoices,
  processVoiceMessage,
  createVoiceResponse,
  generateVoicePreview,
  getSupportedLanguages,
  VOICE_PREVIEW_PHRASES,
};
