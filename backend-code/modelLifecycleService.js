const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_REGISTRY = {
  chat: {
    preferenceOrder: [
      'gpt-5.2',
      'gpt-5.2-turbo',
      'gpt-5',
      'gpt-5-preview',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4o-2024-11-20',
      'gpt-3.5-turbo',
    ],
    default: 'gpt-4o',
    capabilities: ['chat', 'function_calling', 'json_mode'],
  },
  reasoning: {
    preferenceOrder: [
      'o1',
      'o3-mini',
      'o1-2024-12-17',
      'o1-preview',
      'o1-mini',
      'gpt-5.2',
      'gpt-5',
      'gpt-4o',
    ],
    default: 'o1',
    capabilities: ['reasoning', 'complex_analysis', 'math', 'coding'],
  },
  vision: {
    preferenceOrder: [
      'gpt-5.2',
      'gpt-5.2-turbo',
      'gpt-5',
      'gpt-5-preview',
      'gpt-4o',
      'gpt-4o-2024-11-20',
      'gpt-4-turbo',
      'gpt-4-vision-preview',
    ],
    default: 'gpt-4o',
    capabilities: ['vision', 'image_analysis'],
  },
  mini: {
    preferenceOrder: [
      'gpt-4o-mini-2024-07-18',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
    default: 'gpt-4o-mini',
    capabilities: ['chat', 'fast', 'cost_effective'],
  },
  embedding: {
    preferenceOrder: [
      'text-embedding-3-large',
      'text-embedding-3-small',
      'text-embedding-ada-002',
    ],
    default: 'text-embedding-3-large',
    capabilities: ['embeddings', 'semantic_search'],
  },
  tts: {
    preferenceOrder: [
      'tts-1-hd',
      'tts-1',
    ],
    default: 'tts-1-hd',
    capabilities: ['speech_synthesis'],
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  },
  stt: {
    preferenceOrder: [
      'whisper-1',
    ],
    default: 'whisper-1',
    capabilities: ['transcription', 'translation'],
  },
  image: {
    preferenceOrder: [
      'dall-e-3',
      'dall-e-2',
    ],
    default: 'dall-e-3',
    capabilities: ['image_generation'],
  },
};

let cachedModels = {};
let modelCacheTimestamp = null;
let availableModelsCache = null;
let availableModelsCacheTimestamp = null;

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;
const AVAILABLE_MODELS_CACHE_MS = 60 * 60 * 1000;

const modelHealthMetrics = {};

async function fetchAvailableModels(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && availableModelsCache && availableModelsCacheTimestamp && 
      now - availableModelsCacheTimestamp < AVAILABLE_MODELS_CACHE_MS) {
    return availableModelsCache;
  }
  
  try {
    const modelsResponse = await openai.models.list();
    const modelData = modelsResponse?.data;
    
    if (!Array.isArray(modelData)) {
      console.log('[ModelLifecycle] Unexpected models response format');
      return availableModelsCache || [];
    }
    
    const availableModelIds = modelData.map((model) => model.id);
    availableModelsCache = availableModelIds;
    availableModelsCacheTimestamp = now;
    
    console.log(`[ModelLifecycle] Fetched ${availableModelIds.length} available models`);
    return availableModelIds;
  } catch (error) {
    console.error('[ModelLifecycle] Failed to fetch models:', error.message);
    return availableModelsCache || [];
  }
}

async function getBestModel(category = 'chat', forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cachedModels[category] && modelCacheTimestamp && 
      now - modelCacheTimestamp < CACHE_DURATION_MS) {
    return cachedModels[category];
  }
  
  const registry = MODEL_REGISTRY[category];
  if (!registry) {
    console.warn(`[ModelLifecycle] Unknown category: ${category}, using 'chat'`);
    return getBestModel('chat', forceRefresh);
  }
  
  const availableModels = await fetchAvailableModels(forceRefresh);
  
  if (availableModels.length === 0) {
    console.log(`[ModelLifecycle] No models available, using default: ${registry.default}`);
    return registry.default;
  }
  
  for (const preferredModel of registry.preferenceOrder) {
    const matchingModel = availableModels.find(
      (modelId) => modelId === preferredModel || modelId.startsWith(preferredModel + '-')
    );
    
    if (matchingModel) {
      cachedModels[category] = matchingModel;
      modelCacheTimestamp = now;
      console.log(`[ModelLifecycle] Selected ${category} model: ${matchingModel}`);
      return matchingModel;
    }
  }
  
  console.log(`[ModelLifecycle] No preferred model found for ${category}, using: ${registry.default}`);
  cachedModels[category] = registry.default;
  return registry.default;
}

