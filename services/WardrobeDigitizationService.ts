import * as FileSystem from 'expo-file-system/legacy';
import { ClothingCategory, ClothingColor, ClothingSeason, ClothingOccasion } from '@/contexts/WardrobeContext';
import { convertImageToBase64 } from './VisionAnalysisService';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

export interface EnhancedImageResult {
  success: boolean;
  enhancedImageUri?: string;
  originalImageUri: string;
  improvements: string[];
  error?: string;
}

export interface DetectedGarment {
  boundingBox?: { x: number; y: number; width: number; height: number };
  category: ClothingCategory;
  color: ClothingColor;
  suggestedName: string;
  brand?: string;
  seasons: ClothingSeason[];
  occasions: ClothingOccasion[];
  confidence: number;
  description: string;
}

export interface BulkScanResult {
  success: boolean;
  detectedItems: DetectedGarment[];
  totalItemsFound: number;
  processingTime: number;
  error?: string;
}

export interface ProductLinkResult {
  success: boolean;
  productName?: string;
  brand?: string;
  price?: number;
  currency?: string;
  originalPrice?: number;
  imageUrl?: string;
  productUrl?: string;
  description?: string;
  category?: ClothingCategory;
  color?: ClothingColor;
  size?: string;
  material?: string;
  retailer?: string;
  inStock?: boolean;
  error?: string;
}

export interface PhotoTips {
  category: 'general' | 'tops' | 'bottoms' | 'shoes' | 'bags' | 'accessories' | 'belts';
  tips: string[];
  doList: string[];
  dontList: string[];
}

const BULK_SCAN_PROMPT = `You are a fashion expert analyzing an image that may contain MULTIPLE clothing items or accessories laid out together for wardrobe digitization.

IMPORTANT: Detect and identify EACH SEPARATE clothing item visible in the image. Users often photograph multiple items at once to speed up digitization.

For each item detected, provide:
{
  "items": [
    {
      "category": "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "bags" | "accessories" | "activewear" | "swimwear" | "sleepwear" | "formal",
      "color": "black" | "white" | "gray" | "navy" | "brown" | "beige" | "red" | "pink" | "orange" | "yellow" | "green" | "blue" | "purple" | "multicolor",
      "suggestedName": "Descriptive name for this specific item",
      "brand": (optional, if visible),
      "seasons": ["spring", "summer", "autumn", "winter", "all-season"],
      "occasions": ["casual", "work", "formal", "date-night", "workout", "vacation", "party", "everyday"],
      "description": "Brief description",
      "confidence": 0.0-1.0
    }
  ],
  "totalItemsFound": number
}

Guidelines:
- Count and identify EACH visible garment separately
- If items are layered or stacked, identify each visible piece
- Focus on distinct, separate clothing items
- Ignore mannequins, hangers, or background elements
- If only one item is visible, return just that item

Respond ONLY with valid JSON.`;

const IMAGE_ENHANCEMENT_PROMPT = `Analyze this clothing item photo for quality issues and suggest specific improvements:

1. Background Issues: Is the background cluttered? Should it be removed/replaced with white?
2. Lighting: Is it too dark, overexposed, or has shadows?
3. Positioning: Is the item properly laid out, straight, and fully visible?
4. Focus: Is the image sharp or blurry?
5. Framing: Is the item filling the frame appropriately?

Respond in JSON:
{
  "issues": ["list of detected issues"],
  "improvements": ["specific improvement recommendations"],
  "qualityScore": 0.0-1.0,
  "needsEnhancement": true/false,
  "enhancementPriority": ["ordered list of most important enhancements"]
}`;

const PRODUCT_EXTRACTION_PROMPT = `You are extracting product information from a shared text, URL, or screenshot of a product page.

Extract all available product details:
{
  "productName": "Full product name",
  "brand": "Brand name",
  "price": number (price in numeric format),
  "currency": "USD" | "GBP" | "EUR" | etc.,
  "originalPrice": number (if on sale, original price),
  "description": "Product description",
  "category": "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "bags" | "accessories" | "activewear" | "swimwear" | "sleepwear" | "formal",
  "color": "black" | "white" | "gray" | "navy" | "brown" | "beige" | "red" | "pink" | "orange" | "yellow" | "green" | "blue" | "purple" | "multicolor",
  "size": "size if mentioned",
  "material": "material/fabric if mentioned",
  "retailer": "Store/retailer name",
  "inStock": true/false
}

Guidelines:
- Extract as much information as available
- Normalize price to numeric value (e.g., "$129.99" -> 129.99)
- Identify the retailer from the URL or page content
- If information is not available, omit that field

Respond ONLY with valid JSON.`;

