import { AudioModule, AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

const LANGUAGE_CODES: Record<string, string> = {
  English: 'en-US',
  French: 'fr-FR',
  Spanish: 'es-ES',
  German: 'de-DE',
  Italian: 'it-IT',
  Portuguese: 'pt-BR',
  Japanese: 'ja-JP',
  Korean: 'ko-KR',
  Chinese: 'zh-CN',
  Arabic: 'ar-SA',
  Hindi: 'hi-IN',
  Russian: 'ru-RU',
  Dutch: 'nl-NL',
  Swedish: 'sv-SE',
  Polish: 'pl-PL',
  Turkish: 'tr-TR',
};

const LANGUAGE_CODE_ALTERNATIVES: Record<string, string[]> = {
  French: ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr'],
  Spanish: ['es-ES', 'es-MX', 'es-US', 'es-AR', 'es-CO', 'es'],
  German: ['de-DE', 'de-AT', 'de-CH', 'de'],
  Italian: ['it-IT', 'it-CH', 'it'],
  Portuguese: ['pt-BR', 'pt-PT', 'pt'],
  Japanese: ['ja-JP', 'ja'],
  Korean: ['ko-KR', 'ko'],
  Chinese: ['zh-CN', 'zh-TW', 'zh-HK', 'zh'],
  Arabic: ['ar-SA', 'ar-AE', 'ar-EG', 'ar'],
  Hindi: ['hi-IN', 'hi'],
  Russian: ['ru-RU', 'ru'],
  Dutch: ['nl-NL', 'nl-BE', 'nl'],
  Swedish: ['sv-SE', 'sv'],
  Polish: ['pl-PL', 'pl'],
  Turkish: ['tr-TR', 'tr'],
  English: ['en-US', 'en-GB', 'en-AU', 'en-IE', 'en-IN', 'en'],
};

let cachedVoices: Speech.Voice[] = [];
let voicesCacheTime = 0;
const VOICE_CACHE_TTL = 60000;

const getAvailableVoices = async (): Promise<Speech.Voice[]> => {
  const now = Date.now();
  if (cachedVoices.length > 0 && (now - voicesCacheTime) < VOICE_CACHE_TTL) {
    return cachedVoices;
  }
  
  try {
    cachedVoices = await Speech.getAvailableVoicesAsync();
    voicesCacheTime = now;
    return cachedVoices;
  } catch (error) {
    console.log('Failed to get available voices:', error);
    return [];
  }
};

const findBestVoiceForLanguage = async (language: string, preferFemale: boolean = true): Promise<{ voiceId?: string; langCode: string } | null> => {
  const alternatives = LANGUAGE_CODE_ALTERNATIVES[language] || [LANGUAGE_CODES[language] || 'en-US'];
  const voices = await getAvailableVoices();
  
  if (voices.length === 0) {
    return { langCode: alternatives[0] };
  }
  
  const femaleKeywords = ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'siri female', 'zoe', 'nicky', 'ava', 'allison', 'susan', 'kate', 'serena', 'veena', 'emily', 'emma', 'enhanced', 'premium'];
  const maleKeywords = ['male', 'man', 'daniel', 'alex', 'fred', 'tom', 'lee', 'oliver', 'aaron', 'gordon', 'rishi', 'james', 'evan'];
  
  const scoredVoices = voices.map(v => {
    const identifier = (v.identifier || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    const quality = v.quality || '';
    
    let score = 0;
    
    const langPrefix = alternatives[0].split('-')[0].toLowerCase();
    const voiceLang = v.language?.toLowerCase() || '';
    if (voiceLang === alternatives[0].toLowerCase() || 
        voiceLang.startsWith(langPrefix + '-') ||
        voiceLang === langPrefix) {
      score += 10;
    } else {
      return { voice: v, score: -1 };
    }
    
    if (quality === 'Enhanced' || identifier.includes('enhanced') || identifier.includes('premium')) {
      score += 5;
    }
    
    const isLikelyFemale = femaleKeywords.some(kw => identifier.includes(kw) || name.includes(kw));
    const isLikelyMale = maleKeywords.some(kw => identifier.includes(kw) || name.includes(kw));
    
    if (preferFemale && isLikelyFemale && !isLikelyMale) {
      score += 8;
    } else if (!preferFemale && isLikelyMale && !isLikelyFemale) {
      score += 8;
    } else if (preferFemale && !isLikelyMale) {
      score += 2;
    } else if (!preferFemale && !isLikelyFemale) {
      score += 2;
    }
    
    return { voice: v, score };
  });
  
  const validVoices = scoredVoices.filter(sv => sv.score >= 0);
  validVoices.sort((a, b) => b.score - a.score);
  
  if (validVoices.length > 0) {
    const bestVoice = validVoices[0].voice;
    console.log(`Selected voice for ${language} (${preferFemale ? 'female' : 'male'}): ${bestVoice.identifier} - ${bestVoice.name}`);
    return { voiceId: bestVoice.identifier, langCode: bestVoice.language || alternatives[0] };
  }
  
  for (const langCode of alternatives) {
    const matchingVoice = voices.find(v => {
      const voiceLang = v.language?.toLowerCase() || '';
      const targetLang = langCode.toLowerCase();
      return voiceLang === targetLang || 
             voiceLang.startsWith(targetLang.split('-')[0] + '-') ||
             voiceLang === targetLang.split('-')[0];
    });
    
    if (matchingVoice) {
      return { voiceId: matchingVoice.identifier, langCode: matchingVoice.language || langCode };
    }
  }
  
  return null;
};

const VOICE_PREVIEW_PHRASES: Record<string, Record<string, string>> = {
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

let currentPlayer: AudioPlayer | null = null;

export const stopAudio = async (): Promise<void> => {
  await Speech.stop();
  
  if (currentPlayer) {
    try {
      await currentPlayer.remove();
      currentPlayer = null;
    } catch (error) {
      console.log('Error stopping audio:', error);
    }
  }
};

const playWithFallbackSpeech = async (
  stylistId: string,
  language: string,
  voiceRange?: string
): Promise<void> => {
  let text = getVoicePreviewPhrase(stylistId, language);
  if (!text) {
    throw new Error('No preview phrase available');
  }

  await Speech.stop();

  const preferFemale = stylistId === 'ruby';
  const voiceInfo = await findBestVoiceForLanguage(language, preferFemale);
  
  let langCode = LANGUAGE_CODES[language] || 'en-US';
  let voiceId: string | undefined;
  let useEnglishFallback = false;
  
  if (voiceInfo) {
    langCode = voiceInfo.langCode;
    voiceId = voiceInfo.voiceId;
    console.log(`Found ${preferFemale ? 'female' : 'male'} voice for ${language}: ${voiceId || 'default'} (${langCode})`);
  } else {
    console.log(`No voice found for ${language}, falling back to English`);
    useEnglishFallback = true;
    const englishVoice = await findBestVoiceForLanguage('English', preferFemale);
    if (englishVoice) {
      langCode = englishVoice.langCode;
      voiceId = englishVoice.voiceId;
    } else {
      langCode = 'en-US';
    }
    text = getVoicePreviewPhrase(stylistId, 'English');
  }
  
  let pitch = 1.0;
  let rate = 0.95;
  
  if (stylistId === 'ruby') {
    pitch = 1.15;
    rate = 0.92;
    if (voiceRange === 'soprano') {
      pitch = 1.25;
      rate = 0.95;
    } else if (voiceRange === 'mezzo-soprano' || voiceRange === 'mezzo') {
      pitch = 1.15;
      rate = 0.90;
    } else if (voiceRange === 'contralto') {
      pitch = 1.0;
      rate = 0.85;
    }
  } else if (stylistId === 'max') {
    pitch = 0.80;
    rate = 0.90;
    if (voiceRange === 'tenor') {
      pitch = 0.95;
      rate = 0.95;
    } else if (voiceRange === 'baritone') {
      pitch = 0.80;
      rate = 0.90;
    } else if (voiceRange === 'bass') {
      pitch = 0.65;
      rate = 0.85;
    }
  }

  return new Promise((resolve, reject) => {
    const speechOptions: Speech.SpeechOptions = {
      language: langCode,
      pitch,
      rate,
      onDone: () => {
        console.log(`Speech completed for ${language}${useEnglishFallback ? ' (English fallback)' : ''}`);
        resolve();
      },
      onError: (error) => {
        console.log(`Speech error for ${language}:`, error);
        reject(error);
      },
      onStart: () => {
        console.log(`Speech started for ${stylistId} in ${language} with voice: ${voiceId || 'system default'}, pitch: ${pitch}, rate: ${rate}`);
      },
    };
    
    if (voiceId && Platform.OS !== 'web') {
      (speechOptions as any).voice = voiceId;
    }
    
    Speech.speak(text, speechOptions);
  });
};

const DEFAULT_VOICE_FOR_STYLIST: Record<string, TTSVoice> = {
  ruby: 'nova',
  max: 'onyx',
};

export const playVoicePreview = async (
  stylistId: string,
  language: string = 'English',
  voiceRange?: string,
  voice?: TTSVoice
): Promise<void> => {
  await stopAudio();

  const selectedVoice = voice || DEFAULT_VOICE_FOR_STYLIST[stylistId] || 'nova';

  if (!API_URL) {
    console.log('Backend API URL not configured, using device speech synthesis');
    return playWithFallbackSpeech(stylistId, language, voiceRange);
  }

  try {
    if (Platform.OS === 'ios') {
      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
      });
    }

    const response = await fetch(`${API_URL}/api/ai/voice-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stylistId,
        language,
        voiceRange,
        voice: selectedVoice,
      }),
    });

    if (!response.ok) {
      console.log('Backend voice preview failed, falling back to device speech');
      return playWithFallbackSpeech(stylistId, language, voiceRange);
    }

    const data = await response.json();
    
    if (!data.success || !data.audioBase64) {
      console.log('Invalid backend response, falling back to device speech');
      return playWithFallbackSpeech(stylistId, language, voiceRange);
    }

    const fileName = `voice_preview_${Date.now()}.mp3`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    
    await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    currentPlayer = AudioModule.createPlayer(fileUri);
    
    if (currentPlayer) {
      await currentPlayer.play();

      currentPlayer.addListener('playbackStatusUpdate', (status: { didJustFinish?: boolean }) => {
        if (status.didJustFinish) {
          FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          currentPlayer = null;
        }
      });
    }

  } catch (error) {
    console.log('Voice preview error, falling back to device speech:', error);
    return playWithFallbackSpeech(stylistId, language, voiceRange);
  }
};

export const isPlaying = (): boolean => {
  return currentPlayer !== null;
};

export const getSupportedLanguages = (): string[] => {
  return Object.keys(VOICE_PREVIEW_PHRASES.ruby);
};

export const getVoicePreviewPhrase = (stylistId: string, language: string): string => {
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) return '';
  return phrases[language] || phrases['English'];
};

export const checkLanguageVoiceAvailability = async (language: string): Promise<boolean> => {
  const voiceInfo = await findBestVoiceForLanguage(language);
  return voiceInfo !== null;
};

export const getAvailableLanguagesWithVoices = async (): Promise<string[]> => {
  const allLanguages = getSupportedLanguages();
  const availableLanguages: string[] = [];
  
  for (const lang of allLanguages) {
    const voiceInfo = await findBestVoiceForLanguage(lang);
    if (voiceInfo) {
      availableLanguages.push(lang);
    }
  }
  
  return availableLanguages;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  
  return Buffer.from(buffer).toString('base64');
}

export default {
  playVoicePreview,
  stopAudio,
  isPlaying,
  getSupportedLanguages,
  getVoicePreviewPhrase,
  checkLanguageVoiceAvailability,
  getAvailableLanguagesWithVoices,
};
