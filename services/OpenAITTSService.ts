import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVoicePreviewScript } from './CulturalLocalizationService';
import { API_URL } from '@/config/api';
import { LANGUAGE_ACCENT_MAP } from './PersonalStylistService';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

const TOKEN_KEY = '@dripn_token';

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export interface TTSOptions {
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number;
}

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

const ELEVENLABS_LANGUAGE_CODES: Record<string, string> = {
  'Standard Italian': 'it',
  'Standard French': 'fr',
  'Parisian French': 'fr',
  'Canadian French': 'fr-CA',
  'Standard German': 'de',
  'Austrian German': 'de',
  'Swiss German': 'de',
  'Castilian Spanish': 'es',
  'Mexican Spanish': 'es-MX',
  'Latin American Spanish': 'es',
  'Brazilian Portuguese': 'pt-BR',
  'European Portuguese': 'pt-PT',
  'Standard Japanese': 'ja',
  'Standard Korean': 'ko',
  'Mandarin Chinese': 'zh',
  'Standard Arabic': 'ar',
  'Standard Hindi': 'hi',
  'Standard Russian': 'ru',
  'Standard Dutch': 'nl',
  'American': 'en',
  'British': 'en-GB',
  'Australian': 'en-AU',
  'Irish': 'en-IE',
  'Indian English': 'en-IN',
};

const getLanguageCodeForAccent = (accent?: string): string | undefined => {
  if (!accent) return undefined;
  return ELEVENLABS_LANGUAGE_CODES[accent];
};

/** Map onboarding language picker → backend accent key + ElevenLabs ISO code. */
const LANGUAGE_TO_BACKEND_ACCENT: Record<string, string> = {
  English: 'american',
  Spanish: 'spanish',
  French: 'french',
  German: 'german',
  Italian: 'italian',
  Portuguese: 'portuguese',
  Japanese: 'japanese',
  Korean: 'korean',
  Chinese: 'mandarin',
  Arabic: 'arabic',
  Hindi: 'hindi',
  Dutch: 'dutch',
  Russian: 'russian',
  Swedish: 'swedish',
};

const LANGUAGE_TO_ISO_CODE: Record<string, string> = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Japanese: 'ja',
  Korean: 'ko',
  Chinese: 'zh',
  Arabic: 'ar',
  Hindi: 'hi',
  Dutch: 'nl',
  Russian: 'ru',
  Swedish: 'sv',
};

function resolveVoiceLanguageContext(language: string, accent?: string) {
  if (language === 'English') {
    const englishAccent = accent || 'American';
    return {
      backendAccent: englishAccent,
      voiceLibraryAccent: englishAccent,
      languageCode: getLanguageCodeForAccent(englishAccent) || 'en',
    };
  }
  const voiceLibraryAccent = LANGUAGE_ACCENT_MAP[language]?.[0] || language;
  return {
    backendAccent: LANGUAGE_TO_BACKEND_ACCENT[language] || language.toLowerCase(),
    voiceLibraryAccent,
    languageCode: LANGUAGE_TO_ISO_CODE[language],
  };
}

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

