export interface MagazineInspiration {
  id: string;
  publication: string;
  publicationType: "music" | "lifestyle" | "fashion";
  issueDate: string;
  featuredName: string;
  featuredType: "artist" | "celebrity" | "model" | "athlete";
  headline: string;
  styleHighlights: string[];
  keyPieces: string[];
  brands: string[];
  mood: string;
  gender: "male" | "female" | "unisex";
  region: string;
  imageDescription: string;
  tierAccess: "free" | "premium";
}

const MUSIC_MAGAZINE_INSPIRATIONS: MagazineInspiration[] = [
  {
    id: "music-1",
    publication: "Rolling Stone",
    publicationType: "music",
    issueDate: "December 2025",
    featuredName: "Beyoncé",
    featuredType: "artist",
    headline: "Country Couture: Renaissance Tour Style",
    styleHighlights: [
      "Western-inspired glamour with rhinestone cowboy boots",
      "Custom Balmain silver fringe bodysuit",
      "Statement cowboy hats with crystal embellishments",
      "Layered silver chain accessories"
    ],
    keyPieces: ["Fringe jacket", "Cowboy boots", "Wide-brim hat", "Statement belt"],
    brands: ["Balmain", "Christian Louboutin", "Stetson", "Chrome Hearts"],
    mood: "Bold country-glam fusion",
    gender: "female",
    region: "Global",
    imageDescription: "Beyoncé in silver western-inspired ensemble",
    tierAccess: "free",
  },
  {
    id: "music-2",
    publication: "NME",
    publicationType: "music",
    issueDate: "November 2025",
    featuredName: "Bad Bunny",
    featuredType: "artist",
    headline: "Breaking Fashion Rules: Streetwear Meets High Fashion",
    styleHighlights: [
      "Oversized vintage band tees paired with tailored trousers",
      "Bold colorblock sneakers as statement pieces",
      "Layered gold chains and chunky rings",
      "Retro sunglasses with colored lenses"
    ],
    keyPieces: ["Vintage tee", "Wide-leg trousers", "Statement sneakers", "Layered jewelry"],
    brands: ["Jacquemus", "Nike", "Balenciaga", "Cartier"],
    mood: "Effortlessly cool streetwear",
    gender: "male",
    region: "Global",
    imageDescription: "Bad Bunny in colorful streetwear ensemble",
    tierAccess: "free",
  },
  {
    id: "music-3",
    publication: "Billboard",
    publicationType: "music",
    issueDate: "December 2025",
    featuredName: "Dua Lipa",
    featuredType: "artist",
    headline: "Y2K Revival: Disco Pop Princess",
    styleHighlights: [
      "Low-rise flared jeans with butterfly belt",
      "Cropped halter tops in metallic fabrics",
      "Platform boots for height and drama",
      "Tiny sunglasses and hair clips"
    ],
    keyPieces: ["Flared jeans", "Halter top", "Platform boots", "Mini bag"],
    brands: ["Versace", "Blumarine", "Miu Miu", "Fendi"],
    mood: "Nostalgic Y2K glamour",
    gender: "female",
    region: "Global",
    imageDescription: "Dua Lipa in retro Y2K inspired look",
    tierAccess: "premium",
  },
  {
    id: "music-4",
    publication: "Mixmag",
    publicationType: "music",
    issueDate: "December 2025",
    featuredName: "Fred Again..",
    featuredType: "artist",
    headline: "Rave Ready: Underground Electronic Style",
    styleHighlights: [
      "Oversized vintage sportswear and tracksuits",
      "Utility vests with multiple pockets",
      "Chunky headphones as accessory",
      "Beat-up sneakers for authenticity"
    ],
    keyPieces: ["Track jacket", "Cargo pants", "Utility vest", "Retro trainers"],
    brands: ["Adidas", "Carhartt WIP", "Stone Island", "New Balance"],
    mood: "Authentic underground rave culture",
    gender: "male",
    region: "UK",
    imageDescription: "Fred Again.. in vintage sportswear",
    tierAccess: "premium",
  },
  {
    id: "music-5",
    publication: "Vibe",
    publicationType: "music",
    issueDate: "November 2025",
    featuredName: "SZA",
    featuredType: "artist",
    headline: "Earth Goddess: Natural Beauty Meets Fashion",
    styleHighlights: [
      "Flowing maxi dresses in earthy tones",
      "Natural fiber textures - linen, cotton, hemp",
      "Stacked wooden and beaded jewelry",
      "Bare feet or simple leather sandals"
    ],
    keyPieces: ["Maxi dress", "Wooden jewelry", "Headwrap", "Leather sandals"],
    brands: ["Cult Gaia", "Johanna Ortiz", "Brother Vellies", "Khiry"],
    mood: "Bohemian earth goddess",
    gender: "female",
    region: "Global",
    imageDescription: "SZA in flowing earth-toned ensemble",
    tierAccess: "premium",
  },
  {
    id: "music-6",
    publication: "Q Magazine",
    publicationType: "music",
    issueDate: "December 2025",
    featuredName: "Central Cee",
    featuredType: "artist",
    headline: "London Drill Style: Street Luxury",
    styleHighlights: [
      "Designer puffer jackets in bold colors",
      "Luxury tracksuits with subtle branding",
      "Diamond-encrusted watches and chains",
      "Fresh white trainers always"
    ],
    keyPieces: ["Puffer jacket", "Designer tracksuit", "Diamond chain", "White sneakers"],
    brands: ["Moncler", "Trapstar", "Amiri", "Jordan"],
    mood: "Street luxury meets drill culture",
    gender: "male",
    region: "UK",
    imageDescription: "Central Cee in designer streetwear",
    tierAccess: "premium",
  },
  {
    id: "music-7",
    publication: "Fader",
    publicationType: "music",
    issueDate: "October 2025",
    featuredName: "Ice Spice",
    featuredType: "artist",
    headline: "Bronx Barbie: Bold and Unapologetic",
    styleHighlights: [
      "Body-hugging mini dresses in bright colors",
      "Signature orange curls as style statement",
      "Oversized hoop earrings",
      "Platform heels for maximum height"
    ],
    keyPieces: ["Mini dress", "Hoop earrings", "Platform heels", "Body chain"],
    brands: ["Fashion Nova", "Mugler", "Giuseppe Zanotti", "Dior"],
    mood: "Bold Bronx glamour",
    gender: "female",
    region: "North America",
    imageDescription: "Ice Spice in vibrant mini dress",
    tierAccess: "free",
  },
  {
    id: "music-8",
    publication: "XXL",
    publicationType: "music",
    issueDate: "November 2025",
    featuredName: "Travis Scott",
    featuredType: "artist",
    headline: "Cactus Jack: Desert Apocalypse Aesthetic",
    styleHighlights: [
      "Distressed denim with custom patches",
      "Oversized graphic hoodies",
      "Tactical boots and military-inspired pieces",
      "Brown and earth tone color palette"
    ],
    keyPieces: ["Distressed jeans", "Graphic hoodie", "Tactical boots", "Snapback cap"],
    brands: ["Cactus Jack", "Nike", "Dior", "Helmut Lang"],
    mood: "Post-apocalyptic desert vibes",
    gender: "male",
    region: "North America",
    imageDescription: "Travis Scott in distressed streetwear",
    tierAccess: "premium",
  },
];

