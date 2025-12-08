const OpenAI = require('openai');
const { getBestModel, getVoiceOptions } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STYLIST_VOICES = {
  ruby: 'shimmer',
  max: 'onyx',
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
};

function getSpeedForVoice(stylistId, voiceRange) {
  if (stylistId === 'max') {
    return MAX_VOICE_SPEEDS[voiceRange] || 1.0;
  }
  return RUBY_VOICE_SPEEDS[voiceRange] || 0.88;
}

const VOICE_DESCRIPTIONS = {
  alloy: 'Neutral and balanced',
  echo: 'Warm and conversational',
  fable: 'British and expressive',
  onyx: 'Deep and authoritative',
  nova: 'Warm and friendly',
  shimmer: 'Clear and optimistic',
};

async function transcribeAudio(audioBuffer, options = {}) {
  const {
    language = null,
    prompt = 'Fashion, style, outfit, wardrobe, clothing, accessories',
  } = options;

  try {
    const sttModel = await getBestModel('stt');
    console.log(`[VoiceService] Transcribing with model: ${sttModel}`);

    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

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
    speed = 1.0,
    highQuality = true,
  } = options;

  try {
    const selectedVoice = voice || STYLIST_VOICES[stylistId] || 'nova';
    const ttsModel = highQuality ? 'tts-1-hd' : 'tts-1';

    console.log(`[VoiceService] Synthesizing speech with ${ttsModel}, voice: ${selectedVoice}`);

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
      speed: Math.max(0.25, Math.min(4.0, speed)),
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
    speed: options.speed || 1.0,
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

async function generateVoicePreview(stylistId, language = 'English', voiceRange = null) {
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) {
    return {
      success: false,
      error: `Unknown stylist: ${stylistId}`,
    };
  }

  const text = phrases[language] || phrases['English'];
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
