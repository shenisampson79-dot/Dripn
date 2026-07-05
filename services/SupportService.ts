import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gender } from '@/contexts/AuthContext';
import { getStylistForUser, PersonalStylist } from './PersonalStylistService';
import { apiService } from './ApiService';

const SUPPORT_CHAT_KEY = '@dripn_support_chat';
const SUPPORT_TICKETS_KEY = '@dripn_support_tickets';

export type TicketCategory = 
  | 'subscription'
  | 'account'
  | 'app-issue'
  | 'feature-request'
  | 'billing'
  | 'styling'
  | 'other';

export interface SupportTicket {
  id: string;
  category: TicketCategory;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}

export interface SupportMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isTicketCreation?: boolean;
}

export const TICKET_CATEGORIES: { id: TicketCategory; label: string; icon: string }[] = [
  { id: 'subscription', label: 'Subscription & Plans', icon: 'credit-card' },
  { id: 'account', label: 'Account Issues', icon: 'user' },
  { id: 'app-issue', label: 'App Problems', icon: 'alert-circle' },
  { id: 'billing', label: 'Billing & Payments', icon: 'dollar-sign' },
  { id: 'styling', label: 'Styling Features', icon: 'heart' },
  { id: 'feature-request', label: 'Feature Requests', icon: 'lightbulb' },
  { id: 'other', label: 'Other', icon: 'help-circle' },
];

export const QUICK_TROUBLESHOOTING: { id: string; label: string; response: string }[] = [
  {
    id: 'app-slow',
    label: 'App is running slow',
    response: "I understand the app feels slow. Here are some quick fixes:\n\n1. Close and reopen the app\n2. Check your internet connection\n3. Clear the app cache in your phone's settings\n4. Make sure you have the latest app version\n\nIf it's still slow after trying these, tap the ticket icon in the bottom-left corner to create a support ticket.",
  },
  {
    id: 'login-issues',
    label: 'Cannot log in',
    response: "Having trouble logging in? Let's fix that:\n\n1. Double-check your email address for typos\n2. Try resetting your password using 'Forgot Password'\n3. Make sure Caps Lock is off when entering your password\n4. Check if you signed up with Apple/Google instead\n\nStill having issues? Tap the ticket icon in the bottom-left corner to reach our support team.",
  },
  {
    id: 'subscription-not-working',
    label: 'Subscription features not working',
    response: "Let's get your subscription features working:\n\n1. Log out and log back in to refresh your account\n2. Check if your payment went through in your app store\n3. Restore purchases in your account settings\n4. Give it a few minutes - sometimes there's a short delay\n\nIf features are still locked, tap the ticket icon in the bottom-left corner for priority support.",
  },
  {
    id: 'photos-not-uploading',
    label: 'Photos not uploading',
    response: "Let's fix your photo uploads:\n\n1. Check if you've allowed Dripn to access your photos\n2. Make sure you have a stable internet connection\n3. Try uploading a smaller photo first\n4. Close other apps to free up memory\n\nNeed more help? Tap the ticket icon in the bottom-left corner to reach our team.",
  },
  {
    id: 'notifications-not-working',
    label: 'Not receiving notifications',
    response: "To get your notifications working:\n\n1. Go to your phone's Settings and find Dripn\n2. Make sure notifications are enabled\n3. Check that 'Do Not Disturb' is off\n4. In the app, check notification settings under Profile > Settings\n\nStill not working? Tap the ticket icon in the bottom-left corner to get help from our team.",
  },
];


function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

class SupportService {
  private chatHistory: SupportMessage[] = [];
  private stylist: PersonalStylist | null = null;

  async initialize(userGender?: Gender): Promise<void> {
    this.stylist = getStylistForUser(userGender || 'woman');
    await this.loadChatHistory();
  }

  getStylist(): PersonalStylist | null {
    return this.stylist;
  }