export async function analyzeImageQuality(imageUri: string): Promise<{
  qualityScore: number;
  issues: string[];
  improvements: string[];
  needsEnhancement: boolean;
}> {
  if (!OPENAI_API_KEY) {
    return {
      qualityScore: 0.7,
      issues: [],
      improvements: [],
      needsEnhancement: false,
    };
  }

  try {
    const base64Image = await convertImageToBase64(imageUri);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: IMAGE_ENHANCEMENT_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('Quality analysis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);

    return {
      qualityScore: analysis.qualityScore || 0.7,
      issues: analysis.issues || [],
      improvements: analysis.improvements || [],
      needsEnhancement: analysis.needsEnhancement || false,
    };
  } catch (error) {
    console.error('Image quality analysis error:', error);
    return {
      qualityScore: 0.7,
      issues: [],
      improvements: [],
      needsEnhancement: false,
    };
  }
}

export async function scanBulkItems(imageUri: string): Promise<BulkScanResult> {
  const startTime = Date.now();
  
  const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear', 'swimwear', 'sleepwear', 'formal'];
  const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor'];
  const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
  const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];

  try {
    const base64Image = await convertImageToBase64(imageUri);
    
    const { apiService } = await import('./ApiService');
    
    let result: any;
    try {
      result = await apiService.analyzeGarmentPhoto(base64Image, { detailed: true });
      console.log('[BulkScan] API response:', JSON.stringify(result).substring(0, 200));
    } catch (apiError: any) {
      console.log('[BulkScan] API call failed:', apiError.message);
      result = null;
    }
    
    // Handle multiple response formats from the API
    const data = result?.analysis?.item || result?.analysis || result;
    
    if (data && (data.category || data.garmentType || data.color || data.primaryColor)) {
      // Map garmentType to category if needed
      const categoryMap: Record<string, ClothingCategory> = {
        'shirt': 'tops', 'blouse': 'tops', 'sweater': 'tops', 't-shirt': 'tops', 'top': 'tops',
        'pants': 'bottoms', 'jeans': 'bottoms', 'trousers': 'bottoms', 'shorts': 'bottoms', 'skirt': 'bottoms',
        'dress': 'dresses', 'gown': 'dresses', 'jumpsuit': 'dresses',
        'jacket': 'outerwear', 'coat': 'outerwear', 'blazer': 'outerwear', 'cardigan': 'outerwear',
        'shoes': 'shoes', 'boots': 'shoes', 'sneakers': 'shoes', 'heels': 'shoes', 'sandals': 'shoes',
        'bag': 'bags', 'handbag': 'bags', 'purse': 'bags', 'backpack': 'bags',
        'accessory': 'accessories', 'hat': 'accessories', 'scarf': 'accessories', 'belt': 'accessories',
      };
      
      // Map color names to valid colors
      const colorMap: Record<string, ClothingColor> = {
        'navy': 'navy', 'navy blue': 'navy', 'dark blue': 'navy',
        'white': 'white', 'off-white': 'white', 'cream': 'beige',
        'black': 'black', 'charcoal': 'gray', 'grey': 'gray', 'gray': 'gray',
        'brown': 'brown', 'tan': 'beige', 'beige': 'beige', 'camel': 'beige',
        'red': 'red', 'burgundy': 'red', 'maroon': 'red',
        'blue': 'blue', 'light blue': 'blue', 'sky blue': 'blue',
        'green': 'green', 'olive': 'green', 'khaki': 'beige',
        'pink': 'pink', 'rose': 'pink',
        'purple': 'purple', 'violet': 'purple',
        'orange': 'orange',
        'yellow': 'yellow',
        'multi': 'multicolor', 'multicolor': 'multicolor', 'patterned': 'multicolor',
      };
      
      // Safely extract category - handle string or object
      const extractString = (val: any): string => {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object' && val.name) return val.name;
        if (val && typeof val === 'object' && val.value) return val.value;
        return '';
      };
      
      const rawCategory = extractString(data.category || data.garmentType).toLowerCase() || 'tops';
      const rawColor = extractString(data.color || data.primaryColor || data.colorFull).toLowerCase() || 'black';
      
      const mappedCategory = categoryMap[rawCategory] || 
        (validCategories.includes(rawCategory as ClothingCategory) ? rawCategory as ClothingCategory : 'tops');
      const mappedColor = colorMap[rawColor] || 
        (validColors.includes(rawColor as ClothingColor) ? rawColor as ClothingColor : 'black');
      
      // Generate a descriptive name
      const colorDisplay = rawColor ? rawColor.charAt(0).toUpperCase() + rawColor.slice(1) : 'Item';
      const typeValue = extractString(data.garmentType || data.category) || mappedCategory;
      const typeDisplay = typeValue.charAt(0).toUpperCase() + typeValue.slice(1);
      const suggestedName = data.suggestedName || data.name || `${colorDisplay} ${typeDisplay}`;
      
      const item: DetectedGarment = {
        category: mappedCategory,
        color: mappedColor,
        suggestedName: suggestedName,
        brand: data.brand || undefined,
        seasons: (data.seasons || ['all-season']).filter((s: string) => 
          validSeasons.includes(s as ClothingSeason)
        ) as ClothingSeason[],
        occasions: (data.occasions || ['everyday']).filter((o: string) => 
          validOccasions.includes(o as ClothingOccasion)
        ) as ClothingOccasion[],
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.85,
        description: data.description || data.material || '',
      };
      
      console.log('[BulkScan] Detected item:', item.suggestedName, item.category, item.color);
      
      return {
        success: true,
        detectedItems: [item],
        totalItemsFound: 1,
        processingTime: Date.now() - startTime,
      };
    }
    
    // If backend fails, create a generic item that user can edit
    console.log('[BulkScan] No valid data found, creating placeholder item');
    const placeholderItem: DetectedGarment = {
      category: 'tops',
      color: 'black',
      suggestedName: 'New Item (tap to edit)',
      brand: undefined,
      seasons: ['all-season'],
      occasions: ['everyday'],
      confidence: 0.5,
      description: 'AI analysis unavailable. Please edit details manually.',
    };
    
    return {
      success: true,
      detectedItems: [placeholderItem],
      totalItemsFound: 1,
      processingTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('Bulk scan error:', error);
    return {
      success: false,
      detectedItems: [],
      totalItemsFound: 0,
      processingTime: Date.now() - startTime,
      error: error.message || 'Failed to scan items.',
    };
  }
}

export async function extractProductFromText(text: string): Promise<ProductLinkResult> {
  const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear', 'swimwear', 'sleepwear', 'formal'];
  const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor'];

  try {
    const { apiService } = await import('./ApiService');
    const result = await apiService.extractFromUrl(text);
    
    if (result.success && result.item) {
      return {
        success: true,
        productName: result.item.name,
        brand: result.item.brand,
        price: result.item.price,
        currency: 'GBP',
        imageUrl: result.item.imageUri,
        productUrl: result.item.sourceUrl,
        category: validCategories.includes(result.item.category as ClothingCategory) ? result.item.category as ClothingCategory : undefined,
        color: validColors.includes(result.item.color as ClothingColor) ? result.item.color as ClothingColor : undefined,
        retailer: new URL(text).hostname.replace('www.', ''),
      };
    }
  } catch (error: any) {
    console.log('Backend extraction failed, trying local fallback:', error.message);
  }

  try {
    const localResult = await extractProductFromUrlLocally(text, validCategories, validColors);
    if (localResult.success) return localResult;
  } catch (error: any) {
    console.error('Local extraction also failed:', error.message);
  }

  return {
    success: false,
    error: 'Could not extract product information from this URL. Try copying the full product page content instead.',
  };
}

async function extractProductFromUrlLocally(
  url: string,
  validCategories: ClothingCategory[],
  validColors: ClothingColor[]
): Promise<ProductLinkResult> {
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not available');
  }

  const prompt = `Analyze this shopping URL and extract product information. URL: ${url}

Return ONLY a JSON object with these fields:
{
  "name": "product name",
  "brand": "brand name or null",
  "price": number or null,
  "category": one of [${validCategories.join(', ')}],
  "color": one of [${validColors.join(', ')}]
}

If you cannot determine a field, use null. For category and color, only use the exact values from the lists provided.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  if (!parsed.name) throw new Error('Could not extract product name');

  return {
    success: true,
    productName: parsed.name,
    brand: parsed.brand || undefined,
    price: parsed.price || undefined,
    currency: 'GBP',
    productUrl: url,
    category: validCategories.includes(parsed.category) ? parsed.category : undefined,
    color: validColors.includes(parsed.color) ? parsed.color : undefined,
    retailer: new URL(url).hostname.replace('www.', ''),
  };
}

export async function extractProductFromImage(imageUri: string): Promise<ProductLinkResult> {
  const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear', 'swimwear', 'sleepwear', 'formal'];
  const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'multicolor'];
  
  const base64Image = await convertImageToBase64(imageUri);

  try {
    const { apiService } = await import('./ApiService');
    const result = await apiService.extractFromScreenshot(base64Image);
    
    if (result.success && result.item) {
      return {
        success: true,
        productName: result.item.name,
        brand: result.item.brand,
        price: result.item.price,
        currency: 'GBP',
        imageUrl: result.item.imageUri,
        category: validCategories.includes(result.item.category as ClothingCategory) ? result.item.category as ClothingCategory : undefined,
        color: validColors.includes(result.item.color as ClothingColor) ? result.item.color as ClothingColor : undefined,
        retailer: result.item.retailer,
      };
    }
  } catch (error: any) {
    console.log('Backend screenshot extraction failed, trying local fallback:', error.message);
  }

  try {
    const localResult = await extractProductFromImageLocally(base64Image, validCategories, validColors);
    if (localResult.success) return localResult;
  } catch (error: any) {
    console.error('Local image extraction also failed:', error.message);
  }

  return {
    success: false,
    error: 'Could not extract product information from this screenshot. Try taking a clearer photo of the item.',
  };
}

async function extractProductFromImageLocally(
  base64Image: string,
  validCategories: ClothingCategory[],
  validColors: ClothingColor[]
): Promise<ProductLinkResult> {
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not available');
  }

  const prompt = `Analyze this screenshot of a clothing product from a shopping website or app. Extract the product details.

Return ONLY a JSON object with these fields:
{
  "name": "product name",
  "brand": "brand name or null",
  "price": number or null,
  "category": one of [${validCategories.join(', ')}],
  "color": one of [${validColors.join(', ')}],
  "retailer": "store name if visible, or null"
}

If you cannot determine a field, use null. For category and color, only use the exact values from the lists provided.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'low',
            },
          },
        ],
      }],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  if (!parsed.name) throw new Error('Could not extract product name from image');

  return {
    success: true,
    productName: parsed.name,
    brand: parsed.brand || undefined,
    price: parsed.price || undefined,
    currency: 'GBP',
    category: validCategories.includes(parsed.category) ? parsed.category : undefined,
    color: validColors.includes(parsed.color) ? parsed.color : undefined,
    retailer: parsed.retailer || undefined,
  };
}

