import { AudioModule, AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number;
}

const VOICE_PREVIEW_PHRASES: Record<string, Record<string, string>> = {
  ruby: {
    English: "Hi there! I'm Ruby, your personal stylist. I'm warm, encouraging, and I love helping you discover your best style. Let me guide your fashion journey!",
    French: "Bonjour! Je suis Ruby, votre styliste personnelle. Je suis chaleureuse, encourageante, et j'adore vous aider à découvrir votre meilleur style. Laissez-moi guider votre voyage mode!",
    Spanish: "¡Hola! Soy Ruby, tu estilista personal. Soy cálida, alentadora, y me encanta ayudarte a descubrir tu mejor estilo. ¡Déjame guiar tu viaje de moda!",
    German: "Hallo! Ich bin Ruby, deine persönliche Stylistin. Ich bin warmherzig, ermutigend, und ich liebe es, dir zu helfen, deinen besten Stil zu entdecken. Lass mich deine Modereise begleiten!",
    Italian: "Ciao! Sono Ruby, la tua stilista personale. Sono calorosa, incoraggiante, e adoro aiutarti a scoprire il tuo stile migliore. Lasciami guidare il tuo viaggio nella moda!",
    Portuguese: "Olá! Sou Ruby, sua estilista pessoal. Sou calorosa, encorajadora, e adoro ajudá-la a descobrir seu melhor estilo. Deixe-me guiar sua jornada na moda!",
    Japanese: "こんにちは!私はルビー、あなたのパーソナルスタイリストです。温かく、励ましながら、あなたの最高のスタイルを見つけるお手伝いをします。ファッションの旅をご案内させてください!",
    Korean: "안녕하세요! 저는 루비, 당신의 개인 스타일리스트입니다. 따뜻하고 격려하며, 최고의 스타일을 찾도록 도와드리는 것을 좋아해요. 패션 여정을 안내해 드릴게요!",
    Chinese: "你好!我是Ruby,你的私人造型师。我热情、鼓励,喜欢帮助你发现最好的风格。让我来引导你的时尚之旅!",
    Arabic: "مرحبا! أنا روبي، مصممة الأزياء الشخصية الخاصة بك. أنا دافئة ومشجعة، وأحب مساعدتك في اكتشاف أفضل أسلوب لك. دعني أرشدك في رحلتك الأزياء!",
    Hindi: "नमस्ते! मैं रूबी हूं, आपकी पर्सनल स्टाइलिस्ट। मैं गर्मजोश, प्रोत्साहित करने वाली हूं, और मुझे आपको अपना सबसे अच्छा स्टाइल खोजने में मदद करना बहुत पसंद है। मुझे आपकी फैशन यात्रा का मार्गदर्शन करने दीजिए!",
    Russian: "Привет! Я Руби, ваш личный стилист. Я теплая, ободряющая, и я люблю помогать вам открыть свой лучший стиль. Позвольте мне направить ваше модное путешествие!",
    Dutch: "Hallo! Ik ben Ruby, jouw persoonlijke stylist. Ik ben warm, bemoedigend, en ik hou ervan je te helpen jouw beste stijl te ontdekken. Laat me je mode-reis begeleiden!",
    Swedish: "Hej! Jag är Ruby, din personliga stylist. Jag är varm, uppmuntrande, och jag älskar att hjälpa dig upptäcka din bästa stil. Låt mig guida din modresa!",
    Polish: "Cześć! Jestem Ruby, twoja osobista stylistka. Jestem ciepła, zachęcająca, i uwielbiam pomagać ci odkryć swój najlepszy styl. Pozwól mi poprowadzić twoją modową podróż!",
    Turkish: "Merhaba! Ben Ruby, kişisel stilistiniz. Sıcak, cesaretlendirici biriyim ve en iyi tarzınızı keşfetmenize yardımcı olmayı seviyorum. Moda yolculuğunuzda size rehberlik etmeme izin verin!",
  },
  max: {
    English: "Hey! I'm Max, your go-to guy for style. I keep it real and help you look effortlessly cool. Ready to level up your wardrobe?",
    French: "Salut! Je suis Max, ton expert style. Je reste authentique et je t'aide à avoir l'air cool sans effort. Prêt à améliorer ta garde-robe?",
    Spanish: "¡Hey! Soy Max, tu experto en estilo. Soy auténtico y te ayudo a verte genial sin esfuerzo. ¿Listo para mejorar tu guardarropa?",
    German: "Hey! Ich bin Max, dein Stil-Experte. Ich bleibe authentisch und helfe dir, mühelos cool auszusehen. Bereit, deine Garderobe aufzuwerten?",
    Italian: "Ehi! Sono Max, il tuo esperto di stile. Resto autentico e ti aiuto a sembrare cool senza sforzo. Pronto a migliorare il tuo guardaroba?",
    Portuguese: "E aí! Sou Max, seu especialista em estilo. Sou autêntico e ajudo você a parecer descolado sem esforço. Pronto para melhorar seu guarda-roupa?",
    Japanese: "やあ!僕はマックス、あなたのスタイル担当だよ。本物志向で、楽にカッコよく見えるようサポートするよ。ワードローブをレベルアップする準備はできてる?",
    Korean: "안녕! 나는 맥스, 너의 스타일 전문가야. 진정성 있게, 힘들이지 않고 멋져 보이게 도와줄게. 옷장을 업그레이드할 준비됐어?",
    Chinese: "嘿!我是Max,你的时尚专家。我保持真实,帮你轻松展现酷感。准备好升级你的衣橱了吗?",
    Arabic: "مرحبا! أنا ماكس، خبير الأناقة الخاص بك. أبقى صادقا وأساعدك على الظهور بمظهر رائع بسهولة. هل أنت مستعد لتحسين خزانة ملابسك؟",
    Hindi: "हे! मैं मैक्स हूं, तुम्हारा स्टाइल एक्सपर्ट। मैं असली रहता हूं और तुम्हें बिना मेहनत के कूल दिखने में मदद करता हूं। अपनी वॉर्डरोब को अपग्रेड करने के लिए तैयार हो?",
    Russian: "Привет! Я Макс, твой эксперт по стилю. Я остаюсь настоящим и помогу тебе выглядеть круто без усилий. Готов прокачать свой гардероб?",
    Dutch: "Hey! Ik ben Max, jouw stijlexpert. Ik blijf echt en help je moeiteloos cool te ogen. Klaar om je garderobe te upgraden?",
    Swedish: "Hej! Jag är Max, din stilexpert. Jag håller det äkta och hjälper dig se cool ut utan ansträngning. Redo att uppgradera din garderob?",
    Polish: "Hej! Jestem Max, twój ekspert od stylu. Jestem autentyczny i pomagam ci wyglądać na wyluzowanego bez wysiłku. Gotowy podnieść poziom swojej garderoby?",
    Turkish: "Selam! Ben Max, senin stil uzmanın. Gerçekçi kalıyorum ve zahmetsizce havalı görünmene yardımcı oluyorum. Gardırobunu yükseltmeye hazır mısın?",
  },
};

