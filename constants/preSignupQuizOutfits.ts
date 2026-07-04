import { ImageSourcePropType } from 'react-native';
import type { DressFor } from '@/services/OnboardingProfileService';

export type QuizOutfitGender = 'female' | 'male';
export type EventType = 'formal' | 'semi-formal' | 'smart-casual' | 'festival';

export const QUIZ_DECK_SIZE = 5;
export const EVENT_QUIZ_DECK_SIZE = 6;

export interface PreSignupQuizOutfit {
  id: string;
  gender: QuizOutfitGender;
  /** Occasions this look belongs in — must match onboarding dressFor */
  dressFor: DressFor[];
  /** For event looks — formal gala through festival */
  eventType?: EventType;
  image: ImageSourcePropType;
  name: string;
  style: string;
  occasion: string;
  items: { name: string; category: string }[];
}

export const PRE_SIGNUP_QUIZ_OUTFITS: PreSignupQuizOutfit[] = [
  // —— WORK / MEETINGS ——
  {
    id: 'work_f_1',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/female/african.png'),
    name: 'Polished Office',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Tailored Blouse', category: 'tops' },
      { name: 'Ankle Pants', category: 'bottoms' },
      { name: 'Pointed Flats', category: 'shoes' },
    ],
  },
  {
    id: 'work_f_2',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/female/asian.png'),
    name: 'Meeting Ready',
    style: 'Business',
    occasion: 'Work',
    items: [
      { name: 'Structured Blazer', category: 'outerwear' },
      { name: 'Silk Camisole', category: 'tops' },
      { name: 'Slim Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'work_f_3',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Creative Professional',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Wrap Dress', category: 'dresses' },
      { name: 'Statement Belt', category: 'accessories' },
      { name: 'Block Heels', category: 'shoes' },
    ],
  },
  {
    id: 'work_f_4',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Blazer & Denim Desk',
    style: 'Business Casual',
    occasion: 'Work',
    items: [
      { name: 'Oversized Blazer', category: 'outerwear' },
      { name: 'High-Waisted Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_1',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/business/male/african.png'),
    name: 'Executive Suit',
    style: 'Business',
    occasion: 'Work',
    items: [
      { name: 'Slim Fit Suit', category: 'outerwear' },
      { name: 'Crisp White Shirt', category: 'tops' },
      { name: 'Leather Oxfords', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_2',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/business/male/asian.png'),
    name: 'Power Meeting',
    style: 'Business',
    occasion: 'Work',
    items: [
      { name: 'Double-Breasted Blazer', category: 'outerwear' },
      { name: 'Silk Tie', category: 'accessories' },
      { name: 'Dress Shoes', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_3',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/business/male/middle-eastern.png'),
    name: 'Boardroom Sharp',
    style: 'Business',
    occasion: 'Work',
    items: [
      { name: 'Three-Piece Suit', category: 'outerwear' },
      { name: 'Pocket Square', category: 'accessories' },
      { name: 'Oxford Shoes', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_4',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/male/african.png'),
    name: 'Modern Office',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Button-Down Shirt', category: 'tops' },
      { name: 'Chinos', category: 'bottoms' },
      { name: 'Leather Loafers', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_5',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/male/middle-eastern.png'),
    name: 'Client Lunch',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Knit Sweater', category: 'tops' },
      { name: 'Dark Trousers', category: 'bottoms' },
      { name: 'Chelsea Boots', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_6',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Smart Desk Casual',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Oxford Shirt', category: 'tops' },
      { name: 'Chinos', category: 'bottoms' },
      { name: 'Loafers', category: 'shoes' },
    ],
  },

  // —— DATE / ROMANCE ——
  {
    id: 'date_f_1',
    gender: 'female',
    dressFor: ['date'],
    image: require('../assets/images/celebrity-looks/elegant_evening_slip_dress.png'),
    name: 'Evening Romance',
    style: 'Luxury',
    occasion: 'Date',
    items: [
      { name: 'Satin Slip Dress', category: 'dresses' },
      { name: 'Strappy Heels', category: 'shoes' },
    ],
  },
  {
    id: 'date_f_2',
    gender: 'female',
    dressFor: ['date'],
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Dinner Date',
    style: 'Smart Casual',
    occasion: 'Date',
    items: [
      { name: 'Wrap Dress', category: 'dresses' },
      { name: 'Block Heels', category: 'shoes' },
    ],
  },
  {
    id: 'date_f_3',
    gender: 'female',
    dressFor: ['date'],
    image: require('../assets/images/styles/smart-casual/female/asian.png'),
    name: 'Effortless Allure',
    style: 'Chic',
    occasion: 'Date',
    items: [
      { name: 'Silk Camisole', category: 'tops' },
      { name: 'Slim Trousers', category: 'bottoms' },
      { name: 'Heeled Mules', category: 'shoes' },
    ],
  },
  {
    id: 'date_f_4',
    gender: 'female',
    dressFor: ['date'],
    image: require('../assets/images/styles/boho/female/asian.png'),
    name: 'Soft Romantic',
    style: 'Boho',
    occasion: 'Date',
    items: [
      { name: 'Flowing Midi Dress', category: 'dresses' },
      { name: 'Delicate Jewellery', category: 'accessories' },
    ],
  },
  {
    id: 'date_m_1',
    gender: 'male',
    dressFor: ['date'],
    image: require('../assets/images/celebrity-looks/elegant_evening_formal_male.png'),
    name: 'Date Night Sharp',
    style: 'Classic',
    occasion: 'Date',
    items: [
      { name: 'Tailored Blazer', category: 'outerwear' },
      { name: 'Dress Shirt', category: 'tops' },
      { name: 'Oxford Shoes', category: 'shoes' },
    ],
  },
  {
    id: 'date_m_2',
    gender: 'male',
    dressFor: ['date'],
    image: require('../assets/images/styles/smart-casual/male/asian.png'),
    name: 'Relaxed Charm',
    style: 'Smart Casual',
    occasion: 'Date',
    items: [
      { name: 'Polo Shirt', category: 'tops' },
      { name: 'Tailored Trousers', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'date_m_3',
    gender: 'male',
    dressFor: ['date'],
    image: require('../assets/images/styles/smart-casual/male/middle-eastern.png'),
    name: 'Wine Bar Ready',
    style: 'Smart Casual',
    occasion: 'Date',
    items: [
      { name: 'Knit Sweater', category: 'tops' },
      { name: 'Dark Jeans', category: 'bottoms' },
      { name: 'Chelsea Boots', category: 'shoes' },
    ],
  },
  {
    id: 'date_m_4',
    gender: 'male',
    dressFor: ['date'],
    image: require('../assets/images/styles/business/male/asian.png'),
    name: 'Dressed to Impress',
    style: 'Business',
    occasion: 'Date',
    items: [
      { name: 'Blazer', category: 'outerwear' },
      { name: 'Silk Tie', category: 'accessories' },
      { name: 'Dress Shoes', category: 'shoes' },
    ],
  },

  // —— FRIENDS / GOING OUT ——
  {
    id: 'friends_f_1',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Night Out Chic',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Oversized Blazer', category: 'outerwear' },
      { name: 'High-Waisted Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_f_2',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look.png'),
    name: 'Brunch Casual',
    style: 'Sporty',
    occasion: 'Going out',
    items: [
      { name: 'Matching Set', category: 'activewear' },
      { name: 'Chunky Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_f_3',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/styles/sporty/female/african.png'),
    name: 'Weekend Energy',
    style: 'Sporty',
    occasion: 'Going out',
    items: [
      { name: 'Crop Top', category: 'tops' },
      { name: 'High-Waist Leggings', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_f_4',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/styles/sporty/female/latin-american.png'),
    name: 'Bar Hopping',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Crop Tank', category: 'tops' },
      { name: 'Cargo Pants', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_f_5',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/styles/boho/female/african.png'),
    name: 'Festival Friends',
    style: 'Boho',
    occasion: 'Going out',
    items: [
      { name: 'Flowing Maxi Dress', category: 'dresses' },
      { name: 'Layered Necklaces', category: 'accessories' },
    ],
  },
  {
    id: 'friends_m_1',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look_male.png'),
    name: 'Weekend Cool',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Hoodie', category: 'tops' },
      { name: 'Cargo Pants', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_m_2',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Street Night',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Graphic Tee', category: 'tops' },
      { name: 'Baggy Jeans', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_m_3',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/styles/smart-casual/male/african.png'),
    name: 'Pub Ready',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Bomber Jacket', category: 'outerwear' },
      { name: 'Distressed Denim', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_m_4',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/styles/sporty/male/nordic.png'),
    name: 'Casual Crew',
    style: 'Sporty',
    occasion: 'Going out',
    items: [
      { name: 'Performance Hoodie', category: 'tops' },
      { name: 'Joggers', category: 'bottoms' },
    ],
  },
  {
    id: 'friends_m_5',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Concert Fit',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Vintage Jacket', category: 'outerwear' },
      { name: 'Wide Trousers', category: 'bottoms' },
    ],
  },

  // —— EVENT / SPECIAL OCCASION (formal → theatre → festival) ——
  {
    id: 'event_f_1',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'formal',
    image: require('../assets/images/celebrity-looks/elegant_evening_slip_dress.png'),
    name: 'Gala Glamour',
    style: 'Luxury',
    occasion: 'Formal gala',
    items: [
      { name: 'Satin Slip Dress', category: 'dresses' },
      { name: 'Strappy Heels', category: 'shoes' },
    ],
  },
  {
    id: 'event_f_2',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'semi-formal',
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Cocktail Hour',
    style: 'Chic',
    occasion: 'Cocktail party',
    items: [
      { name: 'Wrap Dress', category: 'dresses' },
      { name: 'Block Heels', category: 'shoes' },
    ],
  },
  {
    id: 'event_f_3',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/smart-casual/female/asian.png'),
    name: 'Theatre Night',
    style: 'Smart Casual',
    occasion: 'Theatre / arts',
    items: [
      { name: 'Structured Blazer', category: 'outerwear' },
      { name: 'Silk Camisole', category: 'tops' },
      { name: 'Slim Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'event_f_4',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/boho/female/south-asian.png'),
    name: 'Gallery Opening',
    style: 'Creative',
    occasion: 'Art opening',
    items: [
      { name: 'Printed Kimono', category: 'outerwear' },
      { name: 'Linen Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'event_f_5',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/smart-casual/female/african.png'),
    name: 'Garden Party',
    style: 'Smart Casual',
    occasion: 'Outdoor event',
    items: [
      { name: 'Tailored Blouse', category: 'tops' },
      { name: 'Ankle Pants', category: 'bottoms' },
    ],
  },
  {
    id: 'event_f_6',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/styles/boho/female/african.png'),
    name: 'Festival Spirit',
    style: 'Boho',
    occasion: 'Festival',
    items: [
      { name: 'Flowing Maxi Dress', category: 'dresses' },
      { name: 'Layered Jewellery', category: 'accessories' },
    ],
  },
  {
    id: 'event_f_7',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/styles/boho/female/latin-american.png'),
    name: 'Summer Fest',
    style: 'Boho',
    occasion: 'Outdoor festival',
    items: [
      { name: 'Printed Midi Dress', category: 'dresses' },
      { name: 'Wedge Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'event_f_8',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Concert Night',
    style: 'Streetwear',
    occasion: 'Live music',
    items: [
      { name: 'Statement Blazer', category: 'outerwear' },
      { name: 'High-Waisted Jeans', category: 'bottoms' },
    ],
  },
  {
    id: 'event_m_1',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'formal',
    image: require('../assets/images/celebrity-looks/elegant_evening_formal_male.png'),
    name: 'Black Tie',
    style: 'Classic',
    occasion: 'Formal gala',
    items: [
      { name: 'Tailored Blazer', category: 'outerwear' },
      { name: 'Dress Shirt', category: 'tops' },
    ],
  },
  {
    id: 'event_m_2',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'formal',
    image: require('../assets/images/styles/business/male/african.png'),
    name: 'Wedding Guest',
    style: 'Business',
    occasion: 'Wedding',
    items: [
      { name: 'Slim Fit Suit', category: 'outerwear' },
      { name: 'Leather Oxfords', category: 'shoes' },
    ],
  },
  {
    id: 'event_m_3',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'semi-formal',
    image: require('../assets/images/styles/business/male/asian.png'),
    name: 'Awards Night',
    style: 'Business',
    occasion: 'Ceremony',
    items: [
      { name: 'Double-Breasted Blazer', category: 'outerwear' },
      { name: 'Silk Tie', category: 'accessories' },
    ],
  },
  {
    id: 'event_m_4',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/smart-casual/male/middle-eastern.png'),
    name: 'Theatre Smart',
    style: 'Smart Casual',
    occasion: 'Theatre / arts',
    items: [
      { name: 'Knit Sweater', category: 'tops' },
      { name: 'Dark Trousers', category: 'bottoms' },
      { name: 'Chelsea Boots', category: 'shoes' },
    ],
  },
  {
    id: 'event_m_5',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/smart-casual/male/african.png'),
    name: 'Cocktail Lounge',
    style: 'Smart Casual',
    occasion: 'Cocktail party',
    items: [
      { name: 'Button-Down Shirt', category: 'tops' },
      { name: 'Chinos', category: 'bottoms' },
      { name: 'Leather Loafers', category: 'shoes' },
    ],
  },
  {
    id: 'event_m_6',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/smart-casual/male/asian.png'),
    name: 'Summer Soirée',
    style: 'Smart Casual',
    occasion: 'Garden party',
    items: [
      { name: 'Linen Shirt', category: 'tops' },
      { name: 'Tailored Shorts', category: 'bottoms' },
    ],
  },
  {
    id: 'event_m_7',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/styles/streetwear/male/multicultural.png'),
    name: 'Festival Fit',
    style: 'Streetwear',
    occasion: 'Festival',
    items: [
      { name: 'Vintage Jacket', category: 'outerwear' },
      { name: 'Wide Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'event_m_8',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/styles/boho/male/african.png'),
    name: 'Outdoor Fest',
    style: 'Boho',
    occasion: 'Outdoor festival',
    items: [
      { name: 'Linen Shirt', category: 'tops' },
      { name: 'Drawstring Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'event_m_9',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'festival',
    image: require('../assets/images/styles/streetwear/male/asian.png'),
    name: 'Concert Crew',
    style: 'Streetwear',
    occasion: 'Live music',
    items: [
      { name: 'Bomber Jacket', category: 'outerwear' },
      { name: 'Distressed Denim', category: 'bottoms' },
    ],
  },

  // —— JUST FOR ME TODAY ——
  {
    id: 'myself_f_1',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look.png'),
    name: 'Cosy Athleisure',
    style: 'Sporty',
    occasion: 'Everyday',
    items: [
      { name: 'Matching Set', category: 'activewear' },
      { name: 'Chunky Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'myself_f_2',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/styles/boho/female/african.png'),
    name: 'Easy Boho',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Flowing Maxi Dress', category: 'dresses' },
      { name: 'Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'myself_f_3',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/styles/boho/female/asian.png'),
    name: 'Soft Layers',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Linen Shirt', category: 'tops' },
      { name: 'Wide Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_f_4',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/styles/sporty/female/nordic.png'),
    name: 'Off-Duty Comfort',
    style: 'Sporty',
    occasion: 'Everyday',
    items: [
      { name: 'Oversized Sweatshirt', category: 'tops' },
      { name: 'Soft Joggers', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_f_5',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Elevated Errands',
    style: 'Smart Casual',
    occasion: 'Everyday',
    items: [
      { name: 'Blazer', category: 'outerwear' },
      { name: 'Jeans', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_m_1',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look_male.png'),
    name: 'Loungewear Luxe',
    style: 'Sporty',
    occasion: 'Everyday',
    items: [
      { name: 'Hoodie', category: 'tops' },
      { name: 'Joggers', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_m_2',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/boho/male/african.png'),
    name: 'Relaxed Wander',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Linen Shirt', category: 'tops' },
      { name: 'Drawstring Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_m_3',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Weekend Ease',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Knit Cardigan', category: 'outerwear' },
      { name: 'Chinos', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_m_4',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/smart-casual/male/asian.png'),
    name: 'Coffee Run',
    style: 'Smart Casual',
    occasion: 'Everyday',
    items: [
      { name: 'Polo Shirt', category: 'tops' },
      { name: 'Shorts', category: 'bottoms' },
    ],
  },
  {
    id: 'myself_m_5',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/sporty/male/nordic.png'),
    name: 'Home to Street',
    style: 'Sporty',
    occasion: 'Everyday',
    items: [
      { name: 'Tech Fleece', category: 'tops' },
      { name: 'Track Pants', category: 'bottoms' },
    ],
  },
];

export function getQuizDeckSize(dressFor?: DressFor): number {
  return dressFor === 'event' ? EVENT_QUIZ_DECK_SIZE : QUIZ_DECK_SIZE;
}

/** Stable key for deduping bundled images (require() resolves to a number). */
export function getOutfitImageKey(outfit: PreSignupQuizOutfit): string | number {
  const { image } = outfit;
  if (typeof image === 'number') return image;
  if (typeof image === 'object' && image !== null && 'uri' in image && image.uri) {
    return image.uri;
  }
  return outfit.id;
}

/** Build a deck with no duplicate photos; backfills from pool when preferred order repeats an image. */
export function fillUniqueImageDeck(
  preferred: PreSignupQuizOutfit[],
  pool: PreSignupQuizOutfit[],
  maxSize: number,
): PreSignupQuizOutfit[] {
  const picked: PreSignupQuizOutfit[] = [];
  const seenImages = new Set<string | number>();
  const seenIds = new Set<string>();

  const tryAdd = (outfit: PreSignupQuizOutfit): boolean => {
    if (seenIds.has(outfit.id)) return false;
    const key = getOutfitImageKey(outfit);
    if (seenImages.has(key)) return false;
    picked.push(outfit);
    seenIds.add(outfit.id);
    seenImages.add(key);
    return true;
  };

  for (const outfit of preferred) {
    if (picked.length >= maxSize) break;
    tryAdd(outfit);
  }

  if (picked.length < maxSize) {
    for (const outfit of pool) {
      if (picked.length >= maxSize) break;
      tryAdd(outfit);
    }
  }

  return picked;
}

export function dedupeOutfitsByImage(
  outfits: PreSignupQuizOutfit[],
  maxSize?: number,
): PreSignupQuizOutfit[] {
  return fillUniqueImageDeck(outfits, outfits, maxSize ?? outfits.length);
}

export function getPreSignupQuizOutfits(
  gender: QuizOutfitGender,
  dressFor?: DressFor,
): PreSignupQuizOutfit[] {
  let list = PRE_SIGNUP_QUIZ_OUTFITS.filter((outfit) => outfit.gender === gender);
  if (dressFor) {
    list = list.filter((outfit) => outfit.dressFor.includes(dressFor));
  }
  return list;
}

export function pickDiverseEventDeck(
  outfits: PreSignupQuizOutfit[],
  maxSize = EVENT_QUIZ_DECK_SIZE,
): PreSignupQuizOutfit[] {
  const types: EventType[] = ['formal', 'semi-formal', 'smart-casual', 'festival'];
  const preferred: PreSignupQuizOutfit[] = [];
  const used = new Set<string>();

  for (const eventType of types) {
    const match = outfits.find((o) => o.eventType === eventType && !used.has(o.id));
    if (match) {
      preferred.push(match);
      used.add(match.id);
    }
  }

  for (const outfit of outfits) {
    if (preferred.length >= maxSize) break;
    if (!used.has(outfit.id)) {
      preferred.push(outfit);
      used.add(outfit.id);
    }
  }

  return fillUniqueImageDeck(preferred, outfits, maxSize);
}

export function orderQuizDeck(
  outfits: PreSignupQuizOutfit[],
  orderedIds?: string[],
  maxSize = QUIZ_DECK_SIZE,
): PreSignupQuizOutfit[] {
  const byId = new Map(outfits.map((o) => [o.id, o]));
  const preferred: PreSignupQuizOutfit[] = [];

  if (orderedIds?.length) {
    for (const id of orderedIds) {
      const outfit = byId.get(id);
      if (outfit) preferred.push(outfit);
    }
  }

  for (const outfit of outfits) {
    if (!preferred.find((o) => o.id === outfit.id)) {
      preferred.push(outfit);
    }
  }

  return fillUniqueImageDeck(preferred, outfits, maxSize);
}
