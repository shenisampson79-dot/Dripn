/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Content Personalization Service - Tailors content based on member goals
 * Ensures members see content that helps achieve their personal objectives
 */

import { DripnGoal, ExtendedPreferences, Gender } from '@/contexts/AuthContext';

export type ContentCategory = 
  | 'style-tips'
  | 'outfit-ideas'
  | 'shopping-deals'
  | 'community-posts'
  | 'events'
  | 'wardrobe-tools'
  | 'professional-looks'
  | 'trending-styles'
  | 'influencer-inspiration'
  | 'capsule-wardrobe'
  | 'color-matching'
  | 'special-occasion';

export interface ContentWeight {
  category: ContentCategory;
  weight: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PersonalizedFeedConfig {
  primaryCategories: ContentCategory[];
  secondaryCategories: ContentCategory[];
  generalCategories: ContentCategory[];
  weights: ContentWeight[];
  aiPromptEnhancements: string[];
  feedRatio: {
    goalRelated: number;
    general: number;
  };
}

const GOAL_CONTENT_MAPPING: Record<DripnGoal, {
  primaryCategories: ContentCategory[];
  secondaryCategories: ContentCategory[];
  aiPromptEnhancement: string;
  contentPriority: string[];
}> = {
  'dress-better': {
    primaryCategories: ['style-tips', 'outfit-ideas', 'color-matching'],
    secondaryCategories: ['trending-styles', 'influencer-inspiration'],
    aiPromptEnhancement: 'Focus on actionable styling advice that helps improve their overall appearance. Provide specific, practical tips on color coordination, fit, proportion, and outfit composition. Emphasize transformation and confidence-building.',
    contentPriority: ['Daily style tips', 'Before/after outfit transformations', 'Color harmony guides', 'Fit optimization advice', 'Style rule breakdowns'],
  },
  'meet-people': {
    primaryCategories: ['community-posts', 'events', 'influencer-inspiration'],
    secondaryCategories: ['outfit-ideas', 'trending-styles'],
    aiPromptEnhancement: 'Highlight community features, local fashion events, and opportunities to connect with other fashion enthusiasts. Suggest conversation-starting outfits and social event appropriate looks.',
    contentPriority: ['Community highlights', 'Local fashion events', 'Style challenges', 'Member spotlights', 'Fashion meetups'],
  },
  'find-offers': {
    primaryCategories: ['shopping-deals', 'trending-styles'],
    secondaryCategories: ['wardrobe-tools', 'capsule-wardrobe'],
    aiPromptEnhancement: 'Prioritize value-conscious recommendations with budget-friendly alternatives. Always include price comparisons and highlight sales, discounts, and best-value pieces. Focus on smart shopping strategies.',
    contentPriority: ['Flash sales', 'Daily deals', 'Price drops', 'Budget styling tips', 'Dupe recommendations', 'Sale alerts'],
  },
  'get-inspired': {
    primaryCategories: ['influencer-inspiration', 'trending-styles', 'outfit-ideas'],
    secondaryCategories: ['community-posts', 'special-occasion'],
    aiPromptEnhancement: 'Curate visually stunning outfit inspiration from diverse sources. Feature creative styling, unexpected combinations, and fresh fashion perspectives. Emphasize visual discovery and mood boards.',
    contentPriority: ['Trending looks', 'Celebrity style', 'Street style', 'Runway adaptations', 'Mood boards', 'Style galleries'],
  },
  'build-wardrobe': {
    primaryCategories: ['capsule-wardrobe', 'wardrobe-tools', 'style-tips'],
    secondaryCategories: ['shopping-deals', 'color-matching'],
    aiPromptEnhancement: 'Provide strategic wardrobe-building guidance focusing on versatile pieces, investment items, and gap analysis. Help create a cohesive, functional wardrobe with maximum outfit combinations.',
    contentPriority: ['Wardrobe essentials', 'Capsule guides', 'Investment pieces', 'Mix-and-match tips', 'Wardrobe audits', 'Seasonal transitions'],
  },
  'special-events': {
    primaryCategories: ['special-occasion', 'outfit-ideas', 'shopping-deals'],
    secondaryCategories: ['color-matching', 'influencer-inspiration'],
    aiPromptEnhancement: 'Focus on occasion-specific styling for events like weddings, parties, dates, galas, and celebrations. Provide complete outfit solutions including accessories, grooming tips, and dress codes.',
    contentPriority: ['Wedding guest looks', 'Party outfits', 'Date night styles', 'Formal wear', 'Holiday looks', 'Event dress codes'],
  },
  'professional-image': {
    primaryCategories: ['professional-looks', 'style-tips', 'wardrobe-tools'],
    secondaryCategories: ['capsule-wardrobe', 'color-matching'],
    aiPromptEnhancement: 'Emphasize workplace-appropriate styling that projects competence and confidence. Cover business casual, formal, and industry-specific dress codes. Include interview preparation and executive presence.',
    contentPriority: ['Work wardrobe essentials', 'Interview outfits', 'Business casual guides', 'Executive style', 'Industry dress codes', 'Polished professional looks'],
  },
};

const GENERAL_CATEGORIES: ContentCategory[] = [
  'trending-styles',
  'influencer-inspiration',
  'style-tips',
  'outfit-ideas',
];

class ContentPersonalizationService {
  
