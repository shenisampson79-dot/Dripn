/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import { apiService } from './ApiService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://0ff35e7b-c52b-436f-bc3a-caa12ac9e07a-00-ladpqjdev6jc.spock.replit.dev';

export interface VirtualTryOnRequest {
  humanImageUri: string;
  garmentImageUrl: string;
  garmentDescription: string;
}

export interface VirtualTryOnResponse {
  success: boolean;
  resultImageUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface TryOnUsage {
  used: number;
  limit: number;
  remaining: number;
}

class VirtualTryOnService {
  private async getToken(): Promise<string | null> {
    return apiService.getToken();
  }

  async generateTryOn(
    request: VirtualTryOnRequest
  ): Promise<VirtualTryOnResponse> {
    try {
      if (!API_URL) {
        return {
          success: false,
          error: 'Backend API not configured',
        };
      }

      const token = await this.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/virtual-try-on`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          humanImageUri: request.humanImageUri,
          garmentImageUrl: request.garmentImageUrl,
          garmentDescription: request.garmentDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to generate try-on image',
        };
      }

      return {
        success: true,
        resultImageUrl: data.resultImageUrl,
        processingTimeMs: data.processingTimeMs,
      };
    } catch (error) {
      console.error('Virtual try-on error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async checkUsage(): Promise<TryOnUsage | null> {
    try {
      if (!API_URL) {
        return null;
      }

      const token = await this.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/virtual-try-on/usage`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to check try-on usage:', error);
      return null;
    }
  }
}

export const virtualTryOnService = new VirtualTryOnService();
export default virtualTryOnService;