const STYLIST_VOICES: Record<string, TTSVoice> = {
  ruby: 'shimmer',
  max: 'onyx',
};

const RUBY_VOICE_SPEEDS: Record<string, number> = {
  'soprano': 1.05,
  'mezzo-soprano': 0.95,
  'contralto': 0.88,
};

const MAX_VOICE_SPEEDS: Record<string, number> = {
  'tenor': 1.1,
  'baritone': 1.0,
  'bass': 0.9,
};

const getSpeedForVoice = (stylistId: string, voicePitch?: string): number => {
  if (stylistId === 'max') {
    return MAX_VOICE_SPEEDS[voicePitch || 'baritone'] || 1.0;
  }
  return RUBY_VOICE_SPEEDS[voicePitch || 'contralto'] || 0.88;
};

let currentPlayer: AudioPlayer | null = null;

const getOpenAIApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  const extra = Constants.expoConfig?.extra;
  if (extra?.OPENAI_API_KEY) {
    return extra.OPENAI_API_KEY;
  }
  
  return '';
};

export const stopAudio = async (): Promise<void> => {
  if (currentPlayer) {
    try {
      await currentPlayer.remove();
      currentPlayer = null;
    } catch (error) {
      console.log('Error stopping audio:', error);
    }
  }
};

export const generateAndPlayTTS = async (
  text: string,
  options: TTSOptions = {}
): Promise<void> => {
  const {
    voice = 'shimmer',
    model = 'tts-1-hd',
    speed = 0.88,
  } = options;

  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    console.error('OpenAI API key not found');
    throw new Error('OpenAI API key not configured');
  }

  await stopAudio();

  try {
    if (Platform.OS === 'ios') {
      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
      });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', response.status, errorText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = arrayBufferToBase64(arrayBuffer);
    
    const fileName = `tts_${Date.now()}.mp3`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    
    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
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
    console.error('TTS generation error:', error);
    throw error;
  }
};

export const playVoicePreview = async (
  stylistId: string,
  language: string = 'English',
  voicePitch?: string
): Promise<void> => {
  const phrases = VOICE_PREVIEW_PHRASES[stylistId];
  if (!phrases) {
    console.error('Unknown stylist ID:', stylistId);
    return;
  }

  const phrase = phrases[language] || phrases['English'];
  const voice = STYLIST_VOICES[stylistId] || 'shimmer';
  const speed = getSpeedForVoice(stylistId, voicePitch);

  await generateAndPlayTTS(phrase, {
    voice,
    model: 'tts-1-hd',
    speed,
  });
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
  generateAndPlayTTS,
  playVoicePreview,
  stopAudio,
  isPlaying,
  getSupportedLanguages,
  getVoicePreviewPhrase,
};