  getPersonalizedFeedConfig(
    goals: DripnGoal[],
    preferences?: Partial<ExtendedPreferences>,
    gender?: Gender
  ): PersonalizedFeedConfig {
    const primaryCategories = new Set<ContentCategory>();
    const secondaryCategories = new Set<ContentCategory>();
    const aiPromptEnhancements: string[] = [];
    const weights: ContentWeight[] = [];

    if (goals.length === 0) {
      return this.getDefaultConfig();
    }

    goals.forEach((goal, index) => {
      const mapping = GOAL_CONTENT_MAPPING[goal];
      const priorityMultiplier = 1 - (index * 0.1);
      
      mapping.primaryCategories.forEach(cat => {
        primaryCategories.add(cat);
        weights.push({
          category: cat,
          weight: 1.0 * priorityMultiplier,
          priority: 'high',
        });
      });
      
      mapping.secondaryCategories.forEach(cat => {
        if (!primaryCategories.has(cat)) {
          secondaryCategories.add(cat);
        }
        weights.push({
          category: cat,
          weight: 0.6 * priorityMultiplier,
          priority: 'medium',
        });
      });
      
      aiPromptEnhancements.push(mapping.aiPromptEnhancement);
    });

    const generalCategories = GENERAL_CATEGORIES.filter(
      cat => !primaryCategories.has(cat) && !secondaryCategories.has(cat)
    );

    return {
      primaryCategories: Array.from(primaryCategories),
      secondaryCategories: Array.from(secondaryCategories),
      generalCategories,
      weights: this.consolidateWeights(weights),
      aiPromptEnhancements,
      feedRatio: {
        goalRelated: 0.7,
        general: 0.3,
      },
    };
  }

  private consolidateWeights(weights: ContentWeight[]): ContentWeight[] {
    const consolidated = new Map<ContentCategory, ContentWeight>();
    
    weights.forEach(w => {
      const existing = consolidated.get(w.category);
      if (existing) {
        consolidated.set(w.category, {
          category: w.category,
          weight: Math.min(existing.weight + w.weight * 0.5, 1.5),
          priority: existing.priority === 'high' || w.priority === 'high' ? 'high' : 'medium',
        });
      } else {
        consolidated.set(w.category, w);
      }
    });
    
    return Array.from(consolidated.values())
      .sort((a, b) => b.weight - a.weight);
  }

