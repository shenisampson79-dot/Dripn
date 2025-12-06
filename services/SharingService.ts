import { Share, Platform } from "react-native";
import * as StoreReview from "expo-store-review";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post } from "@/contexts/PostsContext";

const STYLEWISE_BRANDING = {
  tagline: "Get personalized fashion advice from AI and real people",
  downloadCTA: "Download StyleWise free",
  appStoreUrl: "https://stylewise.app",
  deepLinkScheme: "stylewise://",
};

const REVIEW_PROMPT_STORAGE_KEY = "@stylewise_review_prompt";
const SHARE_COUNT_STORAGE_KEY = "@stylewise_share_count";

const TRENDING_HASHTAGS = [
  "#StyleWise",
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
  
  tags.add("#StyleWise");
  
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
  
  const deepLink = `stylewise://post/${post.id}`;
  const webUrl = `https://stylewise.app/post/${post.id}`;
  
  let title = "Check out this outfit on StyleWise";
  
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
    const hashtag = `#StyleWise${challengeName.replace(/\s+/g, "")}`;
    const message = `Join the "${challengeName}" challenge on StyleWise!\n\n${challengeDescription}\n\n${hashtag} #StyleWise #FashionChallenge\n\nhttps://stylewise.app/challenges`;
    
    const result = await Share.share({
      title: `StyleWise Challenge: ${challengeName}`,
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
    const message = `Get fashion advice from real people and AI on StyleWise!\n\nUse my referral code: ${code}\n${bonusInfo}\n\nDownload now: https://stylewise.app/invite/${code}`;
    
    const result = await Share.share({
      title: "Join StyleWise",
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
    const message = `Today's Style Pick on StyleWise:\n\n"${description}"\n\nAI Tip: ${advice.slice(0, 150)}...\n\n#StyleOfTheDay #StyleWise #AIFashion\n\nhttps://stylewise.app/style-of-the-day`;
    
    const result = await Share.share({
      title: "StyleWise Style of the Day",
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
  return `${STYLEWISE_BRANDING.deepLinkScheme}${type}/${id}`;
}

export function generateWebLink(type: "post" | "invite" | "profile", id: string): string {
  return `${STYLEWISE_BRANDING.appStoreUrl}/${type}/${id}`;
}

export async function sharePostWithBranding(post: Post): Promise<boolean> {
  try {
    const hashtags = generateHashtags(post.description, undefined, undefined, 5);
    const hashtagsStr = hashtags.join(" ");
    const webUrl = generateWebLink("post", post.id);
    
    let title = "Check out this look on StyleWise";
    if (post.type === "comparison") {
      title = "Help me pick the best outfit";
    }
    
    const brandedMessage = `${title}\n\n"${post.description.slice(0, 100)}${post.description.length > 100 ? "..." : ""}"\n\n${hashtagsStr}\n\n${STYLEWISE_BRANDING.downloadCTA}: ${webUrl}`;
    
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
    const message = `${STYLEWISE_BRANDING.tagline}\n\nGet instant outfit advice, discover trending styles, and connect with a community of fashion lovers.\n\n${STYLEWISE_BRANDING.downloadCTA}: ${STYLEWISE_BRANDING.appStoreUrl}\n\n#StyleWise #FashionApp #OOTD`;
    
    const result = await Share.share({
      title: "Check out StyleWise",
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
    if (url.startsWith(STYLEWISE_BRANDING.deepLinkScheme)) {
      const path = url.replace(STYLEWISE_BRANDING.deepLinkScheme, "");
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
