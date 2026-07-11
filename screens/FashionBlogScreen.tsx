import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";
import {
  type BlogPost,
  applyCurrentYearToBlogPost,
  filterBlogPostsForProfile,
  formatBlogPostDate,
  prepareFallbackBlogPosts,
} from "@/utils/fashionBlogUtils";
import { getCurrentCalendarSeason, mapUserGenderToNewsletterFilter } from "@/utils/fashionSeason";
import { useTranslations } from "@/contexts/TranslationContext";

type FashionBlogScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "FashionBlog">;
};

const NEWSLETTER_SUBSCRIPTION_KEY = "@dripn_newsletter_subscribed";
function createFallbackBlogPosts(): BlogPost[] {
  return [
  {
    id: "fallback-color-guide",
    subject: "Dripn Weekly: Your Complete Seasonal Colour Analysis Guide",
    headline: "Seasonal Colour Analysis: The Complete Shopping Guide",
    previewText: "How to use your colour season when shopping for clothes, accessories, and more",
    introduction: "You've discovered you're a Winter, Summer, Spring, or Autumn - but what does that actually mean when you walk into a shop? This comprehensive guide explains how to use your seasonal colour analysis in real-world shopping situations, from menswear to makeup counters.",
    category: "Colour Analysis",
    tags: ["colour-season", "shopping-guide", "winter", "summer", "spring", "autumn", "menswear", "practical"],
    publishedAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "What Is Seasonal Colour Analysis?", content: "Seasonal colour analysis is a system developed in the 1980s by colour consultants to help people identify which colours complement their natural colouring - skin tone, eye colour, and hair. The four seasons (Spring, Summer, Autumn, Winter) each have distinct palettes, and subtypes like 'Deep Winter' or 'Light Summer' refine this further. It's widely used by professional stylists, personal shoppers, and beauty advisors worldwide.", proTip: "The system works for everyone regardless of gender, age, or ethnicity. It's about your natural colouring, not fashion rules." },
      { title: "Deep/True Winter Explained", content: "If you're a Deep Winter or True Winter, you have cool undertones with high contrast between your skin, hair, and eyes. Your power colours are bold, saturated, and cool: Royal Blue, Emerald Green, True Red, Black, Charcoal, Pure White, Burgundy, and jewel tones. These colours make your skin look vibrant and healthy. Avoid warm, muted colours like orange, olive, and cream which can make you look tired.", proTip: "Black is your best neutral - unlike Springs and Autumns, you can wear black right next to your face without looking washed out." },
      { title: "Using Your Season When Shopping", content: "When shopping for suits, shirts, or casual wear, stick to your power colours for pieces that sit near your face - shirts, ties, scarves, jumpers. Trousers and shoes have more flexibility. At a department store, you can absolutely say 'I'm a Deep Winter' to a personal shopper - trained staff will understand. At makeup counters, mention your season and they'll steer you toward cool-toned foundations and lip colours.", proTip: "For men: Navy, charcoal, and black suits are your foundation. Add interest with deep burgundy, forest green, or royal blue shirts and accessories." },
      { title: "Building a Seasonal Wardrobe", content: "Start with foundational pieces in your best neutrals: for Winters, that's black, navy, charcoal, and pure white. Add statement pieces in your power colours - a royal blue blazer, an emerald green polo, a burgundy jumper. Accessories like ties, pocket squares, and scarves are a low-risk way to incorporate colour. Over time, you'll naturally gravitate toward colours that make you look and feel your best.", proTip: "Take screenshots of your power colours from Dripn to reference while shopping. Compare fabrics to ensure you're choosing cool-toned, clear versions rather than warm or muted ones." }
    ]
  },
  {
    id: "fallback-1",
    subject: "Dripn Weekly: Fashion Trends Worth Investing In",
    headline: "Fashion Trends Worth Investing In",
    previewText: "The defining looks with staying power beyond a single season",
    introduction: "From quiet luxury to bold maximalism, personal expression continues to shape style. Here are trends worth investing in — not just for one year, but for your wardrobe long term.",
    category: "Trend Report",
    tags: ["style-trends", "fashion-forecast", "style"],
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Warm Yellow Trend", content: "Warm, optimistic yellow tones are trending on runways this season. Choose the depth that flatters your undertone rather than assuming one shade suits everyone.", proTip: "Start with accessories like a soft yellow handbag or scarf before committing to a full look." },
      { title: "The Return of Tailoring", content: "Oversized blazers, wide-leg trousers, and structured shoulders are dominating. Think power dressing with a relaxed twist.", proTip: "Invest in a quality blazer that fits perfectly in the shoulders - alterations are worth it." },
      { title: "Quiet Luxury 2.0", content: "Stealth wealth continues but with more personality. Think premium fabrics, subtle details, and timeless silhouettes.", proTip: "Focus on cashmere, silk, and quality leather in muted tones." },
      { title: "Cherry Red Moment", content: "Bold, unapologetic cherry red is the statement colour of the season. From bags to boots, this shade demands attention.", proTip: "Pair cherry red with neutrals like cream, camel, or navy for maximum impact." }
    ]
  },
  {
    id: "fallback-2",
    subject: "Dripn Weekly: Build Your Perfect Capsule Wardrobe",
    headline: "The Ultimate Capsule Wardrobe Guide for Modern Life",
    previewText: "30 pieces that create endless outfit combinations",
    introduction: "Tired of standing in front of a full wardrobe with nothing to wear? A strategic capsule wardrobe is your solution to effortless daily dressing.",
    category: "Wardrobe Essentials",
    tags: ["capsule-wardrobe", "minimalism", "essentials"],
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Foundation Pieces", content: "Start with 5 bottoms: two pairs of jeans (one dark, one light), tailored trousers, a midi skirt, and versatile shorts or joggers.", proTip: "Choose bottoms in neutral colours that work with at least 3 tops in your wardrobe." },
      { title: "Layering Essentials", content: "Include a lightweight cardigan, a structured blazer, a cosy knit, and a versatile jacket. These multiply your outfit options exponentially.", proTip: "Stick to the same colour family for easy mixing and matching." },
      { title: "The Quality Investment", content: "Allocate 60% of your budget to everyday pieces you'll wear constantly, and 40% to special occasion items.", proTip: "Cost per wear is more important than price tag - a quality coat worn 100 times is cheaper than a cheap one worn 10." },
      { title: "Accessory Power", content: "5 key accessories can transform your capsule: a quality bag, versatile shoes, a statement belt, simple jewellery, and a classic watch.", proTip: "Choose accessories in metals and leathers that complement each other." }
    ]
  },
  {
    id: "fallback-3",
    subject: "Dripn Weekly: Sustainable Fashion Made Simple",
    headline: "How to Build a Sustainable Wardrobe Without Breaking the Bank",
    previewText: "Eco-conscious style that looks and feels good",
    introduction: "Sustainable fashion isn't just about buying eco-brands. It's a mindset shift that can actually save you money while reducing your environmental impact.",
    category: "Sustainable Style",
    tags: ["sustainability", "eco-fashion", "conscious-shopping"],
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The 30-Wear Test", content: "Before any purchase, ask yourself: 'Will I wear this at least 30 times?' If the answer is no, walk away.", proTip: "This simple question has been shown to reduce impulse purchases by 40%." },
      { title: "Second-Hand First", content: "Check resale platforms like Vinted, Depop, and eBay before buying new. You'll find designer pieces at a fraction of the price.", proTip: "Set up alerts for your favourite brands and sizes to get notified of new listings." },
      { title: "Care for Longevity", content: "Proper garment care extends clothing life by years. Learn to wash less, spot clean more, and store items correctly.", proTip: "Turn clothes inside out, wash cold, and air dry when possible." },
      { title: "Quality Over Quantity", content: "One well-made piece will outlast five fast fashion items. Look for natural fibres, reinforced seams, and quality hardware.", proTip: "Check the weight of fabric - heavier usually means better quality construction." }
    ]
  },
  {
    id: "fallback-4",
    subject: "Dripn Weekly: Dressing for Your Body Type",
    headline: "Style Secrets: Dressing to Flatter Your Unique Shape",
    previewText: "Embrace your silhouette with confidence",
    introduction: "Forget restrictive 'rules' - understanding your proportions helps you make choices that make YOU feel amazing. Here's how to dress with intention.",
    category: "Style Tips",
    tags: ["body-type", "fit-guide", "confidence"],
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Balanced Proportions", content: "If your shoulders and hips are roughly the same width, you can wear most silhouettes. The key is creating definition at your natural waist.", proTip: "A belt at your narrowest point instantly creates a polished, proportioned look." },
      { title: "Shoulder-Heavy Build", content: "Draw attention downward with interesting bottoms, A-line skirts, or wide-leg trousers. V-necks are your best friend.", proTip: "Avoid heavy shoulder pads and cap sleeves that add visual width." },
      { title: "Hip-Heavy Build", content: "Balance your silhouette with structured shoulders, statement necklaces, and boat necks that draw the eye upward.", proTip: "Dark, solid bottoms with patterned or lighter tops create visual balance." },
      { title: "Petite Frame", content: "Vertical lines, monochromatic outfits, and high-waisted bottoms elongate your silhouette beautifully.", proTip: "Avoid oversized bags and chunky accessories that overwhelm your frame." }
    ]
  },
  {
    id: "fallback-5",
    subject: "Dripn Weekly: The Art of Accessorising",
    headline: "Master the Art of Accessorising Like a Stylist",
    previewText: "Transform any outfit with strategic accessories",
    introduction: "Accessories are the punctuation of fashion - they complete the sentence your outfit is trying to make. Learn to use them with intention.",
    category: "Styling Secrets",
    tags: ["accessories", "jewellery", "styling"],
    publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Rule of Three", content: "Aim for three focal points maximum: a watch, a necklace, and a bag, for example. More than three creates visual noise.", proTip: "Use your phone camera to check your outfit before leaving - you'll spot over-accessorising immediately." },
      { title: "Metal Mixing Magic", content: "Forget the old rule about matching metals. Gold, silver, and rose gold can work beautifully together when balanced intentionally.", proTip: "Start with a multi-metal piece as your anchor, then add complementary single-metal items." },
      { title: "The Power of Proportion", content: "Match accessory scale to your frame and outfit. Delicate chains with fitted outfits; chunky statement pieces with oversized silhouettes.", proTip: "If your neckline is detailed, skip the necklace and let your earrings do the talking." },
      { title: "Bag Selection Strategy", content: "Your bag should complement, not match exactly. Consider size, formality, and how it balances your silhouette.", proTip: "A crossbody worn high creates a waist; worn low elongates the torso." }
    ]
  },
  {
    id: "fallback-6",
    subject: "Dripn Weekly: Office to Evening in 5 Minutes",
    headline: "Day to Night: Transform Your Look in 5 Minutes Flat",
    previewText: "Quick changes for seamless transitions",
    introduction: "No time to go home before after-work plans? These strategic swaps will take you from desk to dinner effortlessly.",
    category: "Style Hacks",
    tags: ["day-to-night", "office-style", "quick-changes"],
    publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Shoe Swap", content: "Keep a pair of statement heels or sleek boots at your desk. Swapping trainers for heels instantly elevates any outfit.", proTip: "Block heels offer glamour with walkability - perfect for evening events that involve standing." },
      { title: "Lipstick Power", content: "A bold lip is the fastest way to transform your look. A classic red or berry shade signals 'off-duty' immediately.", proTip: "Keep your chosen shade at your desk and reapply in the lift for time efficiency." },
      { title: "Strategic Undoing", content: "Remove the cardigan, undo an extra button, roll your sleeves differently. Sometimes subtraction creates transformation.", proTip: "A silk cami under your blazer works for daytime buttoned up, evening unbuttoned." },
      { title: "The Emergency Kit", content: "Keep a clutch bag, statement earrings, and a small perfume in your desk drawer. These essentials cover most evening scenarios.", proTip: "A silk scarf can become a hair accessory, belt, or bag charm for instant evening glamour." }
    ]
  },
  {
    id: "fallback-7",
    subject: "Dripn Weekly: Investment Pieces Worth Every Penny",
    headline: "10 Investment Pieces That Pay for Themselves",
    previewText: "Where to splurge and where to save",
    introduction: "Not everything needs to be expensive, but certain items are worth the investment. These pieces will serve you for years and actually save money long-term.",
    category: "Shopping Guide",
    tags: ["investment-pieces", "luxury", "quality"],
    publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Timeless Handbag", content: "A quality leather bag in black, tan, or burgundy will outlast dozens of cheaper alternatives. Classic shapes never date.", proTip: "Consider pre-loved designer bags - they've already proven their longevity." },
      { title: "Perfect Tailored Trousers", content: "Well-fitted trousers in a quality fabric are the foundation of countless outfits. They're worth the alteration cost.", proTip: "Wool blend fabrics drape beautifully and resist wrinkles for travel and long days." },
      { title: "The Heritage Coat", content: "A quality wool coat from a heritage brand can last 20+ years. Cost per wear makes it incredibly economical.", proTip: "Classic styles like the trench, camel coat, or peacoat never go out of fashion." },
      { title: "Quality Leather Shoes", content: "Good shoes can be resoled multiple times. Cheap shoes can't. Invest in leather that moulds to your feet.", proTip: "Use shoe trees and rotate pairs to extend their life significantly." }
    ]
  },
  {
    id: "fallback-8",
    subject: "Dripn Weekly: The Psychology of Colour in Fashion",
    headline: "Colour Psychology: What Your Outfit Really Says About You",
    previewText: "Dress for the impression you want to make",
    introduction: "Colours communicate before you speak a word. Understanding colour psychology lets you dress strategically for any situation.",
    category: "Colour Psychology",
    tags: ["colour", "psychology", "impression"],
    publishedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Navy Blue: The Trust Builder", content: "Navy conveys competence, reliability, and professionalism without the severity of black. Perfect for important meetings.", proTip: "Navy is universally flattering - it works for all skin tones and occasions." },
      { title: "Red: The Power Statement", content: "Red increases perceived confidence and dominance. It's attention-grabbing and energising.", proTip: "Wear red when you need to be memorable, but use it strategically - a little goes a long way." },
      { title: "Green: The Approachable Choice", content: "Green signals harmony, growth, and approachability. It's calming for both wearer and observer.", proTip: "Olive and forest greens work year-round; brighter greens are perfect for spring and summer." },
      { title: "White and Cream: Fresh Confidence", content: "Crisp white signals clarity and new beginnings. Cream is warmer and more approachable.", proTip: "Pair white with a statement piece to avoid looking clinical - add warmth through accessories." }
    ]
  },
  {
    id: "fallback-9",
    subject: "Dripn Weekly: Smart Casual Decoded",
    headline: "Smart Casual Decoded - What It Actually Means",
    previewText: "Master effortlessly polished dressing",
    introduction: "The dress code everyone gets wrong. Here's how to nail it every time, whether it's a work event or weekend brunch.",
    category: "Dress Codes",
    tags: ["smart-casual", "office", "versatile"],
    publishedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Golden Formula", content: "One piece dressed up + one piece dressed down = smart casual perfection.", proTip: "A blazer with jeans or chinos with a quality polo work every time." },
      { title: "Quality Fabrics Matter", content: "Invest in well-made pieces in quality fabrics that look polished. Smart casual is about looking intentional.", proTip: "Avoid heavily distressed denim, graphic tees, or activewear." },
      { title: "Footwear Matters Most", content: "Clean leather trainers or loafers bridge the gap perfectly. Your shoes set the tone.", proTip: "When in doubt, choose closed-toe shoes in leather or suede." },
      { title: "The Finishing Details", content: "A quality watch, leather belt, and minimal jewellery signal effort without trying too hard.", proTip: "Iron your clothes and ensure everything is clean - wrinkles scream 'casual' not 'smart'." }
    ]
  },
  {
    id: "fallback-10",
    subject: "Dripn Weekly: Winter to Spring Transition Dressing",
    headline: "Master the Art of Seasonal Transition Dressing",
    previewText: "Navigate unpredictable weather with style",
    introduction: "That awkward time between seasons doesn't mean wardrobe chaos. Strategic layering is your secret weapon for unpredictable weather.",
    category: "Seasonal Style",
    tags: ["transition", "layering", "spring"],
    publishedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Layer Formula", content: "Base layer + mid layer + outer layer gives you options throughout the day. Each layer should work independently.", proTip: "Lightweight fabrics in your base and mid layers prevent overheating when indoors." },
      { title: "Transitional Fabrics", content: "Cotton, light wool, and linen blends work across temperature swings. Avoid heavy knits that trap heat.", proTip: "A cotton trench coat is the ultimate transition piece - it works from 10 to 20 degrees." },
      { title: "Colour Bridge", content: "Blend seasons with transitional colours: dusty rose, sage green, soft terracotta, and warm cream.", proTip: "Avoid stark white until true spring; cream and ivory work better in transition." },
      { title: "Footwear Strategy", content: "Ankle boots in lighter leathers or suede bridge the gap. Save sandals until temperatures stabilise.", proTip: "Loafers are the ultimate transition shoe - they work with everything from trousers to midi dresses." }
    ]
  },
  {
    id: "fallback-11",
    subject: "Dripn Weekly: Fashion Confidence Boost",
    headline: "7 Ways to Boost Your Fashion Confidence Today",
    previewText: "Style tips that transform how you feel",
    introduction: "Confidence isn't about having the perfect wardrobe - it's about wearing what you have with intention. These mindset shifts change everything.",
    category: "Style Confidence",
    tags: ["confidence", "mindset", "self-expression"],
    publishedAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The 10-Second Rule", content: "Studies show people form impressions in 10 seconds. Dress for the first impression you want to make.", proTip: "Check your outfit in full-length mirror from 3 metres away - that's how others see you." },
      { title: "Wear Your Mood Goal", content: "Dress for how you want to feel, not how you currently feel. Clothes can shift your energy.", proTip: "On low-energy days, your favourite outfit can be a genuine mood booster." },
      { title: "The Compliment Piece", content: "Keep a mental note of items that attract compliments. Wear them when you need a confidence lift.", proTip: "Take photos of outfits that get positive reactions for future reference." },
      { title: "Perfect Fit is Everything", content: "Clothes that fit properly look more expensive and feel more comfortable. Tailoring is worth it.", proTip: "A tailor can transform high-street pieces into custom-looking outfits affordably." }
    ]
  },
  {
    id: "fallback-12",
    subject: "Dripn Weekly: The 5 Winter Wardrobe Essentials",
    headline: "5 Winter Wardrobe Essentials You Need Right Now",
    previewText: "Build your perfect cold-weather capsule wardrobe",
    introduction: "Build your perfect cold-weather capsule with these versatile pieces that work for every occasion from the school run to festive parties.",
    category: "Seasonal Fashion Trends",
    tags: ["winter", "wardrobe", "essentials"],
    publishedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Tailored Wool Coat", content: "A well-fitted wool coat in camel, black, or charcoal instantly elevates any outfit. It's the piece people see first.", proTip: "Choose a single-breasted style for a slimming silhouette; double-breasted for a more structured look." },
      { title: "Cashmere Knitwear", content: "Invest in quality over quantity. A cashmere jumper in neutral tones works under blazers, over shirts, or on its own.", proTip: "Hand wash in cold water with baby shampoo to keep your cashmere looking fresh for years." },
      { title: "Quality Leather Boots", content: "Chelsea boots or knee-high styles in quality leather that will age beautifully and mould to your feet over time.", proTip: "Waterproof spray before first wear - prevention is easier than repair." },
      { title: "The Elevated Scarf", content: "A quality scarf in wool, cashmere, or silk adds colour near your face and instant sophistication.", proTip: "Invest in one quality scarf rather than multiple cheap ones - the difference shows." }
    ]
  },
  {
    id: "fallback-13",
    subject: "Dripn Weekly: Fashion Therapy - Dress Your Mood",
    headline: "Fashion Therapy: How Clothing Heals and Empowers",
    previewText: "The powerful connection between what you wear and how you feel",
    introduction: "Fashion therapy is more than looking good - it's about using clothing as a tool for emotional wellbeing, self-expression, and mental health support. Discover how your wardrobe can become part of your wellness routine.",
    category: "Fashion Therapy",
    tags: ["fashion-therapy", "wellness", "mood-dressing", "mental-health"],
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Dress for Your Desired Mood", content: "When you're feeling low, don't dress to match - dress for the energy you want to cultivate. Bright colours can lift spirits; soft textures can soothe anxiety.", proTip: "Try our Fashion Therapy feature in the app to get personalised outfit recommendations based on your current mood." },
      { title: "The Confidence Ritual", content: "Create a getting-dressed ritual that grounds you. Take time to choose pieces mindfully, appreciating textures and colours that make you feel powerful.", proTip: "Explore Dripn's Confidence Ritual generator for personalised daily affirmations and outfit suggestions." },
      { title: "Comfort as Self-Care", content: "On difficult days, give yourself permission to prioritise comfort. Soft fabrics, relaxed fits, and familiar favourites can provide genuine emotional support.", proTip: "Check out our Wellness Wardrobe section for outfit ideas tailored to activities like yoga, meditation, and self-care days." },
      { title: "Colour Therapy Basics", content: "Yellow for optimism, blue for calm, green for balance, red for energy. Consciously choosing colours can influence your emotional state throughout the day.", proTip: "Visit Fashion Therapy in your Profile to discover which colours best support your emotional needs today." }
    ]
  },
  {
    id: "fallback-14",
    subject: "Dripn Weekly: Body Confidence - Every Body is a Fashion Body",
    headline: "Every Body is a Fashion Body: Your Guide to Radical Self-Acceptance",
    previewText: "Celebrating your unique shape through style",
    introduction: "True style confidence comes from within. This isn't about hiding or fixing anything - it's about celebrating your unique body and expressing yourself authentically through fashion.",
    category: "Body Confidence",
    tags: ["body-positivity", "self-love", "inclusive-fashion", "confidence"],
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Reject the 'Flattering' Myth", content: "The idea that certain clothes are 'flattering' implies there's something wrong with your natural shape. Wear what makes YOU feel amazing, regardless of outdated rules.", proTip: "Try our Body Positivity feature in Fashion Therapy for personalised affirmations that celebrate your unique beauty." },
      { title: "The Joy Test", content: "When trying on clothes, ask: 'Does this bring me joy?' not 'Does this make me look thinner?' Comfort and happiness are the real goals.", proTip: "Keep a note of outfits that pass the joy test - photograph them for reference on low-confidence days." },
      { title: "Size is Just a Number", content: "Sizes vary wildly between brands. Focus on fit and comfort, not the number on the label. Alter items that don't fit rather than forcing yourself into uncomfortable clothes.", proTip: "Our Fashion Therapy section includes tools to help you dress with intention and self-compassion." },
      { title: "Representation Matters", content: "Follow diverse bodies on social media for style inspiration. Seeing people who look like you rocking fashion builds confidence and expands your style horizons.", proTip: "Explore Dripn's inclusive community to see real people of all shapes celebrating their personal style." }
    ]
  },
  {
    id: "fallback-15",
    subject: "Dripn Weekly: Capsule Wardrobe for Wellness",
    headline: "Build a Wellness Wardrobe: Clothes for Every Emotional State",
    previewText: "Strategic dressing for mental health and self-care",
    introduction: "Your wardrobe can be an active participant in your wellness journey. Here's how to build a collection of clothes that supports you through every mood and moment.",
    category: "Wellness Wardrobe",
    tags: ["wellness", "capsule-wardrobe", "self-care", "mental-health"],
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Anxiety-Soothing Capsule", content: "Keep soft, pressure-free pieces on hand for anxious days: loose-fitting joggers, cosy cardigans, and comfortable shoes that don't require decisions.", proTip: "Use Dripn's mood-based outfit recommendations when you're feeling overwhelmed - let us do the thinking for you." },
      { title: "The Energy-Boost Collection", content: "Bright colours, statement pieces, and power outfits for days when you need to show up with energy. These clothes are your confidence armour.", proTip: "Our Fashion Therapy feature includes specific recommendations for when you need to feel motivated and energised." },
      { title: "Movement-Ready Pieces", content: "Include pieces that move with you - stretchy fabrics, breathable materials, and items that transition from yoga to coffee with friends.", proTip: "Check our Wellness Wardrobe for activity-specific outfit suggestions from meditation to nature walks." },
      { title: "The Self-Care Uniform", content: "Designate special pieces for self-care rituals: a beautiful robe, comfortable but pretty loungewear, or a favourite jumper that feels like a hug.", proTip: "Visit Fashion Therapy for daily affirmations and capsule wardrobe planning tools designed around your emotional needs." }
    ]
  },
  {
    id: "fallback-16",
    subject: "Dripn Weekly: Daily Affirmations Through Style",
    headline: "Dress Your Intentions: Daily Affirmations Through Fashion",
    previewText: "Using your wardrobe as a daily mindfulness practice",
    introduction: "What if getting dressed each morning became a moment of intention-setting and self-affirmation? Transform your daily routine into a powerful act of self-love.",
    category: "Mindful Fashion",
    tags: ["affirmations", "mindfulness", "intention", "daily-practice"],
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Morning Intention Setting", content: "Before choosing your outfit, take a moment to ask: 'How do I want to feel today? What energy do I want to bring?' Let the answers guide your choices.", proTip: "Start each day with Dripn's daily fashion affirmation feature - a positive message to set your style intention." },
      { title: "Colour Intentions", content: "Assign personal meanings to colours in your wardrobe. Blue for calm presentations, yellow for creative energy, black for powerful boundaries.", proTip: "Our mood-based outfit selector in Fashion Therapy helps match colours to your emotional needs." },
      { title: "The Gratitude Dress", content: "As you put on each piece, think of one thing you appreciate about your body. Your legs that carry you, your arms that embrace loved ones.", proTip: "Try our Body Positivity affirmations before getting dressed - they're designed to shift your mindset towards self-love." },
      { title: "Evening Reflection", content: "At the end of the day, notice how your outfit made you feel. This builds awareness of which pieces truly serve your wellbeing.", proTip: "Use Fashion Therapy's tools to track which outfits boost your mood - build your personal confidence wardrobe over time." }
    ]
  },
  {
    id: "fallback-17",
    subject: "Dripn Weekly: Size-Inclusive Style Guide",
    headline: "Style Has No Size: The Complete Inclusive Fashion Guide",
    previewText: "Fashion-forward looks for every body type",
    introduction: "Fashion is for everyone, full stop. Whether you're a size 6 or 26, these styling principles will help you dress with joy, confidence, and authentic self-expression.",
    category: "Inclusive Fashion",
    tags: ["plus-size", "inclusive", "all-bodies", "representation"],
    publishedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Fit Over Fashion Rules", content: "The most stylish people wear clothes that fit their actual body, not the body they think they should have. Proper fit looks expensive; ill-fitting looks wrong at any size.", proTip: "Find a good tailor - even simple alterations can transform how clothes feel and look on your unique shape." },
      { title: "Trend Participation", content: "Every trend can be adapted for every body. Wide-leg trousers, bold prints, crop tops, bodycon - there are no size restrictions on style trends.", proTip: "Browse our community for inspiration from real people of all sizes rocking every style imaginable." },
      { title: "Underwear Foundation", content: "Great outfits start with great foundations. Well-fitting, comfortable undergarments that support without digging make everything look better.", proTip: "Invest in professional bra fittings and quality shapewear if you like it - but never as a requirement, only if it makes you feel good." },
      { title: "Confidence is the Best Accessory", content: "The most impactful style element isn't what you wear - it's how you wear it. Stand tall, move with purpose, and own your look completely.", proTip: "Visit Fashion Therapy for confidence rituals and body positivity affirmations that help you step out with pride." }
    ]
  },
  {
    id: "fallback-18",
    subject: "Dripn Weekly: Discover Your Seasonal Colour Palette",
    headline: "Spring, Summer, Autumn or Winter? Find Your Perfect Colour Season",
    previewText: "The complete guide to seasonal colour analysis",
    introduction: "Seasonal colour analysis has been used by stylists for decades to help people find the colours that make them glow. Understanding your season unlocks a whole new level of wardrobe coordination.",
    category: "Colour Analysis",
    tags: ["colour-season", "colour-analysis", "undertones", "palette"],
    publishedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Spring Palette", content: "Warm undertones with clear, bright colouring. You suit coral, peach, warm greens, turquoise, and creamy whites. Think fresh, light, and warm.", proTip: "Springs look washed out in black - try warm navy or chocolate brown instead." },
      { title: "Summer Palette", content: "Cool undertones with soft, muted colouring. Dusty rose, lavender, soft navy, powder blue, and cool greys enhance your natural beauty.", proTip: "Summers glow in pastels and muted tones - avoid bright neons that overwhelm." },
      { title: "Autumn Palette", content: "Warm undertones with rich, muted colouring. Terracotta, olive, mustard, burgundy, and warm browns bring out your warmth.", proTip: "Autumns look stunning in earth tones - embrace rust, burnt orange, and forest green." },
      { title: "Winter Palette", content: "Cool undertones with high contrast. True black, pure white, jewel tones like emerald and sapphire, and bold berry shades suit you perfectly.", proTip: "Winters can wear black beautifully - it enhances your natural drama and contrast." }
    ]
  },
  {
    id: "fallback-19",
    subject: "Dripn Weekly: Master the Art of Colour Blocking",
    headline: "Colour Blocking: Bold, Beautiful, and Easier Than You Think",
    previewText: "Create striking outfits with confident colour combinations",
    introduction: "Colour blocking is one of fashion's most impactful techniques. It looks complex but follows simple rules that anyone can master. Here's how to create bold, harmonious colour combinations.",
    category: "Colour Styling",
    tags: ["colour-blocking", "bold-style", "colour-combinations", "statement"],
    publishedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Complementary Colours", content: "Opposite colours on the colour wheel create maximum impact: orange and blue, purple and yellow, red and green. These combinations vibrate with energy.", proTip: "Start with one statement piece and let the complementary colour be your accessory." },
      { title: "Analogous Harmony", content: "Colours next to each other on the wheel create sophisticated flow: blue to green, orange to red, purple to pink. These combinations feel cohesive and elegant.", proTip: "This is the easiest colour blocking technique for beginners - it's almost impossible to get wrong." },
      { title: "Triadic Power", content: "Three colours evenly spaced on the wheel create dynamic energy: red, yellow, blue or orange, green, purple. Bold but balanced.", proTip: "Let one colour dominate at 60%, second at 30%, third at 10% for perfect balance." },
      { title: "Neutral Anchoring", content: "Ground bold colours with neutrals. Black, white, navy, or camel can calm an outfit and make statement pieces pop even more.", proTip: "When in doubt, add a neutral bag and shoes to let your colour blocking shine without chaos." }
    ]
  },
  {
    id: "fallback-20",
    subject: "Dripn Weekly: The Art of Pattern Mixing",
    headline: "Pattern Mixing Made Easy: Rules the Pros Actually Follow",
    previewText: "Combine prints like a fashion editor",
    introduction: "Pattern mixing intimidates many, but it's actually governed by simple principles. Once you understand the rules, you can break them creatively and confidently.",
    category: "Styling Techniques",
    tags: ["patterns", "prints", "mixing", "styling"],
    publishedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Vary the Scale", content: "Mix large prints with small prints. A bold floral top works beautifully with a fine stripe trouser. Same-size patterns compete for attention.", proTip: "If one pattern is large and dominant, make the other subtle and supporting." },
      { title: "Share a Common Colour", content: "The easiest way to mix patterns is ensuring they share at least one colour. This creates visual cohesion even with very different prints.", proTip: "Pull the secondary colour from one pattern as the dominant colour in the other." },
      { title: "Mix Pattern Types", content: "Combine different pattern families: geometric with organic, structured with flowing. Stripes with florals, animal print with polka dots.", proTip: "Avoid mixing two busy organic prints - it can feel chaotic rather than intentional." },
      { title: "Use a Neutral Separator", content: "Break up bold patterns with a solid neutral between them. A white shirt between a plaid jacket and leopard skirt creates breathing room.", proTip: "Your belt, bag, and shoes can be the neutral mediators that tie mixed patterns together." }
    ]
  },
  {
    id: "fallback-21",
    subject: "Dripn Weekly: The Ultimate Fabric Guide",
    headline: "Know Your Fabrics: A Complete Guide to Textile Quality",
    previewText: "How to identify quality fabrics and care for them properly",
    introduction: "Understanding fabric is the key to building a quality wardrobe. Learn to identify superior textiles, understand their properties, and care for them to extend their life.",
    category: "Fabric Education",
    tags: ["fabrics", "quality", "textiles", "care"],
    publishedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Natural Fibres", content: "Cotton, linen, silk, and wool are breathable, comfortable, and age beautifully. They're generally worth investing in for everyday pieces.", proTip: "Check thread count for cotton sheets and shirts - higher usually means softer and more durable." },
      { title: "Luxury Materials", content: "Cashmere, merino wool, mulberry silk, and Egyptian cotton are premium for good reason. They feel superior and last longer with proper care.", proTip: "Cashmere should feel light and soft, not heavy. Heavy cashmere often indicates lower quality." },
      { title: "Quality Synthetics", content: "Not all synthetics are bad. Quality viscose, modal, and tencel drape beautifully. Look for high-quality blends that combine benefits.", proTip: "Polyester in linings and performance wear makes sense - avoid it in pieces meant to breathe." },
      { title: "The Scrunch Test", content: "Scrunch fabric in your hand for 5 seconds. Quality fabric bounces back with minimal wrinkling. Cheap fabric stays creased.", proTip: "Also check the inside seams - finished seams indicate quality construction." }
    ]
  },
  {
    id: "fallback-22",
    subject: "Dripn Weekly: Complete Shoe Styling Guide",
    headline: "The Complete Shoe Guide: From Trainers to Stilettos",
    previewText: "Master the art of footwear selection",
    introduction: "Shoes make or break an outfit. They signal formality, personality, and attention to detail. Here's how to choose the right footwear for every occasion and style them with confidence.",
    category: "Footwear",
    tags: ["shoes", "footwear", "styling", "accessories"],
    publishedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Formality Ladder", content: "Trainers sit at casual, loafers bridge to smart-casual, brogues and heels signal business, while Oxfords and stilettos represent formal.", proTip: "When unsure, err slightly more formal than the occasion - it's better to be slightly overdressed in shoes." },
      { title: "Colour Coordination", content: "Nude shoes elongate legs. Black is formal and grounding. White trainers add freshness. Metallic works as a neutral.", proTip: "Match your shoes to your bag for classic polish, or deliberately mismatch for modern edge." },
      { title: "Heel Heights", content: "Kitten heels (1-2 inches) are comfortable and elegant. Mid-heels (2-3 inches) balance height and walkability. High heels (3+ inches) make a statement.", proTip: "Block heels and platform soles add height while maintaining comfort and stability." },
      { title: "The Foundation Five", content: "Every wardrobe needs: white trainers, black heels or smart shoes, nude or tan sandals, ankle boots, and comfortable loafers.", proTip: "Invest in quality for shoes you wear daily - cost per wear makes them economical over time." }
    ]
  },
  {
    id: "fallback-23",
    subject: "Dripn Weekly: Jewellery Styling Secrets",
    headline: "Jewellery Styling: Less, More, and Everything In Between",
    previewText: "The complete guide to accessorising with jewellery",
    introduction: "Jewellery is the finishing touch that makes an outfit personal. Whether you prefer minimalist or maximalist, understanding the principles helps you shine.",
    category: "Jewellery",
    tags: ["jewellery", "accessories", "styling", "gold-silver"],
    publishedAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Face Shape Earrings", content: "Round faces suit long, angular earrings. Square faces are softened by round or curved styles. Oval faces can wear most shapes.", proTip: "Statement earrings look best with hair up or tucked back to let them shine." },
      { title: "Neckline Necklaces", content: "V-necks suit pendant necklaces. Crew necks work with shorter chains or chokers. Strapless calls for statement collars.", proTip: "Leave 2-3 inches between the neckline and where your necklace falls for perfect placement." },
      { title: "The Stacking Trend", content: "Layered necklaces, stacked rings, and mixed bracelets create personal style. Mix thicknesses and textures for interest.", proTip: "Odd numbers look best - three necklaces, five rings, seven bracelets create pleasing visual rhythm." },
      { title: "Metal Mixing Done Right", content: "Modern style embraces mixed metals. The key is intentionality - wear gold and silver together with confidence, not accidentally.", proTip: "A two-tone watch or multi-metal statement piece ties mixed metals together seamlessly." }
    ]
  },
  {
    id: "fallback-24",
    subject: "Dripn Weekly: The Handbag Hierarchy",
    headline: "Handbag Guide: Styles, Sizes, and When to Use Each",
    previewText: "Build the perfect bag collection",
    introduction: "Your bag says a lot about your style and practical needs. Understanding bag categories helps you build a collection that covers every occasion without redundancy.",
    category: "Bags",
    tags: ["handbags", "bags", "accessories", "investment"],
    publishedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Everyday Tote", content: "Large enough for essentials plus extras. Should have internal organisation and comfortable straps. This is your workhorse bag.", proTip: "Choose structured over slouchy for a more polished look - it holds its shape better over time." },
      { title: "The Crossbody", content: "Hands-free convenience for busy days. Size should fit phone, cards, keys, and lipstick comfortably. Perfect for weekends and travel.", proTip: "Adjustable straps let you wear high for energy or low for elegance." },
      { title: "The Clutch", content: "Evening essential that forces you to edit down to lipstick, phone, and cards. Statement piece that elevates any outfit.", proTip: "Choose a clutch with a hidden chain strap for versatility - hands-free when needed." },
      { title: "Investment vs Statement", content: "Invest in classic shapes in neutral colours for everyday. Make statement bags the affordable, trendy pieces you can cycle through.", proTip: "A quality black or tan bag will outlast dozens of fast-fashion purchases - calculate cost per use." }
    ]
  },
  {
    id: "fallback-25",
    subject: "Dripn Weekly: Wardrobe Organisation Secrets",
    headline: "The Organised Wardrobe: Systems That Actually Work",
    previewText: "Transform your closet into a personal boutique",
    introduction: "An organised wardrobe saves time, reduces stress, and helps you see what you actually own. These professional techniques make getting dressed a joy, not a chore.",
    category: "Wardrobe Organisation",
    tags: ["organisation", "closet", "declutter", "systems"],
    publishedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Edit Process", content: "Remove everything. Only return items you love, that fit, and that you've worn in the past year. Be ruthless - clutter obscures your best pieces.", proTip: "Turn all hangers backwards. After wearing, hang correctly. After 6 months, donate unworn items." },
      { title: "Category Organisation", content: "Group by type (all tops together), then by colour within each category. This makes outfit building visual and intuitive.", proTip: "Arrange colours in rainbow order for visual appeal and easy matching." },
      { title: "The Prime Zone", content: "Keep your most-worn items at eye level and easy reach. Store seasonal and special occasion pieces higher or in storage boxes.", proTip: "Reserve your 'prime real estate' for pieces you reach for weekly." },
      { title: "Maintenance Habits", content: "Spend 5 minutes weekly returning items to their homes. Do a mini edit each season. This prevents closet chaos from rebuilding.", proTip: "The one-in-one-out rule prevents wardrobe creep - donate something each time you buy something new." }
    ]
  },
  {
    id: "fallback-26",
    subject: "Dripn Weekly: Dressing for Your Life Stage",
    headline: "Style Evolution: Dressing Confidently at Every Age",
    previewText: "Timeless style principles that grow with you",
    introduction: "Your style should evolve as you do. There are no age-appropriate rules - only choices that make you feel confident, current, and authentically you.",
    category: "Timeless Style",
    tags: ["ageless-style", "evolution", "confidence", "timeless"],
    publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "Quality Over Quantity", content: "As you age, investing in fewer, better pieces becomes more satisfying. A capsule wardrobe of excellent items beats a closet of fast fashion.", proTip: "Calculate cost-per-wear: a expensive coat worn 200 times costs less than a cheap one worn 20 times." },
      { title: "Fit is Everything", content: "Nothing ages you like ill-fitting clothes. Too tight looks uncomfortable; too loose looks sloppy. Perfect fit looks expensive at any price point.", proTip: "Build a relationship with a good tailor - alterations transform average pieces into perfect ones." },
      { title: "Embrace Colour", content: "Many people become more neutral with age when the opposite serves better. Colour near your face brings vibrancy and youthfulness.", proTip: "Find your perfect shade of pink, coral, or blue - these colours brighten most faces." },
      { title: "Modern Details", content: "Stay current through details rather than trends. A classic blazer in a current fabric, or timeless jeans in a modern cut keeps your look fresh.", proTip: "Update accessories seasonally - they're the easiest way to look current without wardrobe overhaul." }
    ]
  },
  {
    id: "fallback-27",
    subject: "Dripn Weekly: Workwear Revolution",
    headline: "Modern Workwear: Professional Style for the New Era",
    previewText: "Navigate hybrid dress codes with confidence",
    introduction: "Workwear has evolved dramatically. Whether you're in the office, working from home, or switching between both, here's how to dress professionally while staying comfortable and stylish.",
    category: "Professional Style",
    tags: ["workwear", "office", "professional", "hybrid"],
    publishedAt: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString(),
    tips: [
      { title: "The Zoom-Ready Top Half", content: "Video calls only show your upper body. Invest in structured tops, quality knitwear, and pieces with interesting necklines that photograph well.", proTip: "Avoid tiny patterns and stripes on camera - they create distracting visual buzzing." },
      { title: "Comfortable Professionalism", content: "Stretchy tailoring, soft blazers, and dressy joggers allow comfort without sacrificing polish. Look for pieces that move with you.", proTip: "Pull-on trousers with an elasticated waist can look just as smart as button-fly when styled correctly." },
      { title: "The Transition Wardrobe", content: "Choose pieces that work for multiple contexts: a silk blouse for meetings that works for dinner, trainers smart enough for casual Fridays.", proTip: "Invest in versatile pieces that transition seamlessly from desk to drinks." },
      { title: "Authority Dressing", content: "When you need to command respect, choose structured silhouettes, quality fabrics, and confident colours. Dress for the meeting, not the commute.", proTip: "Navy and charcoal convey authority without the severity of black - perfect for leadership moments." }
    ]
  }
];
}