async function testModelHealth(modelId, category = 'chat') {
  const startTime = Date.now();
  
  try {
    if (category === 'chat' || category === 'mini') {
      const response = await openai.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "OK" if you can respond.' }],
        max_tokens: 5,
        temperature: 0,
      });
      
      const latency = Date.now() - startTime;
      const success = response.choices?.[0]?.message?.content?.toLowerCase().includes('ok');
      
      return { success, latency, error: null };
    } else if (category === 'tts') {
      return { success: true, latency: 0, error: null };
    } else if (category === 'stt') {
      return { success: true, latency: 0, error: null };
    } else if (category === 'embedding') {
      const response = await openai.embeddings.create({
        model: modelId,
        input: 'test',
      });
      
      const latency = Date.now() - startTime;
      const success = response.data?.[0]?.embedding?.length > 0;
      
      return { success, latency, error: null };
    }
    
    return { success: true, latency: 0, error: null };
  } catch (error) {
    return { 
      success: false, 
      latency: Date.now() - startTime, 
      error: error.message 
    };
  }
}

async function performHealthCheck() {
  console.log('[ModelLifecycle] Running health check...');
  const results = {};
  
  for (const category of Object.keys(MODEL_REGISTRY)) {
    const model = await getBestModel(category);
    const health = await testModelHealth(model, category);
    
    results[category] = {
      model,
      ...health,
      checkedAt: new Date().toISOString(),
    };
    
    modelHealthMetrics[category] = results[category];
  }
  
  console.log('[ModelLifecycle] Health check complete:', results);
  return results;
}

async function refreshAllModels() {
  console.log('[ModelLifecycle] Refreshing all models...');
  
  cachedModels = {};
  modelCacheTimestamp = null;
  
  await fetchAvailableModels(true);
  
  const results = {};
  for (const category of Object.keys(MODEL_REGISTRY)) {
    results[category] = await getBestModel(category, true);
  }
  
  console.log('[ModelLifecycle] Model refresh complete:', results);
  return results;
}

async function checkForNewModels() {
  console.log('[ModelLifecycle] Checking for new models...');
  
  const oldModels = { ...cachedModels };
  await refreshAllModels();
  
  const upgrades = [];
  for (const category of Object.keys(MODEL_REGISTRY)) {
    if (oldModels[category] && cachedModels[category] !== oldModels[category]) {
      upgrades.push({
        category,
        previousModel: oldModels[category],
        newModel: cachedModels[category],
        upgradedAt: new Date().toISOString(),
      });
      console.log(`[ModelLifecycle] UPGRADE: ${category} from ${oldModels[category]} to ${cachedModels[category]}`);
    }
  }
  
  return { upgrades, currentModels: cachedModels };
}

function getModelStatus() {
  return {
    cachedModels,
    cacheAge: modelCacheTimestamp ? Date.now() - modelCacheTimestamp : null,
    availableModelsCount: availableModelsCache?.length || 0,
    healthMetrics: modelHealthMetrics,
    registry: MODEL_REGISTRY,
  };
}

function getVoiceOptions() {
  return MODEL_REGISTRY.tts.voices;
}

module.exports = {
  getBestModel,
  fetchAvailableModels,
  testModelHealth,
  performHealthCheck,
  refreshAllModels,
  checkForNewModels,
  getModelStatus,
  getVoiceOptions,
  MODEL_REGISTRY,
};
