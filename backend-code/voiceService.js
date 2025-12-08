const OpenAI = require('openai');
const { getBestModel, getVoiceOptions } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STYLIST_VOICES = {
  ruby: 'nova',
  max: 'onyx',
};

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

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  getVoiceForStylist,
  getAllVoices,
  processVoiceMessage,
  createVoiceResponse,
  STYLIST_VOICES,
  VOICE_DESCRIPTIONS,
};