export default function FashionBlogScreen({ navigation }: FashionBlogScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [contentNotice, setContentNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
    fetchPosts();
  }, [user?.gender]);

  const applyProfileFilters = useCallback((items: BlogPost[]) => {
    return filterBlogPostsForProfile(items, user, getCurrentCalendarSeason());
  }, [user]);

  const loadFallbackPosts = useCallback((notice?: string) => {
    const prepared = prepareFallbackBlogPosts(createFallbackBlogPosts());
    setPosts(applyProfileFilters(prepared));
    setIsUsingFallback(true);
    setContentNotice(notice ?? null);
  }, [applyProfileFilters]);

  const mapNewslettersToPosts = (newsletters: Array<Record<string, unknown>>): BlogPost[] => {
    return newsletters.map((newsletter) => {
      const aiGenerated = Boolean(newsletter.aiGenerated);
      const base: BlogPost = {
        id: String(newsletter.id ?? newsletter.slug ?? ''),
        subject: String(newsletter.subject ?? ''),
        headline: String(newsletter.headline ?? newsletter.subject ?? ''),
        previewText: String(newsletter.previewText ?? newsletter.introduction ?? '').substring(0, 100),
        introduction: String(newsletter.introduction ?? newsletter.previewText ?? ''),
        category: String(newsletter.category ?? 'Style'),
        tags: (newsletter.tags as string[]) || [],
        publishedAt: String(newsletter.publishedAt ?? new Date().toISOString()),
        tips: (newsletter.tips as BlogPost['tips']) || [],
        gender: (newsletter.gender as BlogPost['gender']) || 'all',
        season: (newsletter.season as BlogPost['season']) || 'all',
        isEvergreen: false,
        aiGenerated,
        sourcesUsed: (newsletter.sourcesUsed as string[]) || [],
        researchedAt: newsletter.researchedAt ? String(newsletter.researchedAt) : null,
      };
      return aiGenerated ? base : applyCurrentYearToBlogPost(base);
    });
  };

  const loadSubscriptionStatus = async () => {
    try {
      const subscribed = await AsyncStorage.getItem(NEWSLETTER_SUBSCRIPTION_KEY);
      setIsSubscribed(subscribed === "true");
    } catch (error) {
      console.log("Error loading subscription status:", error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setContentNotice(null);
      const gender = mapUserGenderToNewsletterFilter(user?.gender);
      
      if (!apiService.isConfigured()) {
        loadFallbackPosts(t('blog.offlineNotice'));
        return;
      }

      const response = await apiService.getPublishedNewsletters({
        limit: 20,
        gender,
        season: getCurrentCalendarSeason(),
      });
      
      const newsletters = response.newsletters ?? [];
      if (newsletters.length > 0) {
        const formattedPosts = mapNewslettersToPosts(newsletters as Array<Record<string, unknown>>);
        const filtered = applyProfileFilters(formattedPosts);
        if (filtered.length > 0) {
          setPosts(filtered);
          setIsUsingFallback(false);
        } else {
          setPosts(formattedPosts);
          setIsUsingFallback(false);
          setContentNotice(t('blog.filterNotice'));
        }
      } else {
        loadFallbackPosts(t('blog.noIssuesYet'));
      }
    } catch (error) {
      console.log("Error fetching newsletters, using fallback:", error);
      loadFallbackPosts(t('blog.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [user?.gender, applyProfileFilters, loadFallbackPosts]);

  const formatDate = (post: BlogPost) => formatBlogPostDate(post, post.publishedAt);

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user?.email) {
      Alert.alert(
        t('settings.newsletterEmailRequired') || t('common.emailRequired') || "Email Required",
        t('settings.newsletterEmailRequiredMessage') || t('common.addAnEmailAddressToYourDripnAccountToRec') || "Add an email address to your Dripn account to receive the weekly newsletter.",
        [{ text: t('common.ok') || "OK" }],
      );
      return;
    }

    if (!apiService.isConfigured()) {
      Alert.alert(
        t('settings.newsletterConnectionRequired') || t('common.connectionRequired') || "Connection Required",
        t('settings.newsletterConnectionRequiredMessage') || t('common.connectToTheInternetToSubscribeToTheWeek') || "Connect to the internet to subscribe to the weekly newsletter.",
        [{ text: t('common.ok') || "OK" }],
      );
      return;
    }

    try {
      const result = await apiService.subscribeToNewsletter(user.email, user.name);
      const subscribed = Boolean(
        result?.success
        || result?.alreadySubscribed
        || result?.resubscribed
        || /subscribed|resubscribed/i.test(result?.message ?? ''),
      );
      if (!subscribed) {
        throw new Error(result?.message || "Subscribe failed");
      }

      await AsyncStorage.setItem(NEWSLETTER_SUBSCRIPTION_KEY, "true");
      setIsSubscribed(true);
      await fetchPosts();

      Alert.alert(
        t('blog.subscribed'),
        t('settings.newsletterSubscribed'),
        [{ text: t('common.ok') || "OK" }],
      );
    } catch (error) {
      console.log("Newsletter subscribe failed:", error);
      Alert.alert(
        t('settings.newsletterUpdateFailed') || t('common.subscriptionFailed') || "Subscription Failed",
        t('common.weCouldntSaveYourSubscription') || "We couldn't save your subscription. Please try again later.",
        [{ text: t('common.ok') || "OK" }],
      );
    }
  };

  const handleReport = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportingPostId(postId);
    
    Alert.alert(t('common.reportIssue') || "Report Issue", t('common.whatWouldYouLikeToReport') || "What would you like to report?",
      [
        { text: t('fashionBlog.reportTypo') || "Typo or Error", onPress: () => submitReport(postId, "typo", "Typo or grammatical error reported") },
        { text: t('fashionBlog.reportOffensive') || "Offensive Content", onPress: () => submitReport(postId, "offensive", "Content flagged as potentially offensive") },
        { text: t('fashionBlog.reportInaccurate') || "Inaccurate Information", onPress: () => submitReport(postId, "inaccurate", "Information reported as potentially inaccurate") },
        { text: t('common.cancel'), style: "cancel", onPress: () => setReportingPostId(null) }
      ]
    );
  };

  const submitReport = async (postId: string, issueType: string, description: string) => {
    try {
      if (apiService.isConfigured()) {
        await apiService.reportNewsletterIssue({
          newsletterId: postId,
          issueType,
          description,
          userEmail: user?.email
        });
      }
      
      Alert.alert(t('common.reportSubmitted') || "Report Submitted", t('common.thankYouForYourFeedbackOurTeamWillReview') || "Thank you for your feedback. Our team will review this content.",
        [{ text: t('common.ok') || "OK" }]
      );
    } catch (error) {
      console.log("Error submitting report:", error);
      Alert.alert(
        t('common.reportFailed') || "Report Failed",
        t('common.weCouldntSubmitYourReport') || "We couldn't submit your report. Please try again later.",
        [{ text: t('common.ok') || "OK" }],
      );
    } finally {
      setReportingPostId(null);
    }
  };

  const toggleExpanded = (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedPost(expandedPost === postId ? null : postId);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ThemedText type="h2" style={styles.title}>{t('blog.title')}</ThemedText>
      <ThemedText type="body" style={styles.subtitle}>
        {t('blog.subtitle')}
      </ThemedText>

      {isUsingFallback || contentNotice ? (
        <View style={[styles.fallbackBanner, { backgroundColor: isDark ? 'rgba(255,193,7,0.12)' : 'rgba(255,193,7,0.18)' }]}>
          <Feather name="book-open" size={16} color={theme.link} />
          <ThemedText type="small" style={styles.fallbackBannerText}>
            {contentNotice
              ?? (isUsingFallback
                ? (isSubscribed ? t('blog.noIssuesYet') : t('blog.curatedGuides'))
                : null)}
          </ThemedText>
        </View>
      ) : null}
      
      {!isSubscribed ? (
        <Card style={[styles.subscribeCard, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.15)" : "rgba(201, 169, 97, 0.1)" }]}>
          <View style={styles.subscribeContent}>
            <View style={styles.subscribeIcon}>
              <Feather name="mail" size={24} color={theme.link} />
            </View>
            <View style={styles.subscribeText}>
              <ThemedText type="h3">{t('blog.subscribe')}</ThemedText>
              <ThemedText type="small" style={styles.subscribeSubtext}>
                {t('blog.joinNewsletter')}
              </ThemedText>
            </View>
          </View>
          <Button onPress={handleSubscribe} style={styles.subscribeButton}>
            {t('blog.subscribe')}
          </Button>
        </Card>
      ) : !isUsingFallback ? (
        <View style={[styles.subscribedBadge, { backgroundColor: isDark ? "rgba(52, 199, 89, 0.2)" : "rgba(52, 199, 89, 0.1)" }]}>
          <Feather name="check-circle" size={16} color={theme.success || "#34C759"} />
          <ThemedText type="small" style={{ color: theme.success || "#34C759" }}>
            {t('blog.subscribed')}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.subscribedBadge, { backgroundColor: isDark ? "rgba(52, 199, 89, 0.2)" : "rgba(52, 199, 89, 0.1)" }]}>
          <Feather name="mail" size={16} color={theme.success || "#34C759"} />
          <ThemedText type="small" style={{ color: theme.success || "#34C759" }}>
            {t('blog.subscribed')}
          </ThemedText>
        </View>
      )}
    </View>
  );

  const renderPost = ({ item }: { item: BlogPost }) => {
    const isExpanded = expandedPost === item.id;
    
    return (
      <Pressable onPress={() => toggleExpanded(item.id)}>
        <Card style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.postHeaderBadges}>
              <View style={[styles.categoryBadge, { backgroundColor: isDark ? "rgba(201, 169, 97, 0.2)" : "rgba(201, 169, 97, 0.15)" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  {item.category}
                </ThemedText>
              </View>
              {item.aiGenerated ? (
                <View style={[styles.aiBadge, { backgroundColor: isDark ? "rgba(100, 149, 237, 0.2)" : "rgba(100, 149, 237, 0.15)" }]}>
                  <Feather name="cpu" size={11} color={theme.link} />
                  <ThemedText type="caption" style={{ color: theme.link, marginLeft: 4 }}>
                    AI-researched
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="caption" style={styles.dateText}>
              {formatDate(item)}
            </ThemedText>
          </View>
          
          <ThemedText type="h3" style={styles.postTitle}>
            {item.headline}
          </ThemedText>
          
          <ThemedText type="body" style={styles.postPreview}>
            {item.introduction}
          </ThemedText>
          
          {isExpanded ? (
            <View style={styles.expandedContent}>
              {item.aiGenerated && item.sourcesUsed && item.sourcesUsed.length > 0 ? (
                <ThemedText type="caption" style={styles.sourcesLine}>
                  Researched from: {item.sourcesUsed.slice(0, 4).join(' · ')}
                </ThemedText>
              ) : null}
              {item.tips.map((tip, index) => (
                <View key={index} style={[styles.tipCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
                  <ThemedText type="body" style={[styles.tipTitle, { fontWeight: "600" }]}>
                    {index + 1}. {tip.title}
                  </ThemedText>
                  <ThemedText type="body" style={styles.tipContent}>
                    {tip.content}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.proTip, { color: theme.link }]}>
                    Pro Tip: {tip.proTip}
                  </ThemedText>
                </View>
              ))}
              
              <View style={styles.postActions}>
                <View style={styles.tagsRow}>
                  {item.tags.map((tag, index) => (
                    <View key={index} style={[styles.tag, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
                      <ThemedText type="caption">#{tag}</ThemedText>
                    </View>
                  ))}
                </View>
                
                <Pressable 
                  onPress={() => handleReport(item.id)}
                  style={styles.reportButton}
                  disabled={reportingPostId === item.id}
                >
                  {reportingPostId === item.id ? (
                    <ActivityIndicator size="small" color={theme.tabIconDefault} />
                  ) : (
                    <>
                      <Feather name="flag" size={14} color={theme.tabIconDefault} />
                      <ThemedText type="caption" style={styles.reportText}>Report</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
          
          <View style={styles.expandIndicator}>
            <Feather 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.tabIconDefault} 
            />
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              {isExpanded ? "Show less" : t('blog.readMore')}
            </ThemedText>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="book-open" size={48} color={theme.tabIconDefault} />
      <ThemedText type="h3" style={styles.emptyTitle}>{t('blog.emptyTitle')}</ThemedText>
      <ThemedText type="body" style={styles.emptySubtitle}>
        {t('blog.emptyMessage')}
      </ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={styles.loadingText}>Loading articles...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScreenFlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.link}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    opacity: 0.7,
  },
  headerContainer: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  fallbackBannerText: {
    flex: 1,
    opacity: 0.85,
    lineHeight: 18,
  },
  subscribeCard: {
    padding: Spacing.lg,
  },
  subscribeContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  subscribeIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  subscribeText: {
    flex: 1,
  },
  subscribeSubtext: {
    opacity: 0.7,
    marginTop: 4,
  },
  subscribeButton: {
    marginTop: Spacing.sm,
  },
  subscribedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  postCard: {
    padding: Spacing.lg,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  postHeaderBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexShrink: 1,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  sourcesLine: {
    opacity: 0.65,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  dateText: {
    opacity: 0.6,
  },
  postTitle: {
    marginBottom: Spacing.sm,
  },
  postPreview: {
    opacity: 0.8,
    lineHeight: 22,
  },
  expandedContent: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  tipCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  tipTitle: {
    marginBottom: Spacing.xs,
  },
  tipContent: {
    opacity: 0.8,
    marginBottom: Spacing.sm,
  },
  proTip: {
    fontStyle: "italic",
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    flex: 1,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: Spacing.sm,
  },
  reportText: {
    opacity: 0.6,
  },
  expandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