  private async loadChatHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SUPPORT_CHAT_KEY);
      if (stored) {
        this.chatHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading support chat history:', error);
    }
  }

  private async saveChatHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(SUPPORT_CHAT_KEY, JSON.stringify(this.chatHistory));
    } catch (error) {
      console.error('Error saving support chat history:', error);
    }
  }

  getChatHistory(): SupportMessage[] {
    return this.chatHistory;
  }

  async clearChatHistory(): Promise<void> {
    this.chatHistory = [];
    await AsyncStorage.removeItem(SUPPORT_CHAT_KEY);
  }

  getWelcomeMessage(): SupportMessage {
    const greeting = "Hello! I'm Julia, your Dripn support assistant. Whether you have questions about the app, need help with your account, or just want some guidance, I'm here for you. What can I help you with today?";

    return {
      id: generateId(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    };
  }

  async sendMessage(
    userMessage: string,
    options?: { fromQuickAction?: boolean },
  ): Promise<SupportMessage> {
    const userMsg: SupportMessage = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    this.chatHistory.push(userMsg);

    // Only use canned troubleshooting when the user tapped a quick-action chip
    // (exact label). Fuzzy matching on first words caused false hits — e.g.
    // "refer the app" matched "App is running slow" because both contain "app".
    const troubleshootingMatch = options?.fromQuickAction
      ? QUICK_TROUBLESHOOTING.find(t => t.label === userMessage)
      : undefined;

    let responseContent: string;

    if (troubleshootingMatch) {
      responseContent = troubleshootingMatch.response;
    } else {
      responseContent = await this.getAIResponse(userMessage);
    }

    const assistantMsg: SupportMessage = {
      id: generateId(),
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString(),
    };
    this.chatHistory.push(assistantMsg);
    await this.saveChatHistory();

    return assistantMsg;
  }

  private async getAIResponse(userMessage: string): Promise<string> {
    try {
      if (!apiService.isConfigured()) {
        return this.getMockResponse(userMessage);
      }

      const chatHistory = this.chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const result = await apiService.sendSupportMessage({
        message: userMessage,
        chatHistory,
        stylistName: 'Julia',
        stylistPersonality: 'julia',
      });

      return result.response;
    } catch (error) {
      console.error('Support API error:', error);
      return this.getMockResponse(userMessage);
    }
  }

  private getMockResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    const signOff = 'Happy to help!';

    if (
      lowerMessage.includes('referral') ||
      lowerMessage.includes('refer a friend') ||
      lowerMessage.includes('refer the app') ||
      (lowerMessage.includes('refer') && lowerMessage.includes('friend'))
    ) {
      return `Great question about referrals! Share your personal code from Settings > Invite Friends.\n\nWhen a friend joins with your code:\n- You earn bonus AI styling requests\n- You get a 10% discount on your subscription\n- Your friend gets +20 styling requests and a 10% welcome discount\n\nTap the gift icon in Settings to share your code. ${signOff}`;
    }

    if (lowerMessage.includes('subscription') || lowerMessage.includes('plan') || lowerMessage.includes('upgrade')) {
      return `Dripn has three tiers:\n\n- **Free**: Try the stylist — limited daily decisions and wardrobe items\n- **Personal Stylist** (~$9.99/mo): Unlimited daily decisions, more wardrobe space, AI chat, voice comments\n- **Stylist Unlimited** (~$19.99/mo): Everything unlimited — outfit calendar, event planning, priority support\n\nSee current pricing in Settings > Subscription. ${signOff}`;
    }

    if (lowerMessage.includes('stylist') || lowerMessage.includes('video call')) {
      return `Premium members get exclusive access to real-life stylist video sessions! That's 4 one-hour sessions per month with professional fashion stylists.\n\nTo access this, you'll need to upgrade to Premium tier. Once subscribed, you can book sessions from your Profile screen. ${signOff}`;
    }

    if (lowerMessage.includes('wardrobe') || lowerMessage.includes('closet')) {
      return `Your digital wardrobe is where you can store photos of your clothes! Here's how to use it:\n\n1. Go to your Profile\n2. Tap "My Wardrobe"\n3. Add items by taking photos or selecting from gallery\n4. The AI stylist can then suggest outfits from your actual clothes!\n\n${signOff}`;
    }

    if (lowerMessage.includes('refund') || lowerMessage.includes('cancel subscription')) {
      return `I understand you have questions about refunds or cancellation. For billing matters, I'll need to connect you with our support team who can look into your specific account.\n\nWould you like me to create a support ticket for this? Just say "create ticket" and I'll help you fill in the details.`;
    }

    if (lowerMessage.includes('ticket') || lowerMessage.includes('support team')) {
      return `I can help you create a support ticket that goes directly to our team! Just tell me:\n\n1. What category best describes your issue?\n2. A brief description of the problem\n\nOr tap one of the quick options below to get started.`;
    }

    return `Thanks for reaching out! I'm here to help with anything Dripn-related. You can ask me about:\n\n- App features and how to use them\n- Subscription plans and upgrades\n- Troubleshooting common issues\n- Creating a support ticket\n\nWhat would you like to know? ${signOff}`;
  }

  async createSupportTicket(
    category: TicketCategory,
    description: string,
    userInfo?: { id?: string; email?: string; name?: string }
  ): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      id: generateId(),
      category,
      description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: userInfo?.id,
      userEmail: userInfo?.email,
      userName: userInfo?.name,
    };

    let backendTicketId: string | null = null;

    try {
      if (apiService.isConfigured()) {
        const result = await apiService.createSupportTicket({
          category,
          description,
          userName: userInfo?.name,
          userEmail: userInfo?.email,
        });
        backendTicketId = result.ticketId;
        ticket.id = result.ticketId;
      }
    } catch (error) {
      console.error('Failed to create ticket on backend, saving locally:', error);
    }

    try {
      const stored = await AsyncStorage.getItem(SUPPORT_TICKETS_KEY);
      const tickets: SupportTicket[] = stored ? JSON.parse(stored) : [];
      tickets.push(ticket);
      await AsyncStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(tickets));
    } catch (error) {
      console.error('Error saving support ticket locally:', error);
    }

    const ticketRef = backendTicketId || ticket.id.slice(-6).toUpperCase();
    const confirmationMsg: SupportMessage = {
      id: generateId(),
      role: 'assistant',
      content: `Your support ticket has been created successfully!\n\n**Ticket #${ticketRef.slice(-6).toUpperCase()}**\nCategory: ${TICKET_CATEGORIES.find(c => c.id === category)?.label}\n\nOur support team will review your request and get back to you within 24-48 hours. You'll receive updates via email.\n\nIs there anything else I can help you with?`,
      timestamp: new Date().toISOString(),
      isTicketCreation: true,
    };
    this.chatHistory.push(confirmationMsg);
    await this.saveChatHistory();

    return ticket;
  }

  async getTickets(): Promise<SupportTicket[]> {
    try {
      const stored = await AsyncStorage.getItem(SUPPORT_TICKETS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading support tickets:', error);
      return [];
    }
  }
}

export const supportService = new SupportService();
export default supportService;