const LIFESTYLE_MAGAZINE_INSPIRATIONS: MagazineInspiration[] = [
  {
    id: "lifestyle-1",
    publication: "Vogue",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Zendaya",
    featuredType: "celebrity",
    headline: "Hollywood's Style Chameleon",
    styleHighlights: [
      "Architectural silhouettes that command attention",
      "Vintage Hollywood glamour with modern edge",
      "Unexpected color combinations",
      "Statement accessories as conversation starters"
    ],
    keyPieces: ["Structured blazer", "Midi skirt", "Statement earrings", "Pointed heels"],
    brands: ["Valentino", "Loewe", "Bulgari", "Jimmy Choo"],
    mood: "Red carpet ready sophistication",
    gender: "female",
    region: "Global",
    imageDescription: "Zendaya in architectural Valentino gown",
    tierAccess: "free",
  },
  {
    id: "lifestyle-2",
    publication: "GQ",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Timothée Chalamet",
    featuredType: "celebrity",
    headline: "The New Romantic: Soft Masculinity",
    styleHighlights: [
      "Flowing shirts with romantic ruffles",
      "Slim-cut suits in unexpected colors",
      "Mixing vintage with contemporary pieces",
      "Minimal jewelry - one statement ring"
    ],
    keyPieces: ["Silk shirt", "Slim trousers", "Chelsea boots", "Signet ring"],
    brands: ["Haider Ackermann", "Celine", "Saint Laurent", "Cartier"],
    mood: "Poetic romantic masculinity",
    gender: "male",
    region: "Global",
    imageDescription: "Timothée Chalamet in flowing silk ensemble",
    tierAccess: "free",
  },
  {
    id: "lifestyle-3",
    publication: "Elle",
    publicationType: "lifestyle",
    issueDate: "November 2025",
    featuredName: "Sydney Sweeney",
    featuredType: "celebrity",
    headline: "All-American Beauty: Modern Glamour",
    styleHighlights: [
      "Figure-flattering silhouettes",
      "Classic color palette - black, white, red",
      "Old Hollywood waves with modern styling",
      "Understated luxury accessories"
    ],
    keyPieces: ["Little black dress", "Pearl earrings", "Structured clutch", "Strappy heels"],
    brands: ["Miu Miu", "Tiffany & Co", "Bottega Veneta", "Gianvito Rossi"],
    mood: "Timeless American glamour",
    gender: "female",
    region: "North America",
    imageDescription: "Sydney Sweeney in classic LBD",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-4",
    publication: "Esquire",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Jacob Elordi",
    featuredType: "celebrity",
    headline: "The Modern Leading Man",
    styleHighlights: [
      "Perfectly tailored double-breasted suits",
      "Classic white t-shirt and jeans done right",
      "Vintage-inspired sunglasses",
      "Quality leather accessories"
    ],
    keyPieces: ["Double-breasted suit", "White tee", "Leather belt", "Loafers"],
    brands: ["Bottega Veneta", "Tom Ford", "Persol", "Church's"],
    mood: "Classic masculine elegance",
    gender: "male",
    region: "Global",
    imageDescription: "Jacob Elordi in tailored suit",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-5",
    publication: "Harper's Bazaar",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Hailey Bieber",
    featuredType: "celebrity",
    headline: "Clean Girl Aesthetic: Elevated Basics",
    styleHighlights: [
      "Monochromatic neutral outfits",
      "Oversized blazers with bike shorts",
      "Slicked-back hair and dewy skin",
      "Minimal gold jewelry"
    ],
    keyPieces: ["Oversized blazer", "Bodysuit", "Wide-leg trousers", "Gold hoops"],
    brands: ["The Row", "Khaite", "Jennifer Fisher", "Bottega Veneta"],
    mood: "Effortlessly polished minimalism",
    gender: "female",
    region: "Global",
    imageDescription: "Hailey Bieber in neutral toned outfit",
    tierAccess: "free",
  },
  {
    id: "lifestyle-6",
    publication: "Men's Health",
    publicationType: "lifestyle",
    issueDate: "November 2025",
    featuredName: "Michael B. Jordan",
    featuredType: "celebrity",
    headline: "Fit and Fashionable: Athleisure Elevated",
    styleHighlights: [
      "Tailored joggers that look polished",
      "Fitted performance fabrics in neutral tones",
      "Luxury sneakers as everyday wear",
      "Minimal watches with leather straps"
    ],
    keyPieces: ["Tailored joggers", "Fitted polo", "Luxury sneakers", "Sport watch"],
    brands: ["Loro Piana", "Nike", "IWC", "Common Projects"],
    mood: "Athletic luxury lifestyle",
    gender: "male",
    region: "North America",
    imageDescription: "Michael B. Jordan in elevated athleisure",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-7",
    publication: "Tatler",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Lady Kitty Spencer",
    featuredType: "celebrity",
    headline: "British Aristocracy: Modern Royal Style",
    styleHighlights: [
      "Midi dresses with modest necklines",
      "Heritage British brands mixed with Italian luxury",
      "Statement headwear for events",
      "Classic pearls with a modern twist"
    ],
    keyPieces: ["Midi dress", "Fascinator", "Pearl necklace", "Block heels"],
    brands: ["Dolce & Gabbana", "Erdem", "Philip Treacy", "Asprey"],
    mood: "Modern aristocratic elegance",
    gender: "female",
    region: "UK",
    imageDescription: "Lady Kitty Spencer in elegant midi dress",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-8",
    publication: "Country Life",
    publicationType: "lifestyle",
    issueDate: "November 2025",
    featuredName: "David Beckham",
    featuredType: "celebrity",
    headline: "Gentleman Farmer: Countryside Sophistication",
    styleHighlights: [
      "Waxed jackets and heritage tweeds",
      "Quality wellington boots",
      "Flat caps and countryside accessories",
      "Earth tones and heritage patterns"
    ],
    keyPieces: ["Waxed jacket", "Tweed blazer", "Wellington boots", "Flat cap"],
    brands: ["Barbour", "Holland & Holland", "Hunter", "Lock & Co"],
    mood: "British countryside gentleman",
    gender: "male",
    region: "UK",
    imageDescription: "David Beckham in countryside attire",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-9",
    publication: "Cosmopolitan",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Doja Cat",
    featuredType: "artist",
    headline: "Bold Self-Expression: Fashion as Art",
    styleHighlights: [
      "Avant-garde pieces that push boundaries",
      "Bold makeup as part of the outfit",
      "Unexpected texture combinations",
      "Head-to-toe themed looks"
    ],
    keyPieces: ["Statement bodysuit", "Platform boots", "Dramatic coat", "Bold accessories"],
    brands: ["Schiaparelli", "Iris van Herpen", "Marni", "Chrome Hearts"],
    mood: "Fearless creative expression",
    gender: "female",
    region: "Global",
    imageDescription: "Doja Cat in avant-garde ensemble",
    tierAccess: "premium",
  },
  {
    id: "lifestyle-10",
    publication: "Vanity Fair",
    publicationType: "lifestyle",
    issueDate: "December 2025",
    featuredName: "Ryan Gosling",
    featuredType: "celebrity",
    headline: "Ken Energy: Pink is the New Power Color",
    styleHighlights: [
      "Pastel suiting in unexpected colors",
      "Relaxed tailoring with vintage flair",
      "Aviator sunglasses as signature",
      "Mixing casual with formal effortlessly"
    ],
    keyPieces: ["Pastel suit", "Open-collar shirt", "Aviator sunglasses", "Loafers"],
    brands: ["Gucci", "Celine", "Ray-Ban", "Tod's"],
    mood: "Confident playful masculinity",
    gender: "male",
    region: "Global",
    imageDescription: "Ryan Gosling in pastel pink suit",
    tierAccess: "premium",
  },
];