export function getPhotoTips(category?: ClothingCategory): PhotoTips {
  const generalTips: PhotoTips = {
    category: 'general',
    tips: [
      'Use natural daylight for best results',
      'Place item on a clean, plain background',
      'Make sure the entire item is visible in frame',
      'Avoid shadows falling on the garment',
      'Keep the camera parallel to the item',
    ],
    doList: [
      'Lay items flat on a white or neutral surface',
      'Smooth out wrinkles before photographing',
      'Fill the frame with the item',
      'Use good, even lighting',
      'Take multiple photos for the best shot',
    ],
    dontList: [
      'Photograph in dim lighting',
      'Cut off parts of the garment',
      'Leave wrinkles or folds',
      'Include cluttered backgrounds',
      'Use flash directly on reflective materials',
    ],
  };

  const categoryTips: Record<string, PhotoTips> = {
    tops: {
      category: 'tops',
      tips: [
        'Button all buttons for a clean look',
        'Lay with shoulders straight and even',
        'Fold sleeves neatly to show length',
      ],
      doList: [
        'Straight, even shoulders',
        'Button buttons and zip zippers',
        'Show collar shape clearly',
      ],
      dontList: [
        'Uneven shoulders',
        'Leave buttons open',
        'Hide the neckline',
      ],
    },
    bottoms: {
      category: 'bottoms',
      tips: [
        'Zip zippers and button waistbands',
        'Fold or position to show true length',
        'Keep legs parallel and straight',
      ],
      doList: [
        'Zip zippers closed',
        'Show waistband clearly',
        'Keep legs straight and parallel',
      ],
      dontList: [
        'Leave zippers open',
        'Bunch up the fabric',
        'Hide the waistband',
      ],
    },
    shoes: {
      category: 'shoes',
      tips: [
        'Photograph from the side for best profile',
        'Show both shoes if you want to display a pair',
        'Clean shoes before photographing',
      ],
      doList: [
        'Shoot from the side',
        'Show the heel height clearly',
        'Clean before photographing',
      ],
      dontList: [
        'Shoot from directly above',
        'Shoot at an angle',
        'Leave scuffs visible',
      ],
    },
    bags: {
      category: 'bags',
      tips: [
        'Fill the frame with the bag',
        'Show the front face clearly',
        'Include straps/handles in frame',
      ],
      doList: [
        'Fill the frame',
        'Show hardware and closures',
        'Include straps in shot',
      ],
      dontList: [
        'Cut off bits of the bag',
        'Zoom out too far',
        'Hide straps or handles',
      ],
    },
    accessories: {
      category: 'accessories',
      tips: [
        'Use close-up shots for small items',
        'Show details like clasps and patterns',
        'Group similar items together',
      ],
      doList: [
        'Get close for detail',
        'Show clasps and closures',
        'Use contrasting background',
      ],
      dontList: [
        'Photograph from too far away',
        'Use busy backgrounds',
        'Mix too many items in one shot',
      ],
    },
    belts: {
      category: 'belts',
      tips: [
        'Buckle the belt and curve it naturally',
        'Photograph from the side to show buckle',
        'Avoid stretching flat',
      ],
      doList: [
        'Buckle and curve naturally',
        'Shoot from the side',
        'Show the buckle detail',
      ],
      dontList: [
        'Stretch belt out flat',
        'Shoot from directly above',
        'Hide the buckle',
      ],
    },
  };

  if (category && categoryTips[category]) {
    return {
      ...categoryTips[category],
      tips: [...categoryTips[category].tips, ...generalTips.tips.slice(0, 2)],
    };
  }

  return generalTips;
}

