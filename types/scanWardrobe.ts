import type { ClothingCategory } from '@/contexts/WardrobeContext';

export type ScanSceneType = 'flat_lay' | 'hanging' | 'drawer' | 'worn' | 'other';

export type ScanSessionItem = {
  tempId: string;
  name: string;
  category: ClothingCategory | string;
  subcategory?: string | null;
  color: string;
  brand?: string | null;
  formality?: number;
  confidence: number;
  bbox?: [number, number, number, number] | null;
  sourceImageId?: string | null;
  classified?: {
    subtype?: string | null;
    lane?: string | null;
    formality?: number | null;
    confidence?: number | null;
  };
  needsConfirm: boolean;
  confirmPrompt?: string | null;
  needsReview?: boolean;
  wardrobeConfidence?: number;
  reconciliationFlags?: Array<{ code: string; message: string; suggestion?: string }>;
  seasons?: string[];
  occasions?: string[];
};

export type ScanWardrobeResponse = {
  success: boolean;
  sessionId: string;
  sceneType: ScanSceneType | string;
  itemCount: number;
  items: ScanSessionItem[];
  persisted: false;
  autoSaved: false;
  message?: string;
};

export type ScanWardrobeStep = 'capture' | 'scanning' | 'confirm' | 'outfit' | 'looks' | 'save';

export type ScanOutfitOption = {
  id: string;
  label?: string;
  vibeLabel?: string;
  stylistMessage?: string | null;
  outfit?: {
    items: Array<{
      id: string;
      name: string;
      category: string;
      color?: string;
      imageUrl?: string | null;
      stylingNote?: string;
    }>;
  };
  hydratedItems?: Array<{
    id: string;
    name: string;
    category: string;
    color?: string;
    imageUrl?: string | null;
  }>;
};
