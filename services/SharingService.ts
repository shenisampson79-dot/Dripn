import { Share, Platform } from "react-native";
import { Post } from "@/contexts/PostsContext";

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
    post.occasion,
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
