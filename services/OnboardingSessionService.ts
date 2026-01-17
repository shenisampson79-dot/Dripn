import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { apiService } from "./ApiService";

const DEVICE_ID_KEY = "dripn_device_id";
const SESSION_KEY = "dripn_onboarding_session";

interface OnboardingSession {
  sessionId: string;
  deviceId: string;
  currentStep: string;
  completedSteps: string[];
  selectedPath?: string;
  selectedSetup?: string;
  createdAt: string;
  updatedAt: string;
}

class OnboardingSessionService {
  private deviceId: string | null = null;
  private session: OnboardingSession | null = null;

  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    try {
      let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!storedId) {
        storedId = `${Device.modelName || "device"}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
      }
      this.deviceId = storedId;
      return storedId;
    } catch (error) {
      const fallbackId = `fallback-${Date.now()}`;
      this.deviceId = fallbackId;
      return fallbackId;
    }
  }

  async createOrResumeSession(): Promise<OnboardingSession | null> {
    try {
      const deviceId = await this.getDeviceId();
      const data = await apiService.post<OnboardingSession>("/api/onboarding/session", { device_id: deviceId });
      if (data) {
        this.session = data;
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
      }
      return data;
    } catch (error) {
      console.log("Failed to create/resume session, using local");
      return this.getLocalSession();
    }
  }

  async getSession(): Promise<OnboardingSession | null> {
    try {
      const deviceId = await this.getDeviceId();
      const data = await apiService.get<OnboardingSession>(`/api/onboarding/session/${deviceId}`);
      if (data) {
        this.session = data;
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
      }
      return data;
    } catch (error) {
      return this.getLocalSession();
    }
  }

  private async getLocalSession(): Promise<OnboardingSession | null> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        this.session = JSON.parse(stored);
        return this.session;
      }
    } catch (error) {
      console.log("Failed to get local session");
    }
    return null;
  }

  async selectPath(pathId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      await apiService.post("/api/onboarding/select-path", { 
        device_id: deviceId,
        path: pathId 
      });
    } catch (error) {
      console.log("Failed to track path selection");
    }
  }

  async selectSetup(setupId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      await apiService.post("/api/onboarding/select-setup", { 
        device_id: deviceId,
        setup: setupId 
      });
    } catch (error) {
      console.log("Failed to track setup selection");
    }
  }

  async completeStep(stepName: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      await apiService.post("/api/onboarding/complete-step", { 
        device_id: deviceId,
        step: stepName 
      });
    } catch (error) {
      console.log("Failed to mark step complete");
    }
  }
}

export const onboardingSessionService = new OnboardingSessionService();
