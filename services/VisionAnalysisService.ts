import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ClothingCategory, ClothingColor, ClothingSeason, ClothingOccasion } from '@/contexts/WardrobeContext';

const getOpenAIKey = () => {
  const extra = Constants.expoConfig?.extra;
  return extra?.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
};
const OPENAI_API_KEY = getOpenAIKey();

const Base64Encoding = 'base64' as const;

export interface GarmentAnalysisResult {
  success: boolean;
  category: ClothingCategory;
  color: ClothingColor;
  secondaryColor?: ClothingColor;
  suggestedName: string;
  brand?: string;
  seasons: ClothingSeason[];
  occasions: ClothingOccasion[];
  style: string;
  description: string;
  confidence: number;
  error?: string;
}

const GARMENT_ANALYSIS_PROMPT = `You are a fashion expert analyzing an image of a clothing item or accessory. Analyze this image and identify the garment details.

Provide your analysis in this exact JSON format:
{
  "category": "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "bags" | "accessories" | "activewear_tops" | "activewear_bottoms" | "swimwear" | "sleepwear" | "formal",
  "color": "black" | "white" | "gray" | "navy" | "brown" | "beige" | "red" | "pink" | "orange" | "yellow" | "green" | "blue" | "purple" | "multicolor",
  "secondaryColor": (optional, same options as color),
  "suggestedName": "A descriptive name for this item (e.g., 'Navy Blazer', 'Floral Summer Dress')",
  "brand": (optional, if visible or recognizable),
  "seasons": ["spring", "summer", "autumn", "winter", "all-season"],
  "occasions": ["casual", "work", "formal", "date-night", "workout", "vacation", "party", "everyday"],
  "style": "Description of the style (e.g., 'minimalist', 'bohemian', 'streetwear', 'classic')",
  "description": "Brief description of the item",
  "confidence": 0.0-1.0 (how confident you are in the analysis)
}

Guidelines:
- For category, choose the most appropriate single option
- For color, choose the dominant color. If truly multicolored, use "multicolor"
- For seasons, include all applicable seasons
- For occasions, include all appropriate occasions
- suggestedName should be concise but descriptive
- If you see a screenshot from a website/app, focus on the main garment shown

Respond ONLY with valid JSON, no additional text.`;

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export async function convertImageToBase64(imageUri: string): Promise<string> {
  try {
    if (imageUri.startsWith('data:')) {
      return imageUri.split(',')[1];
    }

    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (fileInfo.exists && 'size' in fileInfo && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image is too large (${Math.round(fileInfo.size / 1024 / 1024)}MB). Please use an image under 10MB.`);
    }

    // On native, always convert to JPEG to handle HEIC/HEIF from iPhone cameras
    // and guarantee OpenAI-compatible format (png/jpeg/gif/webp only)
    let finalUri = imageUri;
    if (Platform.OS !== 'web') {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 800 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = manipResult.uri;
      } catch (manipError) {
        console.log('[Vision] JPEG conversion failed, using original:', manipError);
      }
    }

    const base64 = await FileSystem.readAsStringAsync(finalUri, {
      encoding: Base64Encoding,
    });
    return base64;
  } catch (error: any) {
    console.error('Error converting image to base64:', error);
    if (error.message?.includes('too large')) {
      throw error;
    }
    throw new Error('Failed to process image');
  }
}

export async function analyzeGarmentImage(imageUri: string): Promise<GarmentAnalysisResult> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      category: 'tops',
      color: 'black',
      suggestedName: '',
      seasons: ['all-season'],
      occasions: ['everyday'],
      style: '',
      description: '',
      confidence: 0,
      error: 'AI analysis is not available. Please fill in the details manually.',
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
        model: 'gpt-5.2',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: GARMENT_ANALYSIS_PROMPT },
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
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || 'AI analysis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('Empty response from AI');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);

    const validCategories: ClothingCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'activewear_tops', 'activewear_bottoms', 'swimwear', 'sleepwear', 'formal'];
    const validColors: ClothingColor[] = ['black', 'white', 'gray', 'navy', 'brown', 'beige', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'denim', 'cream', 'multicolor'];
    const validSeasons: ClothingSeason[] = ['spring', 'summer', 'autumn', 'winter', 'all-season'];
    const validOccasions: ClothingOccasion[] = ['casual', 'work', 'formal', 'date-night', 'workout', 'vacation', 'party', 'everyday'];

    return {
      success: true,
      category: validCategories.includes(analysis.category) ? analysis.category : 'tops',
      color: validColors.includes(analysis.color) ? analysis.color : 'black',
      secondaryColor: analysis.secondaryColor && validColors.includes(analysis.secondaryColor) ? analysis.secondaryColor : undefined,
      suggestedName: analysis.suggestedName || 'Fashion Item',
      brand: analysis.brand || undefined,
      seasons: (analysis.seasons || ['all-season']).filter((s: string) => validSeasons.includes(s as ClothingSeason)),
      occasions: (analysis.occasions || ['everyday']).filter((o: string) => validOccasions.includes(o as ClothingOccasion)),
      style: analysis.style || '',
      description: analysis.description || '',
      confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.8,
    };
  } catch (error: any) {
    console.error('Garment analysis error:', error);
    return {
      success: false,
      category: 'tops',
      color: 'black',
      suggestedName: '',
      seasons: ['all-season'],
      occasions: ['everyday'],
      style: '',
      description: '',
      confidence: 0,
      error: error.message || 'Failed to analyze image. Please try again.',
    };
  }
}

export async function analyzeOutfitForStyling(
  imageUri: string,
  userGender: 'male' | 'female' | 'non-binary' = 'female'
): Promise<{
  success: boolean;
  items: Array<{
    type: string;
    color: string;
    description: string;
  }>;
  overallStyle: string;
  occasions: string[];
  suggestions: string[];
  error?: string;
}> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      items: [],
      overallStyle: '',
      occasions: [],
      suggestions: [],
      error: 'AI analysis is not available.',
    };
  }

  try {
    const base64Image = await convertImageToBase64(imageUri);
    
    const prompt = `You are a fashion stylist. Analyze this outfit image and provide styling insights for a ${userGender} person.

Respond in JSON format:
{
  "items": [{"type": "garment type", "color": "color", "description": "brief description"}],
  "overallStyle": "style category (casual, formal, streetwear, etc.)",
  "occasions": ["suitable occasions"],
  "suggestions": ["3-5 styling suggestions or improvements"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
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
          },
        ],
        max_tokens: 600,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);

    return {
      success: true,
      items: analysis.items || [],
      overallStyle: analysis.overallStyle || '',
      occasions: analysis.occasions || [],
      suggestions: analysis.suggestions || [],
    };
  } catch (error: any) {
    return {
      success: false,
      items: [],
      overallStyle: '',
      occasions: [],
      suggestions: [],
      error: error.message || 'Failed to analyze outfit.',
    };
  }
}
