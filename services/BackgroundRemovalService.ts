import { apiService } from './ApiService';

export async function removeBackgroundFromBase64(imageBase64: string): Promise<string | null> {
  try {
    const result = await apiService.removeBackground(imageBase64);
    return result?.imageUrl || null;
  } catch (error) {
    console.log('[BackgroundRemoval] Failed:', (error as Error).message);
    return null;
  }
}