export async function processBatchImages(imageUris: string[]): Promise<{
  success: boolean;
  results: Array<{
    imageUri: string;
    items: DetectedGarment[];
    error?: string;
  }>;
  totalItemsFound: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  const results: Array<{
    imageUri: string;
    items: DetectedGarment[];
    error?: string;
  }> = [];
  let totalItemsFound = 0;

  for (const imageUri of imageUris) {
    try {
      const scanResult = await scanBulkItems(imageUri);
      if (scanResult.success) {
        results.push({
          imageUri,
          items: scanResult.detectedItems,
        });
        totalItemsFound += scanResult.detectedItems.length;
      } else {
        results.push({
          imageUri,
          items: [],
          error: scanResult.error,
        });
      }
    } catch (error: any) {
      results.push({
        imageUri,
        items: [],
        error: error.message || 'Failed to process image',
      });
    }
  }

  return {
    success: results.some(r => r.items.length > 0),
    results,
    totalItemsFound,
    processingTime: Date.now() - startTime,
  };
}

export function parseRetailerFromUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    const retailers: Record<string, string> = {
      'zara.com': 'Zara',
      'hm.com': 'H&M',
      'asos.com': 'ASOS',
      'nordstrom.com': 'Nordstrom',
      'net-a-porter.com': 'Net-a-Porter',
      'farfetch.com': 'Farfetch',
      'ssense.com': 'SSENSE',
      'matchesfashion.com': 'Matches Fashion',
      'mytheresa.com': 'Mytheresa',
      'revolve.com': 'Revolve',
      'shopbop.com': 'Shopbop',
      'bloomingdales.com': 'Bloomingdale\'s',
      'saksfifthavenue.com': 'Saks Fifth Avenue',
      'neimanmarcus.com': 'Neiman Marcus',
      'macys.com': 'Macy\'s',
      'uniqlo.com': 'Uniqlo',
      'cos.com': 'COS',
      'arket.com': 'ARKET',
      'stories.com': '& Other Stories',
      'mango.com': 'Mango',
      'urbanoutfitters.com': 'Urban Outfitters',
      'anthropologie.com': 'Anthropologie',
      'freepeople.com': 'Free People',
      'nike.com': 'Nike',
      'adidas.com': 'Adidas',
      'lululemon.com': 'Lululemon',
      'gap.com': 'Gap',
      'bananarepublic.com': 'Banana Republic',
      'jcrew.com': 'J.Crew',
      'everlane.com': 'Everlane',
      'thereformation.com': 'Reformation',
      'sezane.com': 'Sezane',
      'rouje.com': 'Rouje',
      'amazon.com': 'Amazon',
      'target.com': 'Target',
      'walmart.com': 'Walmart',
      'prettylittlething.com': 'PrettyLittleThing',
      'boohoo.com': 'Boohoo',
      'missguided.com': 'Missguided',
      'shein.com': 'Shein',
      'fashionnova.com': 'Fashion Nova',
      'selfridges.com': 'Selfridges',
      'harrods.com': 'Harrods',
      'johnlewis.com': 'John Lewis',
      'next.co.uk': 'Next',
      'riverisland.com': 'River Island',
      'topshop.com': 'Topshop',
      'marksandspencer.com': 'M&S',
    };

    for (const [domain, name] of Object.entries(retailers)) {
      if (hostname.includes(domain.replace('.com', '').replace('.co.uk', ''))) {
        return name;
      }
    }

    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }

    return undefined;
  } catch {
    return undefined;
  }
}