  private getDefaultConfig(): PersonalizedFeedConfig {
    return {
      primaryCategories: ['style-tips', 'outfit-ideas', 'trending-styles'],
      secondaryCategories: ['influencer-inspiration', 'shopping-deals'],
      generalCategories: GENERAL_CATEGORIES,
      weights: [
        { category: 'style-tips', weight: 0.8, priority: 'medium' },
        { category: 'outfit-ideas', weight: 0.8, priority: 'medium' },
        { category: 'trending-styles', weight: 0.7, priority: 'medium' },
        { category: 'influencer-inspiration', weight: 0.6, priority: 'low' },
        { category: 'shopping-deals', weight: 0.5, priority: 'low' },
      ],
      aiPromptEnhancements: ['Provide balanced fashion advice covering style, trends, and inspiration.'],
      feedRatio: {
        goalRelated: 0.5,
        general: 0.5,
      },
    };
  }

  generateAISystemPrompt(
    goals: DripnGoal[],
    stylistName: string,
    gender?: Gender,
    preferences?: Partial<ExtendedPreferences>
  ): string {
    const config = this.getPersonalizedFeedConfig(goals, preferences, gender);
    
    const goalDescriptions = goals.map(goal => {
      const mapping = GOAL_CONTENT_MAPPING[goal];
      return `- ${this.getGoalDisplayName(goal)}: ${mapping.aiPromptEnhancement}`;
    }).join('\n');

    const priorityContent = goals.flatMap(goal => 
      GOAL_CONTENT_MAPPING[goal].contentPriority.slice(0, 3)
    );

    let prompt = `You are ${stylistName}, an AI personal stylist for Dripn.

## CRITICAL: Member Goals (MUST Address)
This member has the following personal goals that MUST be prioritized in every interaction:
${goalDescriptions}

## Content Priorities Based on Goals
Always prioritize these types of content and advice:
${priorityContent.map(p => `- ${p}`).join('\n')}

## Feed Composition
- 70% of content should directly support member's stated goals
- 30% general fashion content for a comprehensive experience

## Personalization Rules
1. Every recommendation should connect back to at least one member goal
2. When suggesting outfits, explain HOW it helps achieve their goals
3. Proactively offer goal-relevant tips even if not explicitly asked
4. Track and celebrate progress toward their style goals
5. Balance goal-focused content with discovery of new styles

`;

    if (preferences?.favoriteShops && preferences.favoriteShops.length > 0) {
      prompt += `\n## Member's Favorite Shops
When suggesting where to shop, prioritize: ${preferences.favoriteShops.join(', ')}
For unknown shops, research their style aesthetic to give relevant recommendations.
`;
    }

    if (gender) {
      prompt += `\n## Gender Context
Tailor all advice for ${gender === 'man' ? 'men\'s' : gender === 'woman' ? 'women\'s' : 'gender-neutral'} fashion.
`;
    }

    return prompt;
  }

  getContentRecommendations(
    goals: DripnGoal[],
    limit: number = 20
  ): { category: ContentCategory; count: number }[] {
    const config = this.getPersonalizedFeedConfig(goals);
    const recommendations: { category: ContentCategory; count: number }[] = [];
    
    const goalRelatedCount = Math.round(limit * config.feedRatio.goalRelated);
    const generalCount = limit - goalRelatedCount;
    
    const sortedPrimary = config.weights
      .filter(w => w.priority === 'high')
      .sort((a, b) => b.weight - a.weight);
    
    let remaining = goalRelatedCount;
    sortedPrimary.forEach((w, index) => {
      const count = Math.max(1, Math.round(remaining * (w.weight / sortedPrimary.reduce((sum, x) => sum + x.weight, 0))));
      recommendations.push({ category: w.category, count: Math.min(count, remaining) });
      remaining -= count;
    });
    
    const generalPerCategory = Math.ceil(generalCount / config.generalCategories.length);
    config.generalCategories.forEach(cat => {
      recommendations.push({ category: cat, count: generalPerCategory });
    });
    
    return recommendations;
  }

