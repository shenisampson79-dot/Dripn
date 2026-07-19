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
    name: 'Creative Office Denim',
    style: 'Business Casual',
    occasion: 'Work',
    items: [
      { name: 'Camel Blazer', category: 'outerwear' },
      { name: 'White Button-Down', category: 'tops' },
      { name: 'Dark Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'work_f_2',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/editorial-fullbody/female_work_formal_fullbody.png'),
    name: 'Meeting Ready',
    style: 'Business',
    occasion: 'Work',
    items: [
      { name: 'Charcoal Tailored Blazer', category: 'outerwear' },
      { name: 'Ivory Silk Blouse', category: 'tops' },
      { name: 'Matching Wide-Leg Trousers', category: 'bottoms' },
      { name: 'Black Leather Pumps', category: 'shoes' },
      { name: 'Structured Tote', category: 'bags' },
    ],
  },
  {
    id: 'work_f_3',
    gender: 'female',
    dressFor: ['work'],
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Olive Blazer Casual',
    style: 'Business Casual',
    occasion: 'Work',
    items: [
      { name: 'Olive Blazer', category: 'outerwear' },
      { name: 'Ivory Camisole', category: 'tops' },
      { name: 'Dark Skinny Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
      { name: 'Taupe Shoulder Bag', category: 'bags' },
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
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Creative Office Denim',
    style: 'Business Casual',
    occasion: 'Work',
    items: [
      { name: 'Black Denim Jacket', category: 'outerwear' },
      { name: 'White Crew-Neck Tee', category: 'tops' },
      { name: 'Black Slim Jeans', category: 'bottoms' },
      { name: 'White Leather Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'work_m_5',
    gender: 'male',
    dressFor: ['work'],
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Creative Studio',
    style: 'Artful Casual',
    occasion: 'Work',
    items: [
      { name: 'Printed Relaxed Shirt', category: 'tops' },
      { name: 'Brown Pleated Trousers', category: 'bottoms' },
      { name: 'Leather Sandals', category: 'shoes' },
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
    name: 'Relaxed Dinner',
    style: 'Elevated Casual',
    occasion: 'Date',
    items: [
      { name: 'Olive Blazer', category: 'outerwear' },
      { name: 'Ivory Camisole', category: 'tops' },
      { name: 'Dark Skinny Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
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
      { name: 'Beige Blazer', category: 'outerwear' },
      { name: 'White Camisole', category: 'tops' },
      { name: 'Black Slim Trousers', category: 'bottoms' },
      { name: 'White Canvas Sneakers', category: 'shoes' },
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
      { name: 'Printed Maxi Dress', category: 'dresses' },
      { name: 'Layered Necklaces', category: 'accessories' },
      { name: 'Flat Lace-Up Sandals', category: 'shoes' },
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
    image: require('../assets/images/editorial-fullbody/male_date_evening_fullbody.png'),
    name: 'Evening Sharp',
    style: 'Classic',
    occasion: 'Date',
    items: [
      { name: 'Black Tailored Blazer', category: 'outerwear' },
      { name: 'Black Turtleneck', category: 'tops' },
      { name: 'Charcoal Trousers', category: 'bottoms' },
      { name: 'Black Chelsea Boots', category: 'shoes' },
    ],
  },
  {
    id: 'date_m_3',
    gender: 'male',
    dressFor: ['date'],
    image: require('../assets/images/editorial-fullbody/male_footwear_led_fullbody.png'),
    name: 'Polished Casual',
    style: 'Smart Casual',
    occasion: 'Date',
    items: [
      { name: 'Cream Cable-Knit Sweater', category: 'tops' },
      { name: 'Olive Chinos', category: 'bottoms' },
      { name: 'Cognac Derby Shoes', category: 'shoes' },
      { name: 'Matching Leather Belt', category: 'accessories' },
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
  // Pure gym / sports-bra activewear must NEVER appear here — social occasions only.
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
      { name: 'White Tee', category: 'tops' },
      { name: 'High-Waisted Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_f_2',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/styles/smart-casual/female/middle-eastern.png'),
    name: 'Bar Hopping',
    style: 'Smart Casual',
    occasion: 'Going out',
    items: [
      { name: 'Olive Blazer', category: 'outerwear' },
      { name: 'Ivory Camisole', category: 'tops' },
      { name: 'Dark Skinny Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_f_3',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/styles/smart-casual/female/asian.png'),
    name: 'Weekend Energy',
    style: 'Smart Casual',
    occasion: 'Going out',
    items: [
      { name: 'Beige Blazer', category: 'outerwear' },
      { name: 'White Camisole', category: 'tops' },
      { name: 'Black Slim Trousers', category: 'bottoms' },
      { name: 'White Canvas Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_f_4',
    gender: 'female',
    dressFor: ['friends'],
    image: require('../assets/images/celebrity-looks/elegant_evening_slip_dress.png'),
    name: 'After Dark',
    style: 'Luxury',
    occasion: 'Going out',
    items: [
      { name: 'Satin Slip Dress', category: 'dresses' },
      { name: 'Strappy Heels', category: 'shoes' },
      { name: 'Layered Necklaces', category: 'accessories' },
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
      { name: 'Dashiki-Print Maxi Dress', category: 'dresses' },
      { name: 'Coordinating Headwrap', category: 'accessories' },
      { name: 'Layered Gold Jewellery', category: 'accessories' },
      { name: 'Flat Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'friends_m_1',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/styles/streetwear/male/african.png'),
    name: 'Weekend Cool',
    style: 'Streetwear',
    occasion: 'Going out',
    items: [
      { name: 'Crew-Neck Tee', category: 'tops' },
      { name: 'Slim Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
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
      { name: 'Denim Jacket', category: 'outerwear' },
      { name: 'White Tee', category: 'tops' },
      { name: 'Dark Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_m_3',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/editorial-fullbody/male_smart_casual_fullbody_navy.png'),
    name: 'Pub Ready',
    style: 'Smart Casual',
    occasion: 'Going out',
    items: [
      { name: 'Navy Blazer', category: 'outerwear' },
      { name: 'White Crew-Neck Tee', category: 'tops' },
      { name: 'Dark Slim Jeans', category: 'bottoms' },
      { name: 'Brown Leather Loafers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_m_4',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/editorial-fullbody/male_summer_tailoring_fullbody.png'),
    name: 'Drinks Ready',
    style: 'Smart Casual',
    occasion: 'Going out',
    items: [
      { name: 'Beige Linen Blazer', category: 'outerwear' },
      { name: 'White Open-Collar Shirt', category: 'tops' },
      { name: 'Sand Chinos', category: 'bottoms' },
      { name: 'Brown Suede Loafers', category: 'shoes' },
    ],
  },
  {
    id: 'friends_m_5',
    gender: 'male',
    dressFor: ['friends'],
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Artful Evening',
    style: 'Artful Casual',
    occasion: 'Going out',
    items: [
      { name: 'Printed Relaxed Shirt', category: 'tops' },
      { name: 'Brown Pleated Trousers', category: 'bottoms' },
      { name: 'Leather Sandals', category: 'shoes' },
    ],
  },

  // —— EVENT / SPECIAL OCCASION (formal → theatre → festival) ——
  {
    id: 'event_f_1',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'formal',
    image: require('../assets/images/editorial-fullbody/female_cocktail_fullbody.png'),
    name: 'Gala Glamour',
    style: 'Luxury',
    occasion: 'Formal gala',
    items: [
      { name: 'Black Satin Cocktail Dress', category: 'dresses' },
      { name: 'Strappy Heeled Sandals', category: 'shoes' },
      { name: 'Gold Jewellery', category: 'accessories' },
      { name: 'Clutch Bag', category: 'bags' },
    ],
  },
  {
    id: 'event_f_2',
    gender: 'female',
    dressFor: ['event'],
    eventType: 'semi-formal',
    image: require('../assets/images/editorial-fullbody/female_modest_midi_fullbody.png'),
    name: 'Garden Reception',
    style: 'Classic',
    occasion: 'Daytime reception',
    items: [
      { name: 'Cream Long-Sleeve Midi Dress', category: 'dresses' },
      { name: 'Beige Cardigan', category: 'outerwear' },
      { name: 'Pointed Leather Flats', category: 'shoes' },
      { name: 'Delicate Necklace', category: 'accessories' },
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
      { name: 'Beige Blazer', category: 'outerwear' },
      { name: 'White Camisole', category: 'tops' },
      { name: 'Black Slim Trousers', category: 'bottoms' },
      { name: 'White Canvas Sneakers', category: 'shoes' },
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
      { name: 'Camel Blazer', category: 'outerwear' },
      { name: 'White Button-Down', category: 'tops' },
      { name: 'Dark Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
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
      { name: 'Dashiki-Print Maxi Dress', category: 'dresses' },
      { name: 'Coordinating Headwrap', category: 'accessories' },
      { name: 'Layered Gold Jewellery', category: 'accessories' },
      { name: 'Flat Sandals', category: 'shoes' },
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
    image: require('../assets/images/styles/boho/male/asian.png'),
    name: 'Gallery Opening',
    style: 'Artful Casual',
    occasion: 'Gallery / arts',
    items: [
      { name: 'Printed Relaxed Shirt', category: 'tops' },
      { name: 'Brown Pleated Trousers', category: 'bottoms' },
      { name: 'Leather Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'event_m_5',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/styles/business/male/middle-eastern.png'),
    name: 'Cocktail Tailoring',
    style: 'Tailored',
    occasion: 'Cocktail party',
    items: [
      { name: 'Three-Piece Suit', category: 'formal' },
      { name: 'Dress Shirt', category: 'tops' },
      { name: 'Pocket Square', category: 'accessories' },
      { name: 'Dress Shoes', category: 'shoes' },
    ],
  },
  {
    id: 'event_m_6',
    gender: 'male',
    dressFor: ['event'],
    eventType: 'smart-casual',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Gallery Evening',
    style: 'Elevated Casual',
    occasion: 'Gallery / reception',
    items: [
      { name: 'Black Denim Jacket', category: 'outerwear' },
      { name: 'White Crew-Neck Tee', category: 'tops' },
      { name: 'Black Slim Jeans', category: 'bottoms' },
      { name: 'White Leather Sneakers', category: 'shoes' },
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
  // Pure gym / activewear belongs here (or Style Shuffle gym slots) — not friends/date/event.
  {
    id: 'myself_f_1',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look.png'),
    name: 'Gym Glow',
    style: 'Sporty',
    occasion: 'Gym',
    items: [
      { name: 'Matching Set', category: 'activewear' },
      { name: 'Zip Hoodie', category: 'outerwear' },
      { name: 'Training Sneakers', category: 'shoes' },
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
      { name: 'Dashiki-Print Maxi Dress', category: 'dresses' },
      { name: 'Coordinating Headwrap', category: 'accessories' },
      { name: 'Flat Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'myself_f_3',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/styles/boho/female/asian.png'),
    name: 'Printed Day Dress',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Printed Maxi Dress', category: 'dresses' },
      { name: 'Layered Necklaces', category: 'accessories' },
      { name: 'Flat Lace-Up Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'myself_f_4',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/styles/sporty/female/african.png'),
    name: 'Studio Session',
    style: 'Sporty',
    occasion: 'Workout',
    items: [
      { name: 'Sports Bra', category: 'tops' },
      { name: 'High-Waist Leggings', category: 'bottoms' },
      { name: 'Training Shoes', category: 'shoes' },
    ],
  },
  {
    id: 'myself_f_5',
    gender: 'female',
    dressFor: ['myself'],
    image: require('../assets/images/editorial-fullbody/female_weather_coat_fullbody.png'),
    name: 'City Weather Ready',
    style: 'Classic',
    occasion: 'Everyday',
    items: [
      { name: 'Camel Wool Coat', category: 'outerwear' },
      { name: 'Navy Turtleneck', category: 'tops' },
      { name: 'Dark Straight Jeans', category: 'bottoms' },
      { name: 'Brown Leather Ankle Boots', category: 'shoes' },
      { name: 'Leather Gloves', category: 'accessories' },
    ],
  },
  {
    id: 'myself_m_1',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look_male.png'),
    name: 'Gym Ready',
    style: 'Sporty',
    occasion: 'Gym',
    items: [
      { name: 'Performance Hoodie', category: 'tops' },
      { name: 'Tech Joggers', category: 'bottoms' },
      { name: 'Training Sneakers', category: 'shoes' },
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
    name: 'Relaxed Print',
    style: 'Boho',
    occasion: 'Everyday',
    items: [
      { name: 'Printed Relaxed Shirt', category: 'tops' },
      { name: 'Brown Pleated Trousers', category: 'bottoms' },
      { name: 'Leather Sandals', category: 'shoes' },
    ],
  },
  {
    id: 'myself_m_4',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/smart-casual/male/asian.png'),
    name: 'Navy Blazer Layer',
    style: 'Smart Casual',
    occasion: 'Everyday',
    items: [
      { name: 'Navy Blazer', category: 'outerwear' },
      { name: 'White Crew-Neck Tee', category: 'tops' },
    ],
  },
  {
    id: 'myself_m_5',
    gender: 'male',
    dressFor: ['myself'],
    image: require('../assets/images/styles/sporty/male/nordic.png'),
    name: 'Training Day',
    style: 'Sporty',
    occasion: 'Workout',
    items: [
      { name: 'Compression Tee', category: 'tops' },
      { name: 'Training Shorts', category: 'bottoms' },
      { name: 'Training Shoes', category: 'shoes' },
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
