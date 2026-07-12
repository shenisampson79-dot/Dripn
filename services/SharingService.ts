/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import { Share, Platform } from "react-native";
import * as StoreReview from "expo-store-review";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post } from "@/contexts/PostsContext";
import { currencyService } from "@/services/CurrencyService";

const DRIPN_BRANDING = {
  tagline: "Style that flows - Get personalized fashion advice from AI and real people",
  downloadCTA: "Download Dripn free",
  /** Public web host (Vercel). Not dripn.app — that domain is unrelated IONOS hosting. */
  appStoreUrl: "https://dripnapp.com",
  deepLinkScheme: "dripn://",
};

export const WATERMARK_CONFIG = {
  iconPath: require("../assets/images/dripn-logo-gold-exact-cream.png"),
  smallIconSize: 40,
  mediumIconSize: 60,
  largeIconSize: 80,
  opacity: 0.9,
  position: "bottom-right" as const,
  padding: 16,
};

const REVIEW_PROMPT_STORAGE_KEY = "@dripn_review_prompt";
const SHARE_COUNT_STORAGE_KEY = "@dripn_share_count";

const TRENDING_HASHTAGS = [
  "#Dripn",
  "#OOTD",
  "#FashionAdvice",
  "#StyleCheck",
  "#OutfitInspo",
  "#WhatToWear",
  "#FashionCommunity",
  "#GetDressed",
];

const OCCASION_HASHTAGS: Record<string, string[]> = {
  casual: ["#CasualStyle", "#EverydayFashion", "#CasualChic", "#RelaxedFit"],
  formal: ["#FormalWear", "#DressUp", "#Elegance", "#SophisticatedStyle"],
  work: ["#WorkWear", "#OfficeStyle", "#BusinessCasual", "#PowerDressing"],
  date: ["#DateNight", "#DateOutfit", "#RomanticStyle", "#DressToImpress"],
  event: ["#EventReady", "#PartyLook", "#SpecialOccasion", "#GlamorousStyle"],
  wedding: ["#WeddingGuest", "#WeddingAttire", "#CelebrationStyle"],
  vacation: ["#VacationMode", "#TravelStyle", "#HolidayOutfit"],
  interview: ["#InterviewReady", "#ProfessionalStyle", "#CareerFashion"],
};

const STYLE_HASHTAGS: Record<string, string[]> = {
  luxury: ["#LuxuryFashion", "#HighFashion", "#DesignerStyle", "#LuxeLife"],
  streetwear: ["#Streetwear", "#UrbanStyle", "#StreetFashion", "#HypeBeast"],
  boho: ["#BohoStyle", "#BohemianFashion", "#FreeSpirit", "#Boho"],
  sporty: ["#AthleisureStyle", "#SportyChic", "#FitFashion", "#ActiveWear"],
  romantic: ["#RomanticStyle", "#FeminineStyle", "#SoftGlam", "#DreamyStyle"],
  edgy: ["#EdgyFashion", "#AlternativeStyle", "#Grunge", "#DarkAesthetic"],
};

interface ShareableContent {
  title: string;
  message: string;
  url: string;
}

export function generateHashtags(
  description: string,
  occasion?: string,
  stylePreference?: string,
  maxTags: number = 8
): string[] {
  const tags: Set<string> = new Set();
  
  tags.add("#Dripn");
  
  if (occasion && OCCASION_HASHTAGS[occasion]) {
    OCCASION_HASHTAGS[occasion].slice(0, 2).forEach(tag => tags.add(tag));
  }
  
  if (stylePreference && STYLE_HASHTAGS[stylePreference]) {
    STYLE_HASHTAGS[stylePreference].slice(0, 2).forEach(tag => tags.add(tag));
  }
  
  const descWords = description.toLowerCase().split(/\s+/);
  const fashionKeywords = [
    "outfit", "dress", "style", "look", "wear", "fashion",
    "casual", "formal", "elegant", "chic", "trendy", "vintage",
    "summer", "winter", "spring", "fall", "autumn"
  ];
  
  descWords.forEach(word => {
    if (fashionKeywords.includes(word.replace(/[^a-z]/g, ""))) {
      const hashtag = `#${word.charAt(0).toUpperCase()}${word.slice(1)}Fashion`;
      if (tags.size < maxTags) {
        tags.add(hashtag);
      }
    }
  });
  
  while (tags.size < maxTags) {
    const randomTag = TRENDING_HASHTAGS[Math.floor(Math.random() * TRENDING_HASHTAGS.length)];
    if (!tags.has(randomTag)) {
      tags.add(randomTag);
    }
    if (tags.size >= TRENDING_HASHTAGS.length) break;
  }
  
  return Array.from(tags).slice(0, maxTags);
}

