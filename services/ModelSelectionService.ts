/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Model Selection Service - Automatic best AI model selection
 * Handles automatic upgrades to the best available OpenAI models
 */

export type ModelCapability = 'vision' | 'text' | 'reasoning' | 'voice-transcription' | 'voice-synthesis';

interface ModelConfig {
  id: string;
  priority: number;
  capabilities: ModelCapability[];
  maxTokens: number;
  supportsImages: boolean;
}

const VISION_MODELS: ModelConfig[] = [
  { id: 'gpt-5.2', priority: 1, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 256000, supportsImages: true },
  { id: 'gpt-5.1', priority: 2, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 256000, supportsImages: true },
  { id: 'gpt-5', priority: 3, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 256000, supportsImages: true },
  { id: 'gpt-4.5', priority: 4, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4.5-preview', priority: 5, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4.1', priority: 6, capabilities: ['vision', 'text', 'reasoning'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4o', priority: 7, capabilities: ['vision', 'text'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4o-mini', priority: 8, capabilities: ['vision', 'text'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4-turbo', priority: 9, capabilities: ['vision', 'text'], maxTokens: 128000, supportsImages: true },
  { id: 'gpt-4-vision-preview', priority: 10, capabilities: ['vision', 'text'], maxTokens: 128000, supportsImages: true },
];

const TEXT_MODELS: ModelConfig[] = [
  { id: 'gpt-5.2', priority: 1, capabilities: ['text', 'reasoning'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-5.1', priority: 2, capabilities: ['text', 'reasoning'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-5', priority: 3, capabilities: ['text', 'reasoning'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-4.5', priority: 4, capabilities: ['text', 'reasoning'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4.5-preview', priority: 5, capabilities: ['text', 'reasoning'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4.1', priority: 6, capabilities: ['text', 'reasoning'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4o', priority: 7, capabilities: ['text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4-turbo', priority: 8, capabilities: ['text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4', priority: 9, capabilities: ['text'], maxTokens: 8192, supportsImages: false },
  { id: 'gpt-3.5-turbo', priority: 10, capabilities: ['text'], maxTokens: 16385, supportsImages: false },
];

const REASONING_MODELS: ModelConfig[] = [
  { id: 'o4', priority: 1, capabilities: ['reasoning', 'text'], maxTokens: 256000, supportsImages: false },
  { id: 'o3', priority: 2, capabilities: ['reasoning', 'text'], maxTokens: 200000, supportsImages: false },
  { id: 'o1', priority: 3, capabilities: ['reasoning', 'text'], maxTokens: 200000, supportsImages: false },
  { id: 'o1-preview', priority: 4, capabilities: ['reasoning', 'text'], maxTokens: 128000, supportsImages: false },
  { id: 'o1-mini', priority: 5, capabilities: ['reasoning', 'text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-5.2', priority: 6, capabilities: ['reasoning', 'text'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-5.1', priority: 7, capabilities: ['reasoning', 'text'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-5', priority: 8, capabilities: ['reasoning', 'text'], maxTokens: 256000, supportsImages: false },
  { id: 'gpt-4.5', priority: 9, capabilities: ['reasoning', 'text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4.5-preview', priority: 10, capabilities: ['reasoning', 'text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4.1', priority: 11, capabilities: ['reasoning', 'text'], maxTokens: 128000, supportsImages: false },
  { id: 'gpt-4o', priority: 12, capabilities: ['text'], maxTokens: 128000, supportsImages: false },
];

const VOICE_TRANSCRIPTION_MODELS: ModelConfig[] = [
  { id: 'whisper-1', priority: 1, capabilities: ['voice-transcription'], maxTokens: 0, supportsImages: false },
];

const VOICE_SYNTHESIS_MODELS: ModelConfig[] = [
  { id: 'tts-1-hd', priority: 1, capabilities: ['voice-synthesis'], maxTokens: 0, supportsImages: false },
  { id: 'tts-1', priority: 2, capabilities: ['voice-synthesis'], maxTokens: 0, supportsImages: false },
];

interface ModelAvailabilityCache {
  [modelId: string]: {
    available: boolean;
    checkedAt: number;
  };
}

const modelCache: ModelAvailabilityCache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function checkModelAvailability(modelId: string, apiKey: string): Promise<boolean> {
  const cached = modelCache[modelId];
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.available;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const availableModels = data.data?.map((m: { id: string }) => m.id) || [];
    
    const isAvailable = availableModels.includes(modelId);
    modelCache[modelId] = { available: isAvailable, checkedAt: Date.now() };
    
    return isAvailable;
  } catch (error) {
    console.warn(`Failed to check availability for ${modelId}:`, error);
    return false;
  }
}

function getModelsForCapability(capability: ModelCapability): ModelConfig[] {
  switch (capability) {
    case 'vision':
      return VISION_MODELS;
    case 'text':
      return TEXT_MODELS;
    case 'reasoning':
      return REASONING_MODELS;
    case 'voice-transcription':
      return VOICE_TRANSCRIPTION_MODELS;
    case 'voice-synthesis':
      return VOICE_SYNTHESIS_MODELS;
    default:
      return TEXT_MODELS;
  }
}

export async function getBestAvailableModel(
  capability: ModelCapability,
  apiKey: string,
  fallbackModel?: string
): Promise<string> {
  const models = getModelsForCapability(capability);
  
  for (const model of models) {
    const isAvailable = await checkModelAvailability(model.id, apiKey);
    if (isAvailable) {
      console.log(`Selected best ${capability} model: ${model.id}`);
      return model.id;
    }
  }

  const fallback = fallbackModel || models[models.length - 1]?.id || 'gpt-4o';
  console.log(`No preferred models available for ${capability}, using fallback: ${fallback}`);
  return fallback;
}

export function getBestModelSync(capability: ModelCapability): string {
  const models = getModelsForCapability(capability);
  
  for (const model of models) {
    const cached = modelCache[model.id];
    if (cached?.available) {
      return model.id;
    }
  }

  switch (capability) {
    case 'vision':
      return 'gpt-4o';
    case 'text':
      return 'gpt-4o';
    case 'reasoning':
      return 'gpt-4o';
    case 'voice-transcription':
      return 'whisper-1';
    case 'voice-synthesis':
      return 'tts-1-hd';
    default:
      return 'gpt-4o';
  }
}

export async function preloadModelAvailability(apiKey: string): Promise<void> {
  const allModels = [
    ...VISION_MODELS,
    ...TEXT_MODELS,
    ...REASONING_MODELS,
  ];

  const uniqueModels = Array.from(new Set(allModels.map(m => m.id)));
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn('Failed to preload model availability');
      return;
    }

    const data = await response.json();
    const availableModels = new Set(data.data?.map((m: { id: string }) => m.id) || []);
    
    for (const modelId of uniqueModels) {
      modelCache[modelId] = {
        available: availableModels.has(modelId),
        checkedAt: Date.now(),
      };
    }

    console.log('Model availability preloaded successfully');
  } catch (error) {
    console.warn('Failed to preload model availability:', error);
  }
}

export function clearModelCache(): void {
  for (const key of Object.keys(modelCache)) {
    delete modelCache[key];
  }
}

export function getModelInfo(modelId: string): ModelConfig | undefined {
  const allModels = [
    ...VISION_MODELS,
    ...TEXT_MODELS,
    ...REASONING_MODELS,
    ...VOICE_TRANSCRIPTION_MODELS,
    ...VOICE_SYNTHESIS_MODELS,
  ];

  return allModels.find(m => m.id === modelId);
}

export async function makeVisionRequest(
  imageBase64: string,
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ success: boolean; content: string; model: string; error?: string }> {
  const model = await getBestAvailableModel('vision', apiKey);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    return { success: true, content, model };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Vision request failed with ${model}:`, error);
    return { success: false, content: '', model, error: errorMessage };
  }
}

export async function makeTextRequest(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  useReasoning = false
): Promise<{ success: boolean; content: string; model: string; error?: string }> {
  const capability = useReasoning ? 'reasoning' : 'text';
  const model = await getBestAvailableModel(capability, apiKey);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: useReasoning ? 1 : 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    return { success: true, content, model };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Text request failed with ${model}:`, error);
    return { success: false, content: '', model, error: errorMessage };
  }
}