const IOS_PREMIUM_VOICES = {
  female: {
    'en-US': ['com.apple.voice.enhanced.en-US.Ava', 'com.apple.voice.compact.en-US.Samantha', 'com.apple.ttsbundle.Samantha-compact', 'Samantha'],
    'en-GB': ['com.apple.voice.enhanced.en-GB.Serena', 'com.apple.voice.compact.en-GB.Kate', 'com.apple.ttsbundle.Kate-compact', 'Kate', 'Serena'],
    'en-AU': ['com.apple.voice.enhanced.en-AU.Karen', 'com.apple.voice.compact.en-AU.Karen', 'Karen'],
    'en-IE': ['com.apple.voice.enhanced.en-IE.Moira', 'com.apple.voice.compact.en-IE.Moira', 'Moira'],
    'en-SCT': ['com.apple.voice.enhanced.en-GB.Fiona', 'com.apple.voice.compact.en-GB.Fiona', 'Fiona'],
    'en-CA': ['com.apple.voice.enhanced.en-US.Ava', 'com.apple.voice.compact.en-US.Samantha', 'Samantha'],
    'en-ZA': ['com.apple.voice.enhanced.en-ZA.Tessa', 'com.apple.voice.compact.en-ZA.Tessa', 'Tessa'],
    'en-IN': ['com.apple.voice.enhanced.en-IN.Veena', 'com.apple.voice.compact.en-IN.Veena', 'Veena'],
    'en-JM': ['com.apple.voice.enhanced.en-US.Ava', 'com.apple.voice.compact.en-US.Samantha', 'Samantha'],
  },
  male: {
    'en-US': ['com.apple.voice.enhanced.en-US.Evan', 'com.apple.voice.compact.en-US.Alex', 'com.apple.ttsbundle.Alex-compact', 'Alex'],
    'en-GB': ['com.apple.voice.enhanced.en-GB.Daniel', 'com.apple.voice.compact.en-GB.Daniel', 'com.apple.ttsbundle.Daniel-compact', 'Daniel'],
    'en-AU': ['com.apple.voice.enhanced.en-AU.Lee', 'com.apple.voice.compact.en-AU.Lee', 'Lee'],
    'en-IE': ['com.apple.voice.enhanced.en-IE.Moira', 'com.apple.voice.compact.en-IE.Moira', 'Moira'],
    'en-SCT': ['com.apple.voice.enhanced.en-GB.Daniel', 'com.apple.voice.compact.en-GB.Daniel', 'Daniel'],
    'en-CA': ['com.apple.voice.enhanced.en-US.Evan', 'com.apple.voice.compact.en-US.Alex', 'Alex'],
    'en-ZA': ['com.apple.voice.enhanced.en-ZA.Rishi', 'com.apple.voice.compact.en-ZA.Rishi', 'Rishi'],
    'en-IN': ['com.apple.voice.enhanced.en-IN.Rishi', 'com.apple.voice.compact.en-IN.Rishi', 'Rishi'],
    'en-JM': ['com.apple.voice.enhanced.en-US.Evan', 'com.apple.voice.compact.en-US.Alex', 'Alex'],
  },
};

