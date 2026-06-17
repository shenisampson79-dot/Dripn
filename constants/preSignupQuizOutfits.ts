import { ImageSourcePropType } from 'react-native';

export interface PreSignupQuizOutfit {
  id: string;
  image: ImageSourcePropType;
  name: string;
  style: string;
  occasion: string;
  items: { name: string; category: string }[];
}

export const PRE_SIGNUP_QUIZ_OUTFITS: PreSignupQuizOutfit[] = [
  {
    id: 'quiz_1',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit.png'),
    name: 'Urban Street Style',
    style: 'Streetwear',
    occasion: 'Casual',
    items: [
      { name: 'Oversized Blazer', category: 'outerwear' },
      { name: 'High-Waisted Jeans', category: 'bottoms' },
      { name: 'White Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'quiz_2',
    image: require('../assets/images/celebrity-looks/elegant_evening_slip_dress.png'),
    name: 'Evening Elegance',
    style: 'Luxury',
    occasion: 'Formal',
    items: [
      { name: 'Satin Slip Dress', category: 'dresses' },
      { name: 'Strappy Heels', category: 'shoes' },
    ],
  },
  {
    id: 'quiz_3',
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look.png'),
    name: 'Athleisure Vibes',
    style: 'Sporty',
    occasion: 'Casual',
    items: [
      { name: 'Matching Set', category: 'activewear' },
      { name: 'Chunky Sneakers', category: 'shoes' },
    ],
  },
  {
    id: 'quiz_4',
    image: require('../assets/images/celebrity-looks/street_style_chic_outfit_male.png'),
    name: 'Smart Casual',
    style: 'Smart Casual',
    occasion: 'Work',
    items: [
      { name: 'Oxford Shirt', category: 'tops' },
      { name: 'Chinos', category: 'bottoms' },
      { name: 'Loafers', category: 'shoes' },
    ],
  },
  {
    id: 'quiz_5',
    image: require('../assets/images/celebrity-looks/elegant_evening_formal_male.png'),
    name: 'Sharp Formal',
    style: 'Classic',
    occasion: 'Event',
    items: [
      { name: 'Blazer', category: 'outerwear' },
      { name: 'Dress Trousers', category: 'bottoms' },
    ],
  },
  {
    id: 'quiz_6',
    image: require('../assets/images/celebrity-looks/trendy_athleisure_look_male.png'),
    name: 'Weekend Cool',
    style: 'Streetwear',
    occasion: 'Casual',
    items: [
      { name: 'Hoodie', category: 'tops' },
      { name: 'Cargo Pants', category: 'bottoms' },
    ],
  },
];