class MagazineInspirationServiceClass {
  private allInspirations: MagazineInspiration[] = [
    ...MUSIC_MAGAZINE_INSPIRATIONS,
    ...LIFESTYLE_MAGAZINE_INSPIRATIONS,
  ];

  getAllInspirations(): MagazineInspiration[] {
    return this.allInspirations;
  }

  getByPublicationType(type: "music" | "lifestyle" | "fashion"): MagazineInspiration[] {
    return this.allInspirations.filter(item => item.publicationType === type);
  }

  getMusicInspirations(): MagazineInspiration[] {
    return MUSIC_MAGAZINE_INSPIRATIONS;
  }

  getLifestyleInspirations(): MagazineInspiration[] {
    return LIFESTYLE_MAGAZINE_INSPIRATIONS;
  }

  getByGender(gender: "male" | "female"): MagazineInspiration[] {
    return this.allInspirations.filter(
      item => item.gender === gender || item.gender === "unisex"
    );
  }

  getByRegion(region: string): MagazineInspiration[] {
    return this.allInspirations.filter(
      item => item.region === "Global" || item.region.toLowerCase().includes(region.toLowerCase())
    );
  }

  getByTier(tier: "free" | "premium"): MagazineInspiration[] {
    const tierHierarchy = { free: 0, premium: 1 };
    const userTierLevel = tierHierarchy[tier];
    return this.allInspirations.filter(
      item => tierHierarchy[item.tierAccess] <= userTierLevel
    );
  }

  getFilteredInspirations(
    gender: "male" | "female",
    tier: "free" | "premium",
    type?: "music" | "lifestyle" | "fashion"
  ): MagazineInspiration[] {
    let results = this.getByGender(gender);
    
    const tierHierarchy = { free: 0, premium: 1 };
    const userTierLevel = tierHierarchy[tier];
    results = results.filter(item => tierHierarchy[item.tierAccess] <= userTierLevel);
    
    if (type) {
      results = results.filter(item => item.publicationType === type);
    }
    
    return results;
  }

  getRandomInspiration(gender: "male" | "female", tier: "free" | "premium"): MagazineInspiration | null {
    const available = this.getFilteredInspirations(gender, tier);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  getFeaturedInspirations(limit: number = 4): MagazineInspiration[] {
    const freeItems = this.allInspirations.filter(item => item.tierAccess === "free");
    return freeItems.slice(0, limit);
  }
}

export const MagazineInspirationService = new MagazineInspirationServiceClass();