const findBestVoiceForLanguage = async (
  language: string, 
  preferFemale: boolean = true,
  accent?: string
): Promise<{ voiceId?: string; langCode: string } | null> => {
  const voices = await getAvailableVoices();
  
  let targetLangCode = LANGUAGE_CODES[language] || 'en-US';
  if (language === 'English' && accent) {
    if (accent === 'British' || accent === 'UK') {
      targetLangCode = 'en-GB';
    } else if (accent === 'Australian') {
      targetLangCode = 'en-AU';
    } else if (accent === 'Irish') {
      targetLangCode = 'en-IE';
    } else if (accent === 'Scottish') {
      targetLangCode = 'en-SCT';
    } else if (accent === 'Canadian') {
      targetLangCode = 'en-CA';
    } else if (accent === 'South African') {
      targetLangCode = 'en-ZA';
    } else if (accent === 'Indian') {
      targetLangCode = 'en-IN';
    } else if (accent === 'Caribbean') {
      targetLangCode = 'en-JM';
    } else if (accent === 'American' || accent === 'US') {
      targetLangCode = 'en-US';
    }
  }
  
  if (voices.length === 0) {
    return { langCode: targetLangCode };
  }
  
  if (Platform.OS === 'ios') {
    const genderVoices = preferFemale ? IOS_PREMIUM_VOICES.female : IOS_PREMIUM_VOICES.male;
    const preferredVoices = genderVoices[targetLangCode as keyof typeof genderVoices] || genderVoices['en-US'];
    
    for (const preferredId of preferredVoices) {
      const match = voices.find(v => 
        v.identifier?.toLowerCase().includes(preferredId.toLowerCase()) ||
        v.name?.toLowerCase() === preferredId.toLowerCase()
      );
      if (match) {
        console.log(`Found iOS premium voice for ${language} (${accent || 'default'}): ${match.identifier} - ${match.name}`);
        return { voiceId: match.identifier, langCode: match.language || targetLangCode };
      }
    }
  }
  
  const alternatives = LANGUAGE_CODE_ALTERNATIVES[language] || [targetLangCode];
  
  const femaleKeywords = ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'siri female', 'zoe', 'nicky', 'ava', 'allison', 'susan', 'kate', 'serena', 'veena', 'emily', 'emma', 'enhanced', 'premium'];
  const maleKeywords = ['male', 'man', 'daniel', 'alex', 'fred', 'tom', 'lee', 'oliver', 'aaron', 'gordon', 'rishi', 'james', 'evan'];
  
  const scoredVoices = voices.map(v => {
    const identifier = (v.identifier || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    const quality = v.quality || '';
    const voiceLang = v.language?.toLowerCase() || '';
    
    let score = 0;
    
    if (voiceLang === targetLangCode.toLowerCase()) {
      score += 15;
    } else {
      const langPrefix = targetLangCode.split('-')[0].toLowerCase();
      if (voiceLang.startsWith(langPrefix + '-') || voiceLang === langPrefix) {
        score += 8;
      } else {
        return { voice: v, score: -1 };
      }
    }
    
    if (quality === 'Enhanced' || identifier.includes('enhanced') || identifier.includes('premium')) {
      score += 10;
    }
    
    const isLikelyFemale = femaleKeywords.some(kw => identifier.includes(kw) || name.includes(kw));
    const isLikelyMale = maleKeywords.some(kw => identifier.includes(kw) || name.includes(kw));
    
    if (preferFemale && isLikelyFemale && !isLikelyMale) {
      score += 12;
    } else if (!preferFemale && isLikelyMale && !isLikelyFemale) {
      score += 12;
    } else if (preferFemale && !isLikelyMale) {
      score += 3;
    } else if (!preferFemale && !isLikelyFemale) {
      score += 3;
    }
    
    return { voice: v, score };
  });
  
  const validVoices = scoredVoices.filter(sv => sv.score >= 0);
  validVoices.sort((a, b) => b.score - a.score);
  
  if (validVoices.length > 0) {
    const bestVoice = validVoices[0].voice;
    console.log(`Selected voice for ${language} (${preferFemale ? 'female' : 'male'}, ${accent || 'default'}): ${bestVoice.identifier} - ${bestVoice.name}`);
    return { voiceId: bestVoice.identifier, langCode: bestVoice.language || targetLangCode };
  }
  
  for (const langCode of alternatives) {
    const matchingVoice = voices.find(v => {
      const voiceLang = v.language?.toLowerCase() || '';
      const target = langCode.toLowerCase();
      return voiceLang === target || 
             voiceLang.startsWith(target.split('-')[0] + '-') ||
             voiceLang === target.split('-')[0];
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
let webAudioElement: HTMLAudioElement | null = null;

const playAudioOnWeb = async (dataUriOrBase64: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (webAudioElement) {
        webAudioElement.pause();
        webAudioElement.src = '';
        webAudioElement = null;
      }
      
      let audioSrc = dataUriOrBase64;
      
      // If it's raw base64 (not a data URI), convert to blob URL for better compatibility
      if (!dataUriOrBase64.startsWith('data:') && !dataUriOrBase64.startsWith('http')) {
        try {
          const byteCharacters = atob(dataUriOrBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          audioSrc = URL.createObjectURL(blob);
          console.log('Created blob URL for audio playback');
        } catch (e) {
          console.log('Failed to create blob, using as data URI:', e);
          audioSrc = `data:audio/mpeg;base64,${dataUriOrBase64}`;
        }
      }
      
      // If it's a data URI, try converting to blob URL for better browser support
      if (audioSrc.startsWith('data:audio')) {
        try {
          const [header, base64Data] = audioSrc.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          audioSrc = URL.createObjectURL(blob);
          console.log('Converted data URI to blob URL for better compatibility');
        } catch (e) {
          console.log('Blob conversion failed, using original data URI:', e);
        }
      }
      
      console.log('Playing audio from:', audioSrc.substring(0, 80));
      
      const audio = new window.Audio(audioSrc);
      webAudioElement = audio;
      
      audio.onended = () => {
        // Clean up blob URL if we created one
        if (audioSrc.startsWith('blob:')) {
          URL.revokeObjectURL(audioSrc);
        }
        webAudioElement = null;
        resolve();
      };
      
      audio.onerror = (e: any) => {
        const errorCode = audio.error?.code;
        const errorMessage = audio.error?.message || 'Unknown error';
        console.log('Web audio playback error - code:', errorCode, 'message:', errorMessage, 'event:', e);
        if (audioSrc.startsWith('blob:')) {
          URL.revokeObjectURL(audioSrc);
        }
        webAudioElement = null;
        reject(new Error(`Web audio playback failed: ${errorMessage}`));
      };
      
      audio.oncanplaythrough = () => {
        console.log('Audio can play through - starting playback');
      };
      
      audio.play().then(() => {
        console.log('Playing audio on web successfully');
      }).catch((playError) => {
        console.log('Audio play() promise rejected:', playError);
        if (audioSrc.startsWith('blob:')) {
          URL.revokeObjectURL(audioSrc);
        }
        webAudioElement = null;
        reject(playError);
      });
    } catch (error) {
      console.log('Web audio setup error:', error);
      reject(error);
    }
  });
};

const playAudioFile = async (uri: string): Promise<void> => {
  try {
    // On web, use HTML5 Audio API directly
    if (Platform.OS === 'web') {
      await playAudioOnWeb(uri);
      return;
    }
    
    if (currentPlayer) {
      currentPlayer.pause();
      currentPlayer.remove();
      currentPlayer = null;
    }
    
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    
    const player = createAudioPlayer({ uri });
    currentPlayer = player;
    console.log('Playing ElevenLabs audio successfully');
    
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
        if (currentPlayer === player) {
          currentPlayer = null;
        }
        if (uri.startsWith(FileSystem.cacheDirectory || '')) {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      }
    });
    
    player.play();
  } catch (error) {
    console.log('Error playing audio file:', error);
    throw error;
  }
};

