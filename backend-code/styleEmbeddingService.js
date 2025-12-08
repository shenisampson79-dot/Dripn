const OpenAI = require('openai');
const { getBestModel } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const styleEmbeddingsCache = new Map();
const CACHE_MAX_SIZE = 1000;

async function generateEmbedding(text, options = {}) {
  const { 
    dimensions = 1536,
    cacheKey = null,
  } = options;

  if (cacheKey && styleEmbeddingsCache.has(cacheKey)) {
    return {
      success: true,
      embedding: styleEmbeddingsCache.get(cacheKey),
      cached: true,
    };
  }

  try {
    const embeddingModel = await getBestModel('embedding');
    console.log(`[StyleEmbedding] Using model: ${embeddingModel}`);

    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text,
      dimensions: embeddingModel.includes('3-large') ? Math.min(dimensions, 3072) : undefined,
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned');
    }

    if (cacheKey) {
      if (styleEmbeddingsCache.size >= CACHE_MAX_SIZE) {
        const firstKey = styleEmbeddingsCache.keys().next().value;
        styleEmbeddingsCache.delete(firstKey);
      }
      styleEmbeddingsCache.set(cacheKey, embedding);
    }

    return {
      success: true,
      embedding,
      dimensions: embedding.length,
      modelUsed: embeddingModel,
      cached: false,
    };
  } catch (error) {
    console.error('[StyleEmbedding] Error:', error.message);
    return {
      success: false,
      error: error.message,
      embedding: null,
    };
  }
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must be same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function findSimilarStyles(queryText, styleDatabase, options = {}) {
  const {
    topK = 5,
    minSimilarity = 0.7,
  } = options;

  const queryResult = await generateEmbedding(queryText);
  
  if (!queryResult.success) {
    return {
      success: false,
      error: queryResult.error,
    };
  }

  const results = styleDatabase
    .filter(item => item.embedding && item.embedding.length === queryResult.embedding.length)
    .map(item => ({
      ...item,
      similarity: cosineSimilarity(queryResult.embedding, item.embedding),
    }))
    .filter(item => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return {
    success: true,
    matches: results,
    queryEmbeddingDimensions: queryResult.embedding.length,
  };
}

async function createStyleDescription(outfit) {
  const parts = [];

  if (outfit.name) parts.push(outfit.name);
  if (outfit.category) parts.push(outfit.category);
  if (outfit.color) parts.push(`${outfit.color} colored`);
  if (outfit.style) parts.push(`${outfit.style} style`);
  if (outfit.occasions && outfit.occasions.length > 0) {
    parts.push(`suitable for ${outfit.occasions.join(', ')}`);
  }
  if (outfit.seasons && outfit.seasons.length > 0) {
    parts.push(`best for ${outfit.seasons.join(', ')}`);
  }
  if (outfit.brand) parts.push(`by ${outfit.brand}`);
  if (outfit.material) parts.push(`made of ${outfit.material}`);
  if (outfit.tags && outfit.tags.length > 0) {
    parts.push(outfit.tags.join(', '));
  }

  return parts.join('. ');
}

async function buildOutfitIndex(outfits) {
  const indexedOutfits = [];

  for (const outfit of outfits) {
    const description = await createStyleDescription(outfit);
    const cacheKey = `outfit_${outfit.id || outfit.name}`;
    
    const embeddingResult = await generateEmbedding(description, { cacheKey });
    
    if (embeddingResult.success) {
      indexedOutfits.push({
        ...outfit,
        description,
        embedding: embeddingResult.embedding,
        indexedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`[StyleEmbedding] Indexed ${indexedOutfits.length}/${outfits.length} outfits`);

  return {
    success: true,
    indexedCount: indexedOutfits.length,
    outfits: indexedOutfits,
  };
}

async function semanticStyleSearch(query, wardrobeItems, options = {}) {
  if (!wardrobeItems || wardrobeItems.length === 0) {
    return {
      success: false,
      error: 'No wardrobe items to search',
      matches: [],
    };
  }

  const itemsWithDescriptions = await Promise.all(
    wardrobeItems.map(async (item) => {
      const description = await createStyleDescription(item);
      return { ...item, description };
    })
  );

  const indexedItems = [];
  for (const item of itemsWithDescriptions) {
    const cacheKey = `item_${item.id || item.name}_${item.color}`;
    const result = await generateEmbedding(item.description, { cacheKey });
    if (result.success) {
      indexedItems.push({
        ...item,
        embedding: result.embedding,
      });
    }
  }

  const searchResults = await findSimilarStyles(query, indexedItems, options);
  
  return searchResults;
}

async function findComplementaryPieces(wardrobeItem, wardrobeItems, options = {}) {
  const {
    topK = 5,
    excludeSameCategory = true,
  } = options;

  const itemDescription = await createStyleDescription(wardrobeItem);
  const complementQuery = `Items that pair well with: ${itemDescription}. Looking for complementary colors, matching style, and coordinated look.`;

  let searchItems = wardrobeItems;
  if (excludeSameCategory) {
    searchItems = wardrobeItems.filter(item => item.category !== wardrobeItem.category);
  }

  return semanticStyleSearch(complementQuery, searchItems, { topK });
}

async function getStyleRecommendations(userPreferences, trendingStyles = []) {
  const preferenceText = `User style preferences: ${JSON.stringify(userPreferences)}`;
  const trendingText = trendingStyles.length > 0 
    ? `Current trends: ${trendingStyles.map(s => s.name || s).join(', ')}`
    : '';

  const queryText = `${preferenceText}. ${trendingText}. Find styles that match these preferences and trends.`;

  return generateEmbedding(queryText, { cacheKey: `preferences_${Date.now()}` });
}

function clearEmbeddingCache() {
  styleEmbeddingsCache.clear();
  console.log('[StyleEmbedding] Cache cleared');
}

function getCacheStats() {
  return {
    size: styleEmbeddingsCache.size,
    maxSize: CACHE_MAX_SIZE,
  };
}

module.exports = {
  generateEmbedding,
  findSimilarStyles,
  createStyleDescription,
  buildOutfitIndex,
  semanticStyleSearch,
  findComplementaryPieces,
  getStyleRecommendations,
  cosineSimilarity,
  clearEmbeddingCache,
  getCacheStats,
};
