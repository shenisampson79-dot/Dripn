import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiService from './ApiService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'event_reminder' | 'style_of_the_day' | 'trend_alert' | 'personalized_offer';
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  outfitSuggestion?: string;
  title?: string;
  description?: string;
  trendName?: string;
  trendCategory?: string;
  category?: string;
  item?: string;
}

export interface NotificationPreferences {
  eventReminders: boolean;
  styleOfTheDay: boolean;
  trendAlerts: boolean;
  personalizedOffers: boolean;
  weeklyDigest: boolean;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private onNotificationReceived: ((notification: Notifications.Notification) => void) | null = null;
  private onNotificationResponse: ((response: Notifications.NotificationResponse) => void) | null = null;

  async initialize(
    onReceived?: (notification: Notifications.Notification) => void,
    onResponse?: (response: Notifications.NotificationResponse) => void
  ): Promise<string | null> {
    this.onNotificationReceived = onReceived || null;
    this.onNotificationResponse = onResponse || null;

    if (Platform.OS === 'web') {
      console.log('Push notifications are not supported on web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      const token = await this.registerForPushNotifications();
      this.setupNotificationListeners();
      return token;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return null;
    }
  }

  private async registerForPushNotifications(): Promise<string | null> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission for push notifications not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('events', {
        name: 'Event Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('trends', {
        name: 'Trend Alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Personalized Offers',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      this.expoPushToken = tokenData.data;
      return this.expoPushToken;
    } catch (error) {
      console.error('Failed to get Expo push token:', error);
      return null;
    }
  }

  private setupNotificationListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }

    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      if (this.onNotificationReceived) {
        this.onNotificationReceived(notification);
      }
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      if (this.onNotificationResponse) {
        this.onNotificationResponse(response);
      }
    });
  }

  async registerTokenWithBackend(): Promise<boolean> {
    if (!this.expoPushToken) {
      console.log('No push token available to register');
      return false;
    }

    try {
      await apiService.registerPushToken(this.expoPushToken, Platform.OS);
      console.log('Push token registered with backend');
      return true;
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
      return false;
    }
  }

  async unregisterTokenFromBackend(): Promise<boolean> {
    if (!this.expoPushToken) {
      return true;
    }

    try {
      await apiService.unregisterPushToken(this.expoPushToken);
      console.log('Push token unregistered from backend');
      return true;
    } catch (error) {
      console.error('Failed to unregister push token from backend:', error);
      return false;
    }
  }

  async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    try {
      return await apiService.getNotificationPreferences();
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return null;
    }
  }

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      await apiService.updateNotificationPreferences(preferences);
      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  async checkPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (Platform.OS === 'web') {
      return 'denied';
    }

    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    triggerSeconds?: number
  ): Promise<string | null> {
    try {
      const notificationData: Record<string, unknown> = data ? { ...data } : {};
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: notificationData,
          sound: 'default',
        },
        trigger: triggerSeconds ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds } : null,
      });
      return identifier;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      return null;
    }
  }

  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  parseNotificationData(notification: Notifications.Notification): NotificationData | null {
    const rawData = notification.request.content.data;
    if (!rawData || typeof rawData !== 'object') {
      return null;
    }
    const data = rawData as Record<string, unknown>;
    if (!data.type || typeof data.type !== 'string') {
      return null;
    }
    return data as unknown as NotificationData;
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