export const stopAudio = async (): Promise<void> => {
  await Speech.stop();
  
  // Stop web audio if playing
  if (webAudioElement) {
    try {
      webAudioElement.pause();
      webAudioElement.src = '';
      webAudioElement = null;
    } catch (error) {
      console.log('Error stopping web audio:', error);
    }
  }
  
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
      currentPlayer = null;
    } catch (error) {
      console.log('Error stopping audio:', error);
    }
  }
};

const playWithFallbackSpeech = async (
  stylistId: string,
  language: string,
  voiceRange?: string,
  accent?: string,
  userName?: string // Optional: use member's actual name when logged in
): Promise<void> => {
  // Use culturally-authentic scripts for non-English languages
  let text = getVoicePreviewPhrase(stylistId, language, accent, userName);
  if (!text) {
    throw new Error('No preview phrase available');
  }

  await Speech.stop();

  const preferFemale = stylistId === 'ruby' || stylistId === 'ivy';
  const voiceInfo = await findBestVoiceForLanguage(language, preferFemale, accent);
  
  let langCode = LANGUAGE_CODES[language] || 'en-US';
  let voiceId: string | undefined;
  let useEnglishFallback = false;
  
  if (voiceInfo) {
    langCode = voiceInfo.langCode;
    voiceId = voiceInfo.voiceId;
    console.log(`Found ${preferFemale ? 'female' : 'male'} voice for ${language} (${accent || 'default'}): ${voiceId || 'default'} (${langCode})`);
  } else {
    console.log(`No voice found for ${language}, falling back to English`);
    useEnglishFallback = true;
    const englishVoice = await findBestVoiceForLanguage('English', preferFemale, accent);
    if (englishVoice) {
      langCode = englishVoice.langCode;
      voiceId = englishVoice.voiceId;
    } else {
      langCode = 'en-US';
    }
    text = getVoicePreviewPhrase(stylistId, 'English', 'American', userName);
  }
  
  let pitch = 1.0;
  let rate = 0.92;
  
  if (stylistId === 'ruby') {
    pitch = 1.2;
    rate = 0.90;
    if (voiceRange === 'soprano') {
      pitch = 1.8;
      rate = 1.0;
    } else if (voiceRange === 'mezzo-soprano' || voiceRange === 'mezzo') {
      pitch = 1.2;
      rate = 0.88;
    } else if (voiceRange === 'contralto') {
      pitch = 0.7;
      rate = 0.80;
    }
  } else if (stylistId === 'max') {
    pitch = 0.75;
    rate = 0.88;
    if (voiceRange === 'tenor') {
      pitch = 1.1;
      rate = 0.95;
    } else if (voiceRange === 'baritone') {
      pitch = 0.75;
      rate = 0.85;
    } else if (voiceRange === 'bass') {
      pitch = 0.5;
      rate = 0.78;
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
        console.log(`Speech started for ${stylistId} in ${language} (${accent || 'default'}) with voice: ${voiceId || 'system default'}, pitch: ${pitch}, rate: ${rate}`);
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

interface ElevenLabsVoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  speakerBoost: boolean;
}

// Voice selection is handled entirely by the backend (ELEVENLABS_VOICES + NON_ENGLISH_VOICES).
// Do not send client-side voice ID overrides — they previously conflicted with the canonical map.
const ELEVENLABS_ACCENT_VOICES: Record<string, Record<string, string>> = {
  ruby: { 'American': '' },
  max: { 'American': '' },
  ace: { 'American': '' },
  ivy: { 'American': '' },
};

const getElevenLabsVoiceIdForAccent = (_stylistId: string, _accent?: string): string | undefined => {
  return undefined;
};

// Display labels only — backend NON_ENGLISH_VOICES owns the IDs. Keep names in sync with that map.
const NATIVE_VOICE_NAMES: Record<string, Record<string, string>> = {
  ruby: {
    'Standard Spanish': 'Loida Burgos',
    'Standard French': 'Jeanne',
    'Standard German': 'Johanna',
    'Standard Italian': 'Manuela',
    'Standard Portuguese': 'Carla',
    'Standard Japanese': 'Morioki',
    'Standard Korean': 'JiYoung',
    'Standard Mandarin': 'Julia',
    'Modern Standard Arabic': 'Asmaa',
    'Standard Hindi': 'Aaliyah',
    'Standard Dutch': 'Melanie',
    'Standard Russian': 'Victoria',
    'Standard Swedish': 'Sanna',
  },
  max: {
    'Standard Spanish': 'Jorge',
    'Standard French': 'Clément',
    'Standard German': 'Basti',
    'Standard Italian': 'Francesco',
    'Standard Portuguese': 'Márcio',
    'Standard Japanese': 'Junichi',
    'Standard Korean': 'Taemin',
    'Standard Mandarin': 'James Gao',
    'Modern Standard Arabic': 'Anas',
    'Standard Hindi': 'Vayu',
    'Standard Dutch': 'Arjen',
    'Standard Russian': 'Denis',
    'Standard Swedish': 'Tommy Thunstroem',
  },
  ace: {
    'Standard Spanish': 'Dante',
    'Standard French': 'Sébastien',
    'Standard German': 'Oscar Lance',
    'Standard Italian': 'Luca Brasi',
    'Standard Portuguese': 'Rafael Valente',
    'Standard Japanese': 'Makoto',
    'Standard Korean': 'KKC',
    'Standard Mandarin': 'Evan Zhao',
    'Modern Standard Arabic': 'Arabic Knight',
    'Standard Hindi': 'Harsh',
    'Standard Dutch': 'Lucas',
    'Standard Russian': 'Dima PRO',
    'Standard Swedish': 'Mathias',
  },
  ivy: {
    'Standard Spanish': 'Gabriela',
    'Standard French': 'Maina',
    'Standard German': 'Yvonne',
    'Standard Italian': 'Aida',
    'Standard Portuguese': 'Keren',
    'Standard Japanese': 'Konoha',
    'Standard Korean': 'Anna Kim',
    'Standard Mandarin': 'ShanShan',
    'Modern Standard Arabic': 'Abrar Sabbah',
    'Standard Hindi': 'Smriti',
    'Standard Dutch': 'Roos',
    'Standard Russian': 'Olga Orlova',
    'Standard Swedish': 'Elin',
  },
};

const getNativeVoiceNameForId = (stylistId: string, accent?: string): string => {
  if (!accent) return 'default';
  return NATIVE_VOICE_NAMES[stylistId]?.[accent] || accent;
};

const getVoiceSettingsForRange = (_stylistId: string, _voiceRange?: string): ElevenLabsVoiceSettings | undefined => {
  // Let backend apply echo-free ElevenLabs settings (NATURAL_SETTINGS).
  // Client overrides with high similarity/style/speakerBoost caused reverb/AI artifacts.
  return undefined;
};

export const playVoicePreview = async (
  stylistId: string,
  language: string = 'English',
  voiceRange?: string,
  voice?: TTSVoice,
  accent?: string,
  userName?: string // Optional: use member's actual name when logged in
): Promise<void> => {
  await stopAudio();

  const selectedVoice = voice || DEFAULT_VOICE_FOR_STYLIST[stylistId] || 'nova';

  if (!API_URL) {
    console.log('Backend API URL not configured, using device speech synthesis');
    return playWithFallbackSpeech(stylistId, language, voiceRange, accent, userName);
  }

  try {
    if (Platform.OS === 'ios') {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
    }

    console.log(`Calling ElevenLabs TTS for ${stylistId} (${accent || 'default'} accent, ${voiceRange || 'default'} pitch)`);

    const authToken = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const { backendAccent, voiceLibraryAccent } = resolveVoiceLanguageContext(language, accent);
    const elevenLabsVoiceId = getElevenLabsVoiceIdForAccent(stylistId, voiceLibraryAccent);
    
    // Fetch culturally-authentic script from backend (supports all onboarding languages)
    let text: string;
    try {
      const scriptParams = new URLSearchParams({
        stylist: stylistId,
        language,
        accent: backendAccent,
        ...(userName && { userName }),
      });
      const scriptResponse = await fetch(`${API_URL}/api/ai/voice-preview/script?${scriptParams}`, {
        method: 'GET',
        headers,
      });
      
      if (scriptResponse.ok) {
        const scriptData = await scriptResponse.json();
        text = scriptData.script || getVoicePreviewPhrase(stylistId, language, backendAccent, userName) || "Hello, I'm your personal stylist. Let me help you discover your best style!";
        console.log(`Fetched script from backend: ${text.substring(0, 60)}...`);
      } else {
        // Fall back to local script if backend endpoint fails
        text = getVoicePreviewPhrase(stylistId, language, backendAccent, userName) || "Hello, I'm your personal stylist. Let me help you discover your best style!";
        console.log(`Backend script endpoint failed, using local script`);
      }
    } catch (scriptError) {
      // Fall back to local script on error
      text = getVoicePreviewPhrase(stylistId, language, backendAccent, userName) || "Hello, I'm your personal stylist. Let me help you discover your best style!";
      console.log(`Script fetch error, using local script:`, scriptError);
    }
    
    // Log native speaker voice details for debugging
    const nativeVoiceName = elevenLabsVoiceId ? getNativeVoiceNameForId(stylistId, voiceLibraryAccent) : 'default backend voice';
    console.log(`=== VOICE PREVIEW REQUEST ===`);
    console.log(`Stylist: ${stylistId}, Language: ${language}, Backend accent: ${backendAccent}, Voice library: ${voiceLibraryAccent}`);
    console.log(`Native speaker voice: ${nativeVoiceName} (backend selects voice from accent)`);
    console.log(`Text preview: ${text.substring(0, 80)}...`);
    
    // DEBUG: Show user which voice is being requested (remove after debugging)
    if (__DEV__) {
      const debugMsg = `Voice: ${nativeVoiceName}\nLanguage: ${language}\nAccent: ${backendAccent}\nID: ${elevenLabsVoiceId || 'backend default'}`;
      console.log(`DEBUG ALERT: ${debugMsg}`);
    }
    
    const requestBody = {
      text,
      stylist: stylistId,
      voiceRange,
      language,
      accent: backendAccent,
    };
    
    console.log(`FULL REQUEST BODY: ${JSON.stringify(requestBody)}`);
    
    const fullUrl = `${API_URL}/api/ai/voice-preview`;
    console.log(`=== CALLING BACKEND URL: ${fullUrl} ===`);
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`Backend voice preview failed (${response.status}): ${errorText}`);
      return playWithFallbackSpeech(stylistId, language, voiceRange, accent, userName);
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('audio/')) {
      console.log('Received audio stream from ElevenLabs');
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);
      
      // On web, use data URI directly; on native, write to file
      if (Platform.OS === 'web') {
        const mimeType = contentType.includes('mpeg') ? 'audio/mpeg' : 'audio/wav';
        const dataUri = `data:${mimeType};base64,${base64Audio}`;
        await playAudioFile(dataUri);
        return;
      }
      
      const ext = contentType.includes('mpeg') ? 'mp3' : 'wav';
      const fileName = `voice_preview_${Date.now()}.${ext}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await playAudioFile(fileUri);
      return;
    }

    const data = await response.json();
    console.log('ElevenLabs response:', JSON.stringify(data).substring(0, 200));
    
    // Priority 1: Use audioDataUri if available (ready-to-play data URI from backend)
    if (data.audioDataUri) {
      console.log('Playing audio from data URI (optimized path)');
      await playAudioFile(data.audioDataUri);
      return;
    }
    
    let audioData: string | null = null;
    let audioUrl: string | null = null;
    
    if (data.audioBase64) {
      audioData = data.audioBase64;
    } else if (data.audio) {
      audioData = data.audio;
    } else if (data.url) {
      audioUrl = data.url;
    } else if (data.audioUrl) {
      audioUrl = data.audioUrl;
    }
    
    if (audioUrl) {
      console.log('Playing audio from URL:', audioUrl.substring(0, 50));
      await playAudioFile(audioUrl);
      return;
    }
    
    if (audioData) {
      console.log('Playing audio from base64 data');
      
      // On web, use data URI directly; on native, write to file
      if (Platform.OS === 'web') {
        const dataUri = `data:audio/mpeg;base64,${audioData}`;
        await playAudioFile(dataUri);
        return;
      }
      
      const fileName = `voice_preview_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, audioData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await playAudioFile(fileUri);
      return;
    }
    
    console.log('No audio data in response, falling back to device speech');
    return playWithFallbackSpeech(stylistId, language, voiceRange, accent, userName);

  } catch (error) {
    console.log('Voice preview error, falling back to device speech:', error);
    return playWithFallbackSpeech(stylistId, language, voiceRange, accent, userName);
  }
};

export const isPlaying = (): boolean => {
  return currentPlayer !== null;
};

export const getSupportedLanguages = (): string[] => {
  return Object.keys(VOICE_PREVIEW_PHRASES.ruby);
};

export const getVoicePreviewPhrase = (stylistId: string, language: string, accent?: string, userName?: string): string => {
  if (language !== 'English') {
    const culturalScript = getVoicePreviewScript(language, accent || language, stylistId, userName);
    if (culturalScript) {
      return culturalScript;
    }
  }
  
  // Fallback to standard phrases for English or if no cultural script available
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) return '';
  
  // For English, include the user's name if provided
  let phrase = phrases[language] || phrases['English'];
  if (userName && phrase) {
    // Insert name into English greetings
    phrase = phrase.replace(/^(Hey!|Hello!|Hi!)/, `$1 ${userName},`);
  }
  return phrase;
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