export function generateShareContent(post: Post): ShareableContent {
  const hashtags = generateHashtags(
    post.description,
    undefined,
    undefined,
    5
  );
  
  const hashtagsStr = hashtags.join(" ");
  
  const deepLink = `dripn://post/${post.id}`;
  const webUrl = `https://dripnapp.com/post/${post.id}`;
  
  let title = "Check out this outfit on Dripn";
  
  if (post.type === "comparison") {
    title = "Help me decide which outfit to wear";
  }
  
  const message = `${title}\n\n"${post.description.slice(0, 100)}${post.description.length > 100 ? "..." : ""}"\n\n${hashtagsStr}\n\n`;
  
  return {
    title,
    message,
    url: webUrl,
  };
}

export async function sharePost(post: Post): Promise<boolean> {
  try {
    const { title, message, url } = generateShareContent(post);
    
    const result = await Share.share({
      title,
      message: message + url,
      url: Platform.OS === "ios" ? url : undefined,
    });
    
    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error sharing post:", error);
    return false;
  }
}

export async function shareChallenge(
  challengeName: string,
  challengeDescription: string
): Promise<boolean> {
  try {
    const hashtag = `#Dripn${challengeName.replace(/\s+/g, "")}`;
    const message = `Join the "${challengeName}" challenge on Dripn!\n\n${challengeDescription}\n\n${hashtag} #Dripn #FashionChallenge\n\nhttps://dripnapp.com/challenges`;
    
    const result = await Share.share({
      title: `Dripn Challenge: ${challengeName}`,
      message,
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("Error sharing challenge:", error);
    return false;
  }
}

export async function shareReferralCode(code: string, bonusInfo: string): Promise<boolean> {
  try {
    const message = `Get fashion advice from real people and AI on Dripn!\n\nUse my referral code: ${code}\n${bonusInfo}\n\nDownload now: https://dripnapp.com/invite/${code}`;
    
    const result = await Share.share({
      title: "Join Dripn",
      message,
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("Error sharing referral code:", error);
    return false;
  }
}

export async function shareStyleOfDay(
  description: string,
  advice: string
): Promise<boolean> {
  try {
    const message = `Today's Style Pick on Dripn:\n\n"${description}"\n\nAI Tip: ${advice.slice(0, 150)}...\n\n#StyleOfTheDay #Dripn #AIFashion\n\nhttps://dripnapp.com/style-of-the-day`;
    
    const result = await Share.share({
      title: "Dripn Style of the Day",
      message,
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("Error sharing style of day:", error);
    return false;
  }
}

interface ReviewPromptData {
  lastPromptedAt: string | null;
  shareCount: number;
  voteCount: number;
  postCount: number;
  hasReviewed: boolean;
}

async function getReviewPromptData(): Promise<ReviewPromptData> {
  try {
    const data = await AsyncStorage.getItem(REVIEW_PROMPT_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error getting review prompt data:", error);
  }
  return {
    lastPromptedAt: null,
    shareCount: 0,
    voteCount: 0,
    postCount: 0,
    hasReviewed: false,
  };
}

async function saveReviewPromptData(data: ReviewPromptData): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_PROMPT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving review prompt data:", error);
  }
}

export async function trackEngagement(action: "share" | "vote" | "post"): Promise<void> {
  const data = await getReviewPromptData();
  
  if (action === "share") {
    data.shareCount += 1;
  } else if (action === "vote") {
    data.voteCount += 1;
  } else if (action === "post") {
    data.postCount += 1;
  }
  
  await saveReviewPromptData(data);
  await checkAndPromptReview(data);
}

async function checkAndPromptReview(data: ReviewPromptData): Promise<void> {
  if (data.hasReviewed) {
    return;
  }
  
  const SHARE_THRESHOLD = 3;
  const VOTE_THRESHOLD = 10;
  const POST_THRESHOLD = 2;
  const MIN_DAYS_BETWEEN_PROMPTS = 7;
  
  const engagementScore = 
    (data.shareCount >= SHARE_THRESHOLD ? 1 : 0) +
    (data.voteCount >= VOTE_THRESHOLD ? 1 : 0) +
    (data.postCount >= POST_THRESHOLD ? 1 : 0);
  
  if (engagementScore < 2) {
    return;
  }
  
  if (data.lastPromptedAt) {
    const lastPrompted = new Date(data.lastPromptedAt);
    const daysSincePrompt = (Date.now() - lastPrompted.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePrompt < MIN_DAYS_BETWEEN_PROMPTS) {
      return;
    }
  }
  
  await promptForReview();
}

export async function promptForReview(): Promise<boolean> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      console.log("Store review not available on this platform");
      return false;
    }
    
    const hasAction = await StoreReview.hasAction();
    if (hasAction) {
      await StoreReview.requestReview();
      
      const data = await getReviewPromptData();
      data.lastPromptedAt = new Date().toISOString();
      data.hasReviewed = true;
      await saveReviewPromptData(data);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error prompting for review:", error);
    return false;
  }
}

export function generateDeepLink(type: "post" | "invite" | "profile", id: string): string {
  return `${DRIPN_BRANDING.deepLinkScheme}${type}/${id}`;
}

export function generateWebLink(type: "post" | "invite" | "profile", id: string): string {
  return `${DRIPN_BRANDING.appStoreUrl}/${type}/${id}`;
}

export async function sharePostWithBranding(post: Post): Promise<boolean> {
  try {
    const hashtags = generateHashtags(post.description, undefined, undefined, 5);
    const hashtagsStr = hashtags.join(" ");
    const webUrl = generateWebLink("post", post.id);
    
    let title = "Check out this look on Dripn";
    if (post.type === "comparison") {
      title = "Help me pick the best outfit";
    }
    
    const brandedMessage = `${title}\n\n"${post.description.slice(0, 100)}${post.description.length > 100 ? "..." : ""}"\n\n${hashtagsStr}\n\n${DRIPN_BRANDING.downloadCTA}: ${webUrl}`;
    
    const result = await Share.share({
      title,
      message: brandedMessage,
      url: Platform.OS === "ios" ? webUrl : undefined,
    });
    
    if (result.action === Share.sharedAction) {
      await trackEngagement("share");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error sharing post with branding:", error);
    return false;
  }
}

export async function shareApp(): Promise<boolean> {
  try {
    const message = `${DRIPN_BRANDING.tagline}\n\nGet instant outfit advice, discover trending styles, and connect with a community of fashion lovers.\n\n${DRIPN_BRANDING.downloadCTA}: ${DRIPN_BRANDING.appStoreUrl}\n\n#Dripn #FashionApp #OOTD`;
    
    const result = await Share.share({
      title: "Check out Dripn",
      message,
    });
    
    if (result.action === Share.sharedAction) {
      await trackEngagement("share");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error sharing app:", error);
    return false;
  }
}

export async function openDeepLink(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error opening deep link:", error);
    return false;
  }
}

export function parseDeepLink(url: string): { type: string; id: string } | null {
  try {
    if (url.startsWith(DRIPN_BRANDING.deepLinkScheme)) {
      const path = url.replace(DRIPN_BRANDING.deepLinkScheme, "");
      const [type, id] = path.split("/");
      if (type && id) {
        return { type, id };
      }
    }
    return null;
  } catch (error) {
    console.error("Error parsing deep link:", error);
    return null;
  }
}

export interface DealShareInfo {
  id: string;
  title: string;
  brand: string;
  originalPrice: number;
  salePrice: number;
  discount: string;
  currencySymbol: string;
  currencyCode?: string;
  source: string;
}

function formatDealPrice(amount: number, _currencyCode?: string): string {
  return currencyService.formatPrice(Math.round(amount * 100) / 100);
}

export interface ShareResult {
  success: boolean;
  error?: string;
  dismissed?: boolean;
}

export async function shareDeal(deal: DealShareInfo): Promise<ShareResult> {
  try {
    const savings = deal.originalPrice - deal.salePrice;
    const webUrl = `${DRIPN_BRANDING.appStoreUrl}/deals/${deal.id}`;
    
    const formattedSavings = formatDealPrice(savings, deal.currencyCode);
    const formattedOriginal = formatDealPrice(deal.originalPrice, deal.currencyCode);
    const formattedSale = formatDealPrice(deal.salePrice, deal.currencyCode);
    
    const message = `Check out this amazing deal on Dripn!\n\n${deal.brand} - ${deal.title}\n${deal.discount} OFF - Save ${formattedSavings}!\n\nWas: ${formattedOriginal}\nNow: ${formattedSale}\n\nFrom ${deal.source}\n\n#Dripn #FashionDeals #BargainHunting #StyleSavings\n\n${DRIPN_BRANDING.downloadCTA}: ${webUrl}`;
    
    const result = await Share.share({
      title: `${deal.brand} ${deal.discount} Off - Dripn Deal`,
      message,
      url: Platform.OS === "ios" ? webUrl : undefined,
    });
    
    if (result.action === Share.sharedAction) {
      await trackEngagement("share");
      return { success: true };
    }
    return { success: false, dismissed: true };
  } catch (error) {
    console.error("Error sharing deal:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to share deal" };
  }
}

export function getDealShareMessage(deal: DealShareInfo): string {
  const savings = deal.originalPrice - deal.salePrice;
  const formattedSavings = formatDealPrice(savings, deal.currencyCode);
  const formattedOriginal = formatDealPrice(deal.originalPrice, deal.currencyCode);
  const formattedSale = formatDealPrice(deal.salePrice, deal.currencyCode);
  
  return `${deal.brand} - ${deal.title}\n${deal.discount} OFF - Save ${formattedSavings}!\nNow: ${formattedSale} (was ${formattedOriginal})`;
}