  getGoalDisplayName(goal: DripnGoal): string {
    const names: Record<DripnGoal, string> = {
      'dress-better': 'Dress Better',
      'meet-people': 'Meet People',
      'find-offers': 'Find Deals',
      'get-inspired': 'Get Inspired',
      'build-wardrobe': 'Build Wardrobe',
      'special-events': 'Special Events',
      'professional-image': 'Professional Image',
    };
    return names[goal] || goal;
  }

  getGoalDescription(goal: DripnGoal): string {
    const descriptions: Record<DripnGoal, string> = {
      'dress-better': 'Personalized tips to elevate your daily style',
      'meet-people': 'Connect with fashion enthusiasts and attend events',
      'find-offers': 'Exclusive deals and budget-friendly recommendations',
      'get-inspired': 'Curated looks and trending styles just for you',
      'build-wardrobe': 'Strategic guidance for a versatile closet',
      'special-events': 'Perfect outfits for every occasion',
      'professional-image': 'Polished looks that command respect',
    };
    return descriptions[goal] || '';
  }

  getActiveGoalFeatures(goals: DripnGoal[]): {
    showDeals: boolean;
    showEvents: boolean;
    showCommunity: boolean;
    showWardrobeTools: boolean;
    showProfessionalSection: boolean;
    showOccasionPlanner: boolean;
    showStyleTips: boolean;
    showInspiration: boolean;
  } {
    return {
      showDeals: goals.includes('find-offers'),
      showEvents: goals.includes('meet-people') || goals.includes('special-events'),
      showCommunity: goals.includes('meet-people'),
      showWardrobeTools: goals.includes('build-wardrobe'),
      showProfessionalSection: goals.includes('professional-image'),
      showOccasionPlanner: goals.includes('special-events'),
      showStyleTips: goals.includes('dress-better') || goals.includes('professional-image'),
      showInspiration: goals.includes('get-inspired'),
    };
  }

  generateWelcomeMessage(goals: DripnGoal[], stylistName: string, memberName: string): string {
    if (goals.length === 0) {
      return `Welcome ${memberName}! I'm ${stylistName}, and I'm here to help you discover your perfect style. Let's explore what fashion can do for you!`;
    }

    const goalFocus = goals.map(g => this.getGoalDisplayName(g).toLowerCase()).join(', ');
    const primaryGoal = goals[0];
    
    const goalMessages: Record<DripnGoal, string> = {
      'dress-better': `helping you elevate your everyday style with practical, confidence-boosting tips`,
      'meet-people': `connecting you with amazing fashion enthusiasts and exciting style events`,
      'find-offers': `finding you the best deals and budget-smart fashion choices`,
      'get-inspired': `curating stunning looks and fresh style ideas just for you`,
      'build-wardrobe': `building your dream wardrobe with strategic, versatile pieces`,
      'special-events': `making you shine at every special occasion`,
      'professional-image': `crafting a powerful professional presence through style`,
    };

    return `Welcome ${memberName}! I'm ${stylistName}, and I'm thrilled to focus on ${goalMessages[primaryGoal]}. Your goals are my priority – let's make ${goalFocus} happen together!`;
  }

  shouldShowContent(
    contentCategory: ContentCategory,
    goals: DripnGoal[],
    isGeneral: boolean = false
  ): { show: boolean; priority: 'high' | 'medium' | 'low' } {
    if (goals.length === 0) {
      return { show: true, priority: 'medium' };
    }

    const config = this.getPersonalizedFeedConfig(goals);
    
    if (config.primaryCategories.includes(contentCategory)) {
      return { show: true, priority: 'high' };
    }
    
    if (config.secondaryCategories.includes(contentCategory)) {
      return { show: true, priority: 'medium' };
    }
    
    if (isGeneral || config.generalCategories.includes(contentCategory)) {
      return { show: true, priority: 'low' };
    }
    
    return { show: Math.random() < 0.3, priority: 'low' };
  }
}

export default new ContentPersonalizationService();
