const OpenAI = require('openai');
const { getBestModel, getVoiceOptions } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// All 4 stylists mapped to best-fit OpenAI TTS voices
const STYLIST_VOICES = {
  ruby: 'shimmer',  // Clear, optimistic — warm and encouraging
  max: 'onyx',      // Deep, authoritative — direct and confident
  ace: 'echo',      // Warm, conversational — laid-back and cool
  ivy: 'fable',     // British, expressive — sophisticated and editorial
};

// Default speed per stylist (OpenAI TTS range: 0.25–4.0)
const STYLIST_DEFAULT_SPEEDS = {
  ruby: 0.95,  // Slightly warm/measured pace
  max: 1.05,   // Slightly brisk and direct
  ace: 0.95,   // Relaxed, conversational
  ivy: 0.88,   // Measured, editorial
};

const RUBY_VOICE_SPEEDS = {
  'soprano': 1.05,
  'mezzo-soprano': 0.95,
  'contralto': 0.88,
};

const MAX_VOICE_SPEEDS = {
  'tenor': 1.1,
  'baritone': 1.0,
  'bass': 0.9,
};

const ACE_VOICE_SPEEDS = {
  'tenor': 1.05,
  'baritone': 0.95,
  'bass': 0.88,
};

const IVY_VOICE_SPEEDS = {
  'soprano': 0.92,
  'mezzo-soprano': 0.88,
  'contralto': 0.82,
};

function getSpeedForVoice(stylistId, voiceRange) {
  if (!voiceRange) return STYLIST_DEFAULT_SPEEDS[stylistId] || 1.0;
  if (stylistId === 'max') return MAX_VOICE_SPEEDS[voiceRange] || STYLIST_DEFAULT_SPEEDS.max;
  if (stylistId === 'ace') return ACE_VOICE_SPEEDS[voiceRange] || STYLIST_DEFAULT_SPEEDS.ace;
  if (stylistId === 'ivy') return IVY_VOICE_SPEEDS[voiceRange] || STYLIST_DEFAULT_SPEEDS.ivy;
  return RUBY_VOICE_SPEEDS[voiceRange] || STYLIST_DEFAULT_SPEEDS.ruby;
}

const VOICE_DESCRIPTIONS = {
  alloy: 'Neutral and balanced',
  echo: 'Warm and conversational',
  fable: 'British and expressive',
  onyx: 'Deep and authoritative',
  nova: 'Warm and friendly',
  shimmer: 'Clear and optimistic',
};

// Intro phrases for all 4 stylists across 16 languages
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

async function synthesizeSpeech(text, options = {}) {
  const {
    stylistId = 'ruby',
    voice = null,
    speed = null,
    highQuality = true,
    voiceRange = null,
  } = options;

  try {
    const selectedVoice = voice || STYLIST_VOICES[stylistId] || 'nova';
    const selectedSpeed = speed !== null ? speed : getSpeedForVoice(stylistId, voiceRange);
    const ttsModel = highQuality ? 'tts-1-hd' : 'tts-1';

    console.log(`[VoiceService] Synthesizing speech for ${stylistId} — model: ${ttsModel}, voice: ${selectedVoice}, speed: ${selectedSpeed}`);

    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/_/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n{3,}/g, '\n\n');

    const response = await openai.audio.speech.create({
      model: ttsModel,
      voice: selectedVoice,
      input: cleanText,
      speed: Math.max(0.25, Math.min(4.0, selectedSpeed)),
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      audioBuffer: buffer,
      voice: selectedVoice,
      modelUsed: ttsModel,
      format: 'mp3',
      textLength: cleanText.length,
    };
  } catch (error) {
    console.error('[VoiceService] Speech synthesis error:', error.message);
    return {
      success: false,
      error: error.message,
      audioBuffer: null,
    };
  }
}

function getVoiceForStylist(stylistId) {
  return STYLIST_VOICES[stylistId] || 'nova';
}

function getAllVoices() {
  return Object.entries(VOICE_DESCRIPTIONS).map(([id, description]) => ({
    id,
    description,
    isStylistVoice: Object.values(STYLIST_VOICES).includes(id),
  }));
}

async function processVoiceMessage(audioBuffer, stylistId = 'ruby') {
  const transcription = await transcribeAudio(audioBuffer);
  
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
}

async function createVoiceResponse(responseText, stylistId = 'ruby', options = {}) {
  const synthesis = await synthesizeSpeech(responseText, {
    stylistId,
    highQuality: options.highQuality !== false,
    speed: options.speed || null,
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

async function generateVoicePreview(stylistId, language = 'English', voiceRange = null, customText = null) {
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) {
    return {
      success: false,
      error: `Unknown stylist: ${stylistId}. Valid options: ruby, max, ace, ivy`,
    };
  }

  const text = customText || phrases[language] || phrases['English'];
  const voice = STYLIST_VOICES[stylistId] || 'shimmer';
  const speed = getSpeedForVoice(stylistId, voiceRange);

  console.log(`[VoiceService] Generating preview for ${stylistId} in ${language}, voice: ${voice}, speed: ${speed}`);

  return synthesizeSpeech(text, {
    stylistId,
    voice,
    speed,
    highQuality: true,
  });
}

function getSupportedLanguages() {
  return Object.keys(VOICE_PREVIEW_PHRASES.ruby);
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  getVoiceForStylist,
  getAllVoices,
  processVoiceMessage,
  createVoiceResponse,
  generateVoicePreview,
  getSupportedLanguages,
  STYLIST_VOICES,
  VOICE_DESCRIPTIONS,
  VOICE_PREVIEW_PHRASES,
};
