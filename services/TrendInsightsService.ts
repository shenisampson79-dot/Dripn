/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

export interface FashionInfluencer {
  name: string;
  handle: string;
  platform: "instagram" | "tiktok" | "youtube";
  followers: string;
  specialty: string[];
  gender: "male" | "female";
}

export interface TrendingItem {
  name: string;
  category: string;
  description: string;
  brands: string[];
  priceRange: "budget" | "mid" | "luxury";
  hotLevel: 1 | 2 | 3 | 4 | 5;
}

export interface ColorTrend {
  name: string;
  hex: string;
  pantone?: string;
  season: "SS25" | "FW25" | "SS26" | "FW26";
  usage: string[];
}

export interface StyleMovement {
  name: string;
  description: string;
  keyPieces: string[];
  influences: string[];
  targetAudience: string[];
}

export interface RegionalTrends {
  region: string;
  countries: string[];
  maleInfluencers: FashionInfluencer[];
  femaleInfluencers: FashionInfluencer[];
  trendingItems: {
    male: TrendingItem[];
    female: TrendingItem[];
  };
  colorPalette: ColorTrend[];
  styleMovements: StyleMovement[];
  publications: {
    name: string;
    focus: string;
    gender: "male" | "female" | "unisex";
  }[];
  culturalNotes: string[];
  seasonalFocus: string;
}

export interface TrendInsight {
  id: string;
  title: string;
  description: string;
  region: string;
  gender: "male" | "female" | "unisex";
  category: string;
  source: string;
  date: string;
  tierAccess: "free" | "basic" | "premium" | "vip";
}

const UK_TRENDS: RegionalTrends = {
  region: "United Kingdom",
  countries: ["United Kingdom", "Ireland"],
  maleInfluencers: [
    {
      name: "David Gandy",
      handle: "@davidgandy_official",
      platform: "instagram",
      followers: "1.1M",
      specialty: ["Classic menswear", "Tailoring", "Luxury"],
      gender: "male",
    },
    {
      name: "Carl Thompson",
      handle: "@hawkinsandshepherd",
      platform: "instagram",
      followers: "450K",
      specialty: ["Smart casual", "British heritage", "Bespoke shirts"],
      gender: "male",
    },
    {
      name: "Tan France",
      handle: "@tanfrance",
      platform: "instagram",
      followers: "4.5M",
      specialty: ["Modern menswear", "Accessible style", "Streetwear fusion"],
      gender: "male",
    },
    {
      name: "Robert Sherwood",
      handle: "@therobertdaniel",
      platform: "instagram",
      followers: "380K",
      specialty: ["Preppy", "Old money aesthetic", "Country gentleman"],
      gender: "male",
    },
    {
      name: "Daniel Simmons",
      handle: "@whatmyboyfriendwore",
      platform: "instagram",
      followers: "520K",
      specialty: ["Everyday style", "High-low mixing", "Street style"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Alexa Chung",
      handle: "@alexachung",
      platform: "instagram",
      followers: "5.2M",
      specialty: ["British eclectic", "Vintage mixing", "Effortless cool"],
      gender: "female",
    },
    {
      name: "Monikh Dale",
      handle: "@monaborisova",
      platform: "instagram",
      followers: "890K",
      specialty: ["Minimal chic", "Investment dressing", "Quiet luxury"],
      gender: "female",
    },
    {
      name: "Camille Charriere",
      handle: "@camillecharriere",
      platform: "instagram",
      followers: "1.3M",
      specialty: ["French-British fusion", "Editorial style", "Accessories"],
      gender: "female",
    },
    {
      name: "Hannah Lewis",
      handle: "@hannahlewis",
      platform: "instagram",
      followers: "340K",
      specialty: ["Cottagecore", "Countryside chic", "Sustainable fashion"],
      gender: "female",
    },
    {
      name: "Patricia Bright",
      handle: "@thepatriciabright",
      platform: "youtube",
      followers: "2.8M",
      specialty: ["Bold prints", "Colour blocking", "African-British fusion"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Wax Cotton Jacket",
        category: "Outerwear",
        description: "Classic British heritage piece, now in contemporary cuts",
        brands: ["Barbour", "Belstaff", "Private White V.C."],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Knitted Polo Shirt",
        category: "Knitwear",
        description: "Retro-inspired knitted polos in neutral tones",
        brands: ["Sunspel", "John Smedley", "Orlebar Brown"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Wide-Leg Tailored Trousers",
        category: "Trousers",
        description: "Relaxed fit formal trousers replacing slim cuts",
        brands: ["Arket", "COS", "Margaret Howell"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Chunky Leather Loafers",
        category: "Footwear",
        description: "Platform-soled loafers with chunky aesthetic",
        brands: ["Grenson", "Church's", "G.H. Bass"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Cashmere Zip-Up Cardigan",
        category: "Knitwear",
        description: "Elevated casual layering piece",
        brands: ["N.Peal", "Johnstons of Elgin", "William Lockie"],
        priceRange: "luxury",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Oversized Blazer",
        category: "Tailoring",
        description: "Boxy, masculine-cut blazers in heritage fabrics",
        brands: ["The Frankie Shop", "Reiss", "Massimo Dutti"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Oversized Jumper",
        category: "Knitwear",
        description: "Chunky, relaxed-fit jumpers in quality wool and cashmere",
        brands: ["& Other Stories", "COS", "Arket", "Toast"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Wide-Leg Trousers",
        category: "Trousers",
        description: "Relaxed, baggy trousers replacing slim fits",
        brands: ["Toteme", "The Row", "COS", "Zara"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Oversized T-Shirt",
        category: "Basics",
        description: "Boxy, relaxed tees for effortless casual style",
        brands: ["The Frankie Shop", "Acne Studios", "Arket"],
        priceRange: "budget",
        hotLevel: 5,
      },
      {
        name: "Barrel Leg Jeans",
        category: "Denim",
        description: "Curved, voluminous leg replacing skinny jeans entirely",
        brands: ["Citizens of Humanity", "AGOLDE", "Toteme"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Quilted Jacket",
        category: "Outerwear",
        description: "Country-inspired quilted jackets in refined silhouettes",
        brands: ["Barbour", "Burberry", "Ganni"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Pointed Kitten Heels",
        category: "Footwear",
        description: "Low heels making a major comeback for comfort-chic",
        brands: ["Aeyde", "By Far", "Prada"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Cashmere Maxi Skirt",
        category: "Skirts",
        description: "Luxurious knitted skirts for elevated everyday",
        brands: ["Khaite", "Lisa Yang", "Extreme Cashmere"],
        priceRange: "luxury",
        hotLevel: 4,
      },
    ],
  },
  colorPalette: [
    { name: "British Racing Green", hex: "#004225", season: "FW25", usage: ["Outerwear", "Tailoring", "Accessories"] },
    { name: "Oatmeal", hex: "#E8DCD0", season: "SS26", usage: ["Knitwear", "Trousers", "Layering pieces"] },
    { name: "Burgundy Wine", hex: "#722F37", season: "FW25", usage: ["Tailoring", "Leather goods", "Knitwear"] },
    { name: "Slate Blue", hex: "#6A8EA0", season: "SS26", usage: ["Shirting", "Light jackets", "Accessories"] },
    { name: "Camel", hex: "#C19A6B", season: "FW25", usage: ["Coats", "Trousers", "Bags"] },
  ],
  styleMovements: [
    {
      name: "New Heritage",
      description: "Modern interpretation of classic British countryside style",
      keyPieces: ["Wax jackets", "Tweed blazers", "Leather boots", "Flat caps"],
      influences: ["Hunting attire", "Equestrian wear", "Country estates"],
      targetAudience: ["Young professionals", "Weekenders", "Style-conscious traditionalists"],
    },
    {
      name: "London Quiet Luxury",
      description: "Understated elegance with focus on quality over logos",
      keyPieces: ["Cashmere knits", "Tailored trousers", "Minimal leather goods"],
      influences: ["Old money", "Savile Row", "Scandi minimalism"],
      targetAudience: ["High earners", "Fashion insiders", "Minimalists"],
    },
  ],
  publications: [
    { name: "GQ UK", focus: "Contemporary menswear and lifestyle", gender: "male" },
    { name: "British Vogue", focus: "High fashion and culture", gender: "female" },
    { name: "Esquire UK", focus: "Classic menswear and culture", gender: "male" },
    { name: "Tatler", focus: "Society, luxury and heritage style", gender: "unisex" },
    { name: "The Gentlemans Journal", focus: "Refined mens lifestyle", gender: "male" },
  ],
  culturalNotes: [
    "British style emphasizes quality over quantity and heritage over trends",
    "Londoners mix high-street with designer more freely than other European capitals",
    "Country and city wardrobes remain distinctly separate for many Brits",
    "Vintage and second-hand shopping is deeply embedded in British fashion culture",
  ],
  seasonalFocus: "FW25 dominates with emphasis on layering, heritage fabrics, and weather-appropriate luxury",
};

const US_TRENDS: RegionalTrends = {
  region: "United States",
  countries: ["United States", "Canada"],
  maleInfluencers: [
    {
      name: "Blake Scott",
      handle: "@blakescott_",
      platform: "instagram",
      followers: "890K",
      specialty: ["Americana", "Workwear", "Heritage brands"],
      gender: "male",
    },
    {
      name: "Marcel Floruss",
      handle: "@onedapperstreet",
      platform: "instagram",
      followers: "1.2M",
      specialty: ["Smart casual", "Tailoring", "Accessible luxury"],
      gender: "male",
    },
    {
      name: "Denny Balmaceda",
      handle: "@dennybalmaceda",
      platform: "instagram",
      followers: "520K",
      specialty: ["Street style", "Sneaker culture", "LA casual"],
      gender: "male",
    },
    {
      name: "Adam Gallagher",
      handle: "@iamgalla",
      platform: "instagram",
      followers: "2.1M",
      specialty: ["Travel style", "Minimalism", "Elevated basics"],
      gender: "male",
    },
    {
      name: "Everett Williams",
      handle: "@everettwilliams",
      platform: "instagram",
      followers: "340K",
      specialty: ["Ivy League", "Preppy", "Old money aesthetic"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Aimee Song",
      handle: "@aimeesong",
      platform: "instagram",
      followers: "6.8M",
      specialty: ["LA lifestyle", "Bohemian luxury", "Effortless cool"],
      gender: "female",
    },
    {
      name: "Blair Eadie",
      handle: "@blaireadiebee",
      platform: "instagram",
      followers: "2.1M",
      specialty: ["Bold patterns", "Color mixing", "Statement accessories"],
      gender: "female",
    },
    {
      name: "Chriselle Lim",
      handle: "@chrisellelim",
      platform: "instagram",
      followers: "1.5M",
      specialty: ["Power dressing", "Modern feminine", "Asian-American perspective"],
      gender: "female",
    },
    {
      name: "Paola Alberdi",
      handle: "@blank_itinerary",
      platform: "instagram",
      followers: "780K",
      specialty: ["Latina glamour", "Red carpet", "Luxury fashion"],
      gender: "female",
    },
    {
      name: "Tyler Haney",
      handle: "@tylerhaney",
      platform: "instagram",
      followers: "420K",
      specialty: ["Athleisure", "Wellness fashion", "Active lifestyle"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Varsity Jacket",
        category: "Outerwear",
        description: "Collegiate-inspired jackets crossing into high fashion",
        brands: ["Golden Bear", "Saint Laurent", "Todd Snyder"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Wide Leg Chinos",
        category: "Trousers",
        description: "Relaxed fit cotton trousers in earth tones",
        brands: ["J.Crew", "Alex Mill", "Corridor"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Camp Collar Shirt",
        category: "Shirting",
        description: "Relaxed Cuban collar shirts in linen and silk",
        brands: ["Rag & Bone", "Theory", "Gitman Vintage"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "New Balance 990v6",
        category: "Footwear",
        description: "Dad sneaker aesthetic meets premium craftsmanship",
        brands: ["New Balance", "Asics", "Saucony"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Workwear Overshirt",
        category: "Outerwear",
        description: "Utility-inspired overshirts in heavy cotton",
        brands: ["Carhartt WIP", "Filson", "Iron Heart"],
        priceRange: "mid",
        hotLevel: 5,
      },
    ],
    female: [
      {
        name: "Matching Sets",
        category: "Co-ords",
        description: "Coordinated top and bottom sets for effortless styling",
        brands: ["Reformation", "Staud", "LPA"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Platform Sandals",
        category: "Footwear",
        description: "Chunky platform sandals in neutral leathers",
        brands: ["Chloé", "Naked Wolfe", "Steve Madden"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Sheer Layering",
        category: "Tops",
        description: "Transparent mesh and organza tops for layering",
        brands: ["Dion Lee", "Nensi Dojaka", "Aritzia"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Oversized Leather Tote",
        category: "Bags",
        description: "Large, unstructured totes replacing mini bags",
        brands: ["The Row", "Khaite", "Mansur Gavriel"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Athletic-Inspired Dresses",
        category: "Dresses",
        description: "Sporty details on feminine silhouettes",
        brands: ["Alo Yoga", "Outdoor Voices", "Girlfriend Collective"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
  },
  colorPalette: [
    { name: "Desert Sand", hex: "#EDC9AF", season: "SS26", usage: ["Suiting", "Casual wear", "Accessories"] },
    { name: "Ocean Navy", hex: "#003366", season: "FW25", usage: ["Tailoring", "Outerwear", "Denim"] },
    { name: "Terracotta", hex: "#E2725B", season: "SS26", usage: ["Casual wear", "Accessories", "Footwear"] },
    { name: "Forest", hex: "#228B22", season: "FW25", usage: ["Outerwear", "Knitwear", "Accessories"] },
    { name: "Butter Cream", hex: "#FFFDD0", season: "SS26", usage: ["Tops", "Dresses", "Trousers"] },
  ],
  styleMovements: [
    {
      name: "Coastal Cowboy",
      description: "Western influences meeting beach lifestyle",
      keyPieces: ["Cowboy boots", "Denim jackets", "Wide-brim hats", "Fringe details"],
      influences: ["Western heritage", "California coast", "Nashville scene"],
      targetAudience: ["Festival-goers", "Music lovers", "Boho enthusiasts"],
    },
    {
      name: "Clean Athleisure",
      description: "Elevated workout-to-brunch aesthetic",
      keyPieces: ["Matching sets", "Premium sneakers", "Cropped hoodies", "High-waist leggings"],
      influences: ["Wellness culture", "Pilates", "LA lifestyle"],
      targetAudience: ["Active women", "Wellness enthusiasts", "Urban professionals"],
    },
  ],
  publications: [
    { name: "GQ USA", focus: "Modern menswear and culture", gender: "male" },
    { name: "Vogue USA", focus: "High fashion and celebrity style", gender: "female" },
    { name: "WSJ Magazine", focus: "Luxury lifestyle and fashion", gender: "unisex" },
    { name: "Esquire", focus: "Classic American menswear", gender: "male" },
    { name: "Harpers Bazaar", focus: "Fashion-forward womens style", gender: "female" },
  ],
  culturalNotes: [
    "American style varies dramatically by coast - LA casual vs NYC polished",
    "Sneaker culture is deeply embedded in American fashion identity",
    "Athleisure is not just acceptable but expected in many social settings",
    "Size-inclusive fashion has made significant strides in the US market",
  ],
  seasonalFocus: "SS26 anticipation high with emphasis on transitional pieces and outdoor lifestyle",
};

const FRANCE_TRENDS: RegionalTrends = {
  region: "France",
  countries: ["France", "Belgium", "Switzerland"],
  maleInfluencers: [
    {
      name: "Hugo Jacomet",
      handle: "@parlorama",
      platform: "instagram",
      followers: "180K",
      specialty: ["Tailoring", "Sprezzatura", "Classic French elegance"],
      gender: "male",
    },
    {
      name: "Guillaume Bo",
      handle: "@guillaumebo",
      platform: "instagram",
      followers: "340K",
      specialty: ["Parisian casual", "Smart casual", "Effortless style"],
      gender: "male",
    },
    {
      name: "Kevin Carrero",
      handle: "@kevincarrero",
      platform: "instagram",
      followers: "420K",
      specialty: ["Street style", "Contemporary menswear", "Sneaker culture"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Jeanne Damas",
      handle: "@jeannedamas",
      platform: "instagram",
      followers: "1.8M",
      specialty: ["French girl style", "Effortless chic", "Rouje aesthetic"],
      gender: "female",
    },
    {
      name: "Sabina Socol",
      handle: "@sabinasocol",
      platform: "instagram",
      followers: "780K",
      specialty: ["Bold colors", "Vintage mixing", "Art-influenced fashion"],
      gender: "female",
    },
    {
      name: "Anne-Laure Mais",
      handle: "@adenorah",
      platform: "instagram",
      followers: "650K",
      specialty: ["Bohemian", "Sustainable fashion", "Natural beauty"],
      gender: "female",
    },
    {
      name: "Leia Sfez",
      handle: "@leiasfez",
      platform: "instagram",
      followers: "520K",
      specialty: ["Minimal chic", "Quality basics", "Parisian uniform"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Unstructured Blazer",
        category: "Tailoring",
        description: "Soft-shouldered, minimal construction for relaxed elegance",
        brands: ["AMI Paris", "Officine Generale", "De Fursac"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Breton Stripe Top",
        category: "Tops",
        description: "Timeless French mariniere in new proportions",
        brands: ["Saint James", "Armor Lux", "APC"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Suede Loafers",
        category: "Footwear",
        description: "Unlined suede loafers in tobacco and navy",
        brands: ["JM Weston", "Crockett & Jones", "Carmina"],
        priceRange: "luxury",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Midi Wrap Dress",
        category: "Dresses",
        description: "Flattering wrap silhouette in prints and solids",
        brands: ["Rouje", "Sezane", "Ba&sh"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Ballet Flats",
        category: "Footwear",
        description: "Classic ballerinas with modern updates",
        brands: ["Repetto", "Chanel", "Miu Miu"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Basket Bag",
        category: "Bags",
        description: "Woven straw and leather bags for year-round use",
        brands: ["Loewe", "Dragon Diffusion", "Hereu"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
  },
  colorPalette: [
    { name: "Marine", hex: "#1F3A5F", season: "SS26", usage: ["Tailoring", "Dresses", "Accessories"] },
    { name: "Rouge", hex: "#C41E3A", season: "FW25", usage: ["Lips", "Accessories", "Statement pieces"] },
    { name: "Ecru", hex: "#F5F5DC", season: "SS26", usage: ["Basics", "Knitwear", "Linen pieces"] },
    { name: "Noir", hex: "#1A1A1A", season: "FW25", usage: ["Foundation pieces", "Evening wear"] },
  ],
  styleMovements: [
    {
      name: "Nouvelle Parisienne",
      description: "Updated French girl aesthetic for 2025",
      keyPieces: ["Low-rise trousers", "Cropped cardigans", "Ballet flats", "Mini bags"],
      influences: ["90s supermodels", "French New Wave cinema", "Rive Gauche"],
      targetAudience: ["Young professionals", "Fashion enthusiasts", "Francophiles"],
    },
  ],
  publications: [
    { name: "Vogue Paris", focus: "French high fashion", gender: "female" },
    { name: "GQ France", focus: "French menswear and lifestyle", gender: "male" },
    { name: "LOfficiel", focus: "Fashion and culture", gender: "female" },
  ],
  culturalNotes: [
    "French style prioritizes timeless over trendy - buy less, buy better",
    "Effortlessness is key - clothes should never look too polished or try-hard",
    "Red lipstick and minimal accessories are the French womans secret weapons",
    "Quality leather goods are considered essential investments",
  ],
  seasonalFocus: "Transitional dressing between seasons is a French specialty",
};

const ITALY_TRENDS: RegionalTrends = {
  region: "Italy",
  countries: ["Italy"],
  maleInfluencers: [
    {
      name: "Mariano Di Vaio",
      handle: "@marianodivaio",
      platform: "instagram",
      followers: "6.5M",
      specialty: ["Italian elegance", "Tailoring", "Mediterranean lifestyle"],
      gender: "male",
    },
    {
      name: "Luca Rubinacci",
      handle: "@lucarubinacci",
      platform: "instagram",
      followers: "280K",
      specialty: ["Neapolitan tailoring", "Sprezzatura", "Bespoke menswear"],
      gender: "male",
    },
    {
      name: "Simone Marchetti",
      handle: "@simonemarchetti",
      platform: "instagram",
      followers: "340K",
      specialty: ["Milanese style", "Editorial fashion", "Contemporary tailoring"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Chiara Ferragni",
      handle: "@chiaraferragni",
      platform: "instagram",
      followers: "29M",
      specialty: ["Contemporary Italian", "Street style", "Luxury fashion"],
      gender: "female",
    },
    {
      name: "Beatrice Valli",
      handle: "@beatricevalli",
      platform: "instagram",
      followers: "3.1M",
      specialty: ["Italian glamour", "Family fashion", "Accessible luxury"],
      gender: "female",
    },
    {
      name: "Tamu McPherson",
      handle: "@tamumcpherson",
      platform: "instagram",
      followers: "520K",
      specialty: ["Editorial style", "Bold prints", "Global perspective"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Unlined Linen Blazer",
        category: "Tailoring",
        description: "Ultra-light summer blazers in natural linen",
        brands: ["Lardini", "Boglioli", "Isaia"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Penny Loafers",
        category: "Footwear",
        description: "Hand-stitched leather loafers worn sockless",
        brands: ["Santoni", "Moreschi", "Brunello Cucinelli"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Linen Trousers",
        category: "Trousers",
        description: "Relaxed linen pants in neutral tones",
        brands: ["Incotex", "PT Torino", "Canali"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Leather Midi Skirt",
        category: "Skirts",
        description: "Butter-soft leather in midi lengths",
        brands: ["Prada", "Max Mara", "Marni"],
        priceRange: "luxury",
        hotLevel: 4,
      },
      {
        name: "Architectural Heels",
        category: "Footwear",
        description: "Statement heels with sculptural details",
        brands: ["Fendi", "Bottega Veneta", "Jacquemus"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Cashmere Coat",
        category: "Outerwear",
        description: "Investment outerwear in camel and navy",
        brands: ["Max Mara", "Loro Piana", "Brunello Cucinelli"],
        priceRange: "luxury",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Terracotta", hex: "#E2725B", season: "SS26", usage: ["Casual wear", "Accessories"] },
    { name: "Mediterranean Blue", hex: "#007BA7", season: "SS26", usage: ["Shirting", "Swimwear"] },
    { name: "Espresso", hex: "#3C1414", season: "FW25", usage: ["Leather goods", "Tailoring"] },
    { name: "Limoncello", hex: "#FFF44F", season: "SS26", usage: ["Accents", "Accessories"] },
  ],
  styleMovements: [
    {
      name: "Italian Sprezzatura",
      description: "The art of studied nonchalance in dressing",
      keyPieces: ["Unstructured blazers", "Loafers without socks", "Rolled sleeves", "Pocket squares"],
      influences: ["Pitti Uomo", "Neapolitan tailoring", "La Dolce Vita"],
      targetAudience: ["Style connoisseurs", "Tailoring enthusiasts", "Mediterranean lovers"],
    },
  ],
  publications: [
    { name: "Vogue Italia", focus: "Italian high fashion", gender: "female" },
    { name: "GQ Italia", focus: "Italian menswear and lifestyle", gender: "male" },
    { name: "Corriere della Sera Moda", focus: "Fashion supplement", gender: "unisex" },
  ],
  culturalNotes: [
    "Italians dress for every occasion - casual is still polished",
    "Fit is everything - tailoring is not optional, it is expected",
    "Leather goods are an essential part of Italian identity",
    "Sunglasses are worn year-round as style accessories",
  ],
  seasonalFocus: "SS26 anticipation strong with Mediterranean influences and linen-centric wardrobes",
};

const CARIBBEAN_TRENDS: RegionalTrends = {
  region: "Caribbean",
  countries: ["Jamaica", "Trinidad and Tobago", "Bahamas", "Barbados", "Puerto Rico"],
  maleInfluencers: [
    {
      name: "Shaggy",
      handle: "@direalshaggy",
      platform: "instagram",
      followers: "1.8M",
      specialty: ["Caribbean casual", "Island style", "Music-influenced fashion"],
      gender: "male",
    },
    {
      name: "Machel Montano",
      handle: "@machelmontano",
      platform: "instagram",
      followers: "890K",
      specialty: ["Carnival style", "Bold prints", "Performance fashion"],
      gender: "male",
    },
    {
      name: "Sean Paul",
      handle: "@dutaboroking",
      platform: "instagram",
      followers: "2.1M",
      specialty: ["Dancehall fashion", "Streetwear", "Caribbean luxury"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Rihanna",
      handle: "@badgalriri",
      platform: "instagram",
      followers: "151M",
      specialty: ["Boundary-pushing style", "Barbadian pride", "Fashion innovation"],
      gender: "female",
    },
    {
      name: "Wendy Fitzwilliam",
      handle: "@wendyfitzwilliam",
      platform: "instagram",
      followers: "420K",
      specialty: ["Caribbean elegance", "Beauty queen style", "Sophisticated island fashion"],
      gender: "female",
    },
    {
      name: "Shenseea",
      handle: "@shaboroking",
      platform: "instagram",
      followers: "4.2M",
      specialty: ["Dancehall fashion", "Bold colours", "Jamaican street style"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Linen Set",
        category: "Co-ords",
        description: "Matching linen shirt and shorts/trousers",
        brands: ["Frescobol Carioca", "Orlebar Brown", "Tombolo"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Leather Sandals",
        category: "Footwear",
        description: "Quality leather sandals for island life",
        brands: ["Ancient Greek Sandals", "K Jacques", "Jerusalem Sandals"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Tropical Print Shirt",
        category: "Tops",
        description: "Bold botanical and fruit prints",
        brands: ["Casablanca", "Endless Joy", "Reyn Spooner"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Crochet Cover-Up",
        category: "Beachwear",
        description: "Hand-made crochet dresses and cover-ups",
        brands: ["Zimmermann", "Miguelina", "She Made Me"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Bold Print Maxi",
        category: "Dresses",
        description: "Floor-length dresses in Caribbean-inspired prints",
        brands: ["Farm Rio", "Johanna Ortiz", "Silvia Tcherassi"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Platform Espadrilles",
        category: "Footwear",
        description: "Woven platform shoes for beach to bar",
        brands: ["Castaner", "Paloma Barcelo", "Soludos"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
  },
  colorPalette: [
    { name: "Caribbean Blue", hex: "#1CA9C9", season: "SS26", usage: ["Everything - signature island colour"] },
    { name: "Mango", hex: "#FF8243", season: "SS26", usage: ["Prints", "Accessories", "Swimwear"] },
    { name: "Hibiscus Pink", hex: "#B6316C", season: "SS26", usage: ["Statement pieces", "Prints"] },
    { name: "Palm Green", hex: "#20B2AA", season: "SS26", usage: ["Resort wear", "Accessories"] },
    { name: "Sunset Gold", hex: "#FFD700", season: "SS26", usage: ["Jewelry", "Accents", "Carnival wear"] },
  ],
  styleMovements: [
    {
      name: "Caribbean Luxe",
      description: "Elevated island style blending resort with local heritage",
      keyPieces: ["Linen everything", "Tropical prints", "Gold jewelry", "Leather sandals"],
      influences: ["Island culture", "Carnival", "Resort lifestyle", "Dancehall"],
      targetAudience: ["Holidaymakers", "Locals with style", "Music scene"],
    },
  ],
  publications: [
    { name: "Caribbean Belle", focus: "Caribbean lifestyle and fashion", gender: "female" },
    { name: "Island Origins", focus: "Caribbean culture and style", gender: "unisex" },
  ],
  culturalNotes: [
    "Bold colours are not just accepted but expected in Caribbean fashion",
    "Carnival season influences fashion year-round with sequins and feathers",
    "Gold jewelry is a cultural staple and status symbol",
    "Comfort is key - fabrics must breathe in tropical heat",
  ],
  seasonalFocus: "Year-round summer focus with Carnival season (February-March) as the fashion peak",
};

const SOUTH_AFRICA_TRENDS: RegionalTrends = {
  region: "South Africa",
  countries: ["South Africa", "Namibia", "Botswana"],
  maleInfluencers: [
    {
      name: "Trevor Stuurman",
      handle: "@trevor_stuurman",
      platform: "instagram",
      followers: "280K",
      specialty: ["Afrofuturism", "Contemporary African", "Editorial style"],
      gender: "male",
    },
    {
      name: "Maps Maponyane",
      handle: "@mapsmaponyane",
      platform: "instagram",
      followers: "1.2M",
      specialty: ["African-inspired modern", "TV presenter style", "Accessible fashion"],
      gender: "male",
    },
    {
      name: "Zakes Bantwini",
      handle: "@zakesbantwini",
      platform: "instagram",
      followers: "650K",
      specialty: ["Afro-house style", "Music fashion", "Contemporary African"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Thuso Mbedu",
      handle: "@thaboroking",
      platform: "instagram",
      followers: "2.8M",
      specialty: ["Hollywood meets Africa", "Red carpet", "Rising global star"],
      gender: "female",
    },
    {
      name: "Bonang Matheba",
      handle: "@bonaboroking",
      platform: "instagram",
      followers: "5.2M",
      specialty: ["South African glamour", "TV style", "Luxury fashion"],
      gender: "female",
    },
    {
      name: "Sarah Langa",
      handle: "@sarahlaboroking",
      platform: "instagram",
      followers: "1.8M",
      specialty: ["Luxury lifestyle", "International fashion", "Influencer style"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "African Print Blazer",
        category: "Tailoring",
        description: "Contemporary blazers featuring African textiles",
        brands: ["Maxhosa", "Orange Culture", "Thebe Magugu"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Beaded Accessories",
        category: "Accessories",
        description: "Traditional beadwork in modern applications",
        brands: ["Pichulik", "Quazi Design", "Monkey Biz"],
        priceRange: "mid",
        hotLevel: 4,
      },
      {
        name: "Shweshwe Details",
        category: "Various",
        description: "Traditional South African fabric in contemporary designs",
        brands: ["MaXhosa", "David Tlale", "Laduma Ngxokolo"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Bold African Prints",
        category: "Various",
        description: "Statement pieces in African wax prints and textiles",
        brands: ["Thebe Magugu", "Rich Mnisi", "Christie Brown"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Structural Accessories",
        category: "Accessories",
        description: "Sculptural jewelry and bags from local designers",
        brands: ["Pichulik", "Skims Africa", "Okapi"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Contemporary Kaftan",
        category: "Dresses",
        description: "Updated kaftans for modern African woman",
        brands: ["Lisa Folawiyo", "Tiffany Amber", "Duro Olowu"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
  },
  colorPalette: [
    { name: "Ubuntu Orange", hex: "#F28500", season: "SS26", usage: ["Statement pieces", "Accessories"] },
    { name: "Safari Khaki", hex: "#C3B091", season: "FW25", usage: ["Outerwear", "Trousers"] },
    { name: "Shweshwe Indigo", hex: "#3F51B5", season: "SS26", usage: ["Traditional-inspired pieces"] },
    { name: "Kalahari Sand", hex: "#E6D2B8", season: "FW25", usage: ["Neutrals", "Basics"] },
    { name: "Protea Pink", hex: "#E75480", season: "SS26", usage: ["Feminine pieces", "Accessories"] },
  ],
  styleMovements: [
    {
      name: "Afrofuturism",
      description: "Blending African heritage with futuristic design",
      keyPieces: ["Geometric prints", "Metallic fabrics", "Bold silhouettes", "Traditional techniques"],
      influences: ["African art", "Technology", "Heritage crafts", "Global fashion"],
      targetAudience: ["Young creatives", "Global Africans", "Fashion-forward locals"],
    },
  ],
  publications: [
    { name: "Elle South Africa", focus: "South African fashion and lifestyle", gender: "female" },
    { name: "GQ South Africa", focus: "South African menswear", gender: "male" },
    { name: "Destiny Magazine", focus: "African business and style", gender: "unisex" },
  ],
  culturalNotes: [
    "South African fashion celebrates heritage while pushing boundaries",
    "Local designers like Thebe Magugu are gaining global recognition",
    "Rainbow nation diversity is reflected in eclectic style mixing",
    "Supporting local designers is a point of pride",
  ],
  seasonalFocus: "Seasons are reversed - FW25 coincides with local summer, SS26 with winter",
};

const NORDIC_TRENDS: RegionalTrends = {
  region: "Nordic",
  countries: ["Sweden", "Denmark", "Norway", "Finland", "Iceland"],
  maleInfluencers: [
    {
      name: "Jesper Bruun",
      handle: "@jesperbruun",
      platform: "instagram",
      followers: "180K",
      specialty: ["Scandi minimalism", "Quality basics", "Copenhagen style"],
      gender: "male",
    },
    {
      name: "Martin Leander",
      handle: "@martinleander",
      platform: "instagram",
      followers: "120K",
      specialty: ["Swedish menswear", "Smart casual", "Sustainable fashion"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Pernille Teisbaek",
      handle: "@pernilleteisbaek",
      platform: "instagram",
      followers: "1.2M",
      specialty: ["Scandi chic", "Fashion week regular", "Effortless layering"],
      gender: "female",
    },
    {
      name: "Jeanette Madsen",
      handle: "@jeanettemadsen",
      platform: "instagram",
      followers: "420K",
      specialty: ["Copenhagen fashion week", "Emerging designers", "Editorial style"],
      gender: "female",
    },
    {
      name: "Emili Sindlev",
      handle: "@emilisindlev",
      platform: "instagram",
      followers: "780K",
      specialty: ["Bold colour", "Statement accessories", "Danish street style"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Oversized Wool Coat",
        category: "Outerwear",
        description: "Voluminous coats in neutral tones",
        brands: ["Acne Studios", "Our Legacy", "Norse Projects"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Wide Leg Wool Trousers",
        category: "Trousers",
        description: "Relaxed tailoring in premium wool",
        brands: ["Filippa K", "COS", "Arket"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Chunky Platform Boots",
        category: "Footwear",
        description: "Practical yet stylish winter boots",
        brands: ["Ganni", "Eytys", "Vagabond"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Oversized Knitwear",
        category: "Knitwear",
        description: "Sculptural, voluminous knits",
        brands: ["Toteme", "Remain Birger Christensen", "Holzweiler"],
        priceRange: "mid",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Arctic White", hex: "#F0F0F0", season: "FW25", usage: ["Layering", "Knitwear"] },
    { name: "Nordic Grey", hex: "#808080", season: "FW25", usage: ["Foundation pieces", "Tailoring"] },
    { name: "Copenhagen Blue", hex: "#89CFF0", season: "SS26", usage: ["Statement pieces", "Accessories"] },
    { name: "Forest Moss", hex: "#8A9A5B", season: "FW25", usage: ["Outerwear", "Knitwear"] },
  ],
  styleMovements: [
    {
      name: "Scandi Minimalism 2.0",
      description: "Evolution of Nordic minimal style with subtle details",
      keyPieces: ["Oversized coats", "Wide trousers", "Quality knits", "Chunky boots"],
      influences: ["Functionality", "Climate", "Design heritage", "Sustainability"],
      targetAudience: ["Design lovers", "Minimalists", "Quality seekers"],
    },
  ],
  publications: [
    { name: "Scandinavian MIND", focus: "Nordic fashion and design", gender: "unisex" },
    { name: "Costume Magazine", focus: "Danish fashion", gender: "female" },
  ],
  culturalNotes: [
    "Function and form must work together - style never compromises comfort",
    "Sustainability is expected, not a bonus feature",
    "Neutral palettes dominate but bold accessories add personality",
    "Quality over quantity is the Nordic mantra",
  ],
  seasonalFocus: "FW25 is the main fashion season due to long, dark winters",
};

const MIDDLE_EAST_TRENDS: RegionalTrends = {
  region: "Middle East",
  countries: ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain"],
  maleInfluencers: [
    {
      name: "Fazza",
      handle: "@faboroking",
      platform: "instagram",
      followers: "16M",
      specialty: ["Royal style", "Emirati fashion", "Luxury menswear"],
      gender: "male",
    },
    {
      name: "Hatem Alakeel",
      handle: "@hatemaaboroking",
      platform: "instagram",
      followers: "420K",
      specialty: ["Saudi menswear", "Contemporary Middle Eastern", "Couture"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Huda Kattan",
      handle: "@hudaboroking",
      platform: "instagram",
      followers: "54M",
      specialty: ["Beauty and fashion", "Dubai lifestyle", "Middle Eastern glamour"],
      gender: "female",
    },
    {
      name: "Karen Wazen",
      handle: "@karenaboroking",
      platform: "instagram",
      followers: "8.2M",
      specialty: ["Lebanese-Dubai style", "Luxury fashion", "Modest fashion"],
      gender: "female",
    },
    {
      name: "Deena Aljuhani Abdulaziz",
      handle: "@deenaboroking",
      platform: "instagram",
      followers: "1.8M",
      specialty: ["Saudi fashion editor", "High fashion", "Modest luxury"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Modern Kandura",
        category: "Traditional",
        description: "Contemporary takes on traditional Gulf dress",
        brands: ["The Giving Movement", "Noon by Noor", "Bambah"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Luxury Sneakers",
        category: "Footwear",
        description: "High-end sneakers for casual luxury",
        brands: ["Balenciaga", "Gucci", "Louis Vuitton"],
        priceRange: "luxury",
        hotLevel: 5,
      },
    ],
    female: [
      {
        name: "Modest Evening Wear",
        category: "Eveningwear",
        description: "Glamorous gowns with modest coverage",
        brands: ["Elie Saab", "Zuhair Murad", "Tony Ward"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Designer Abaya",
        category: "Outerwear",
        description: "Luxury abayas from regional designers",
        brands: ["Hessa Falasi", "Marchesa Notte", "Oscar de la Renta"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Statement Bags",
        category: "Accessories",
        description: "Ultra-luxury handbags as status pieces",
        brands: ["Hermes", "Chanel", "Dior"],
        priceRange: "luxury",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Desert Gold", hex: "#D4AF37", season: "FW25", usage: ["Evening wear", "Accessories"] },
    { name: "Arabian Night", hex: "#1A1A2E", season: "FW25", usage: ["Abayas", "Evening wear"] },
    { name: "Oasis Green", hex: "#0BDA51", season: "SS26", usage: ["Statement pieces", "Accessories"] },
    { name: "Pearl White", hex: "#FDEEF4", season: "SS26", usage: ["Modest fashion", "Summer wear"] },
  ],
  styleMovements: [
    {
      name: "Luxury Modest",
      description: "High-end fashion meeting modest dressing requirements",
      keyPieces: ["Designer abayas", "Modest gowns", "Turban wraps", "Luxury accessories"],
      influences: ["Islamic tradition", "Global luxury", "Regional heritage"],
      targetAudience: ["Gulf elite", "Global modest fashion followers", "Luxury enthusiasts"],
    },
  ],
  publications: [
    { name: "Vogue Arabia", focus: "Middle Eastern high fashion", gender: "female" },
    { name: "GQ Middle East", focus: "Regional menswear", gender: "male" },
    { name: "Harper's Bazaar Arabia", focus: "Luxury and lifestyle", gender: "female" },
  ],
  culturalNotes: [
    "Luxury brands hold significant status in Gulf fashion",
    "Modest fashion is beautifully integrated with global trends",
    "Dubai Fashion Week is establishing the region on the global stage",
    "Traditional dress is worn with pride alongside international fashion",
  ],
  seasonalFocus: "FW25 aligns with cooler months (November-March) when outdoor events dominate",
};

const ASIA_TRENDS: RegionalTrends = {
  region: "East Asia",
  countries: ["Japan", "South Korea", "China", "Hong Kong", "Taiwan", "Singapore"],
  maleInfluencers: [
    {
      name: "Eugene Tong",
      handle: "@eugenetong",
      platform: "instagram",
      followers: "340K",
      specialty: ["Asian-American style", "Editorial fashion", "Street style"],
      gender: "male",
    },
    {
      name: "Yoyo Cao",
      handle: "@yoyoboraking",
      platform: "instagram",
      followers: "890K",
      specialty: ["Singaporean style", "Luxury fashion", "East meets West"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Irene Kim",
      handle: "@ireneisgood",
      platform: "instagram",
      followers: "2.8M",
      specialty: ["K-beauty crossover", "Seoul street style", "Colourful fashion"],
      gender: "female",
    },
    {
      name: "Aimee Sun",
      handle: "@aimeesaboroking",
      platform: "instagram",
      followers: "1.5M",
      specialty: ["Chinese luxury", "Fashion week", "High fashion"],
      gender: "female",
    },
    {
      name: "Yoyo Lu",
      handle: "@yoyoluboroking",
      platform: "instagram",
      followers: "780K",
      specialty: ["Shanghai street style", "Contemporary Chinese", "Editorial"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Oversized Tailoring",
        category: "Tailoring",
        description: "Boxy, architectural suiting from Asian designers",
        brands: ["Wooyoungmi", "Issey Miyake", "Feng Chen Wang"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Technical Outerwear",
        category: "Outerwear",
        description: "High-performance fabrics in minimal designs",
        brands: ["Descente", "Acronym", "Arc'teryx Veilance"],
        priceRange: "luxury",
        hotLevel: 5,
      },
    ],
    female: [
      {
        name: "K-Beauty Inspired Fashion",
        category: "Various",
        description: "Soft, feminine Korean aesthetic",
        brands: ["Mardi Mercredi", "Andersson Bell", "Ader Error"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Avant-Garde Japanese",
        category: "Various",
        description: "Architectural, deconstructed designs",
        brands: ["Comme des Garcons", "Yohji Yamamoto", "Sacai"],
        priceRange: "luxury",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Sakura Pink", hex: "#FFB7C5", season: "SS26", usage: ["Feminine pieces", "Accessories"] },
    { name: "Ink Black", hex: "#0A0A0A", season: "FW25", usage: ["Foundation pieces", "Japanese aesthetic"] },
    { name: "Jade Green", hex: "#00A86B", season: "SS26", usage: ["Statement pieces", "Chinese influence"] },
    { name: "Cloud White", hex: "#F5F5F5", season: "SS26", usage: ["Minimal pieces", "Korean aesthetic"] },
  ],
  styleMovements: [
    {
      name: "K-Wave Fashion",
      description: "Korean pop culture influence on global fashion",
      keyPieces: ["Oversized blazers", "Pleated skirts", "Bucket hats", "Chunky trainers"],
      influences: ["K-pop", "K-drama", "Seoul street style", "Beauty culture"],
      targetAudience: ["Youth market", "K-culture fans", "Trend seekers"],
    },
  ],
  publications: [
    { name: "Vogue Japan", focus: "Japanese high fashion", gender: "female" },
    { name: "Vogue Korea", focus: "Korean fashion and K-pop", gender: "female" },
    { name: "GQ Japan", focus: "Japanese menswear", gender: "male" },
    { name: "Vogue China", focus: "Chinese luxury fashion", gender: "female" },
  ],
  culturalNotes: [
    "K-pop idols are massive fashion influencers globally",
    "Japanese fashion ranges from streetwear to avant-garde haute couture",
    "Chinese consumers drive global luxury fashion sales",
    "Tech-wear and functionality are highly valued in Asian fashion",
  ],
  seasonalFocus: "SS26 aligns with major fashion weeks in Seoul, Tokyo, and Shanghai",
};

const SOUTH_ASIA_TRENDS: RegionalTrends = {
  region: "South Asia",
  countries: ["India", "Pakistan", "Bangladesh", "Sri Lanka"],
  maleInfluencers: [
    {
      name: "Karan Johar",
      handle: "@kaaboroking",
      platform: "instagram",
      followers: "13M",
      specialty: ["Bollywood fashion", "Statement pieces", "Indian glamour"],
      gender: "male",
    },
    {
      name: "Shahid Kapoor",
      handle: "@shahidboroking",
      platform: "instagram",
      followers: "48M",
      specialty: ["Contemporary Indian menswear", "Fitness fashion", "Red carpet"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Deepika Padukone",
      handle: "@deepikboroking",
      platform: "instagram",
      followers: "76M",
      specialty: ["Bollywood elegance", "International fashion", "Indian craftsmanship"],
      gender: "female",
    },
    {
      name: "Priyanka Chopra Jonas",
      handle: "@priyankaboroking",
      platform: "instagram",
      followers: "91M",
      specialty: ["Global Indian style", "Red carpet", "Cross-cultural fashion"],
      gender: "female",
    },
    {
      name: "Sonam Kapoor",
      handle: "@sonamboroking",
      platform: "instagram",
      followers: "35M",
      specialty: ["High fashion", "Experimental style", "Designer pieces"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Contemporary Bandhgala",
        category: "Formalwear",
        description: "Modern Indian jacket for weddings and events",
        brands: ["Sabyasachi", "Raghavendra Rathore", "Kunal Rawal"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Linen Kurta",
        category: "Traditional",
        description: "Breathable contemporary kurtas for everyday",
        brands: ["Fabindia", "Raw Mango", "Antar Agni"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Contemporary Saree",
        category: "Traditional",
        description: "Modern draping and innovative saree designs",
        brands: ["Sabyasachi", "Tarun Tahiliani", "Anamika Khanna"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Indo-Western Fusion",
        category: "Various",
        description: "Blending Indian craftsmanship with Western silhouettes",
        brands: ["Rahul Mishra", "Gaurav Gupta", "Abu Jani Sandeep Khosla"],
        priceRange: "luxury",
        hotLevel: 5,
      },
      {
        name: "Statement Jewelry",
        category: "Accessories",
        description: "Traditional jewelry reimagined",
        brands: ["Amrapali", "Tribe by Amrapali", "Isharya"],
        priceRange: "mid",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Marigold", hex: "#EAA221", season: "FW25", usage: ["Festive wear", "Wedding season"] },
    { name: "Royal Blue", hex: "#4169E1", season: "FW25", usage: ["Occasion wear", "Statement pieces"] },
    { name: "Ivory", hex: "#FFFFF0", season: "SS26", usage: ["Summer wear", "Bridal"] },
    { name: "Fuchsia", hex: "#FF00FF", season: "FW25", usage: ["Festive", "Celebrations"] },
  ],
  styleMovements: [
    {
      name: "Modern Indian",
      description: "Traditional craftsmanship meets contemporary design",
      keyPieces: ["Contemporary sarees", "Fusion kurtas", "Statement jewelry", "Embroidered pieces"],
      influences: ["Indian weddings", "Bollywood", "Global fashion", "Heritage crafts"],
      targetAudience: ["Wedding guests", "Festival-goers", "Global Indians"],
    },
  ],
  publications: [
    { name: "Vogue India", focus: "Indian high fashion", gender: "female" },
    { name: "GQ India", focus: "Indian menswear and lifestyle", gender: "male" },
    { name: "Harper's Bazaar India", focus: "Luxury and fashion", gender: "female" },
  ],
  culturalNotes: [
    "Wedding season (October-February) drives major fashion purchases",
    "Indian craftsmanship like embroidery is globally recognized",
    "Modest fashion principles align with many Indian preferences",
    "Bollywood celebrities heavily influence fashion choices",
  ],
  seasonalFocus: "FW25 coincides with wedding and festival season - peak fashion period",
};

const LATIN_AMERICA_TRENDS: RegionalTrends = {
  region: "Latin America",
  countries: ["Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru"],
  maleInfluencers: [
    {
      name: "Cauã Reymond",
      handle: "@cauboroking",
      platform: "instagram",
      followers: "6.5M",
      specialty: ["Brazilian casual", "Beach lifestyle", "Effortless cool"],
      gender: "male",
    },
    {
      name: "Diego Boneta",
      handle: "@diegoboroking",
      platform: "instagram",
      followers: "5.2M",
      specialty: ["Mexican-American style", "Hollywood fashion", "Latin elegance"],
      gender: "male",
    },
  ],
  femaleInfluencers: [
    {
      name: "Camila Coelho",
      handle: "@camilboroking",
      platform: "instagram",
      followers: "10M",
      specialty: ["Brazilian glamour", "Beauty and fashion", "Entrepreneurial style"],
      gender: "female",
    },
    {
      name: "Aimee Song",
      handle: "@songofboroking",
      platform: "instagram",
      followers: "5.8M",
      specialty: ["LA-Latin fusion", "Bohemian luxury", "Travel style"],
      gender: "female",
    },
    {
      name: "Eiza González",
      handle: "@eizaboroking",
      platform: "instagram",
      followers: "7.8M",
      specialty: ["Mexican-Hollywood", "Red carpet", "Modern glamour"],
      gender: "female",
    },
  ],
  trendingItems: {
    male: [
      {
        name: "Linen Everything",
        category: "Various",
        description: "Head-to-toe linen for tropical climate",
        brands: ["Frescobol Carioca", "Orlebar Brown", "Onia"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Leather Huaraches",
        category: "Footwear",
        description: "Traditional Mexican sandals in quality leather",
        brands: ["Yuketen", "Chamula", "Nisolo"],
        priceRange: "mid",
        hotLevel: 4,
      },
    ],
    female: [
      {
        name: "Tropical Prints",
        category: "Various",
        description: "Bold botanical and jungle-inspired prints",
        brands: ["Farm Rio", "Johanna Ortiz", "PatBo"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Crochet Everything",
        category: "Various",
        description: "Hand-made crochet pieces from beach to evening",
        brands: ["She Made Me", "Cult Gaia", "Zimmermann"],
        priceRange: "mid",
        hotLevel: 5,
      },
      {
        name: "Statement Earrings",
        category: "Accessories",
        description: "Bold, colourful earrings as focal points",
        brands: ["Mercedes Salazar", "Lizzie Fortunato", "Katerina Makriyianni"],
        priceRange: "mid",
        hotLevel: 5,
      },
    ],
  },
  colorPalette: [
    { name: "Tropical Green", hex: "#00A550", season: "SS26", usage: ["Prints", "Statement pieces"] },
    { name: "Coral", hex: "#FF7F50", season: "SS26", usage: ["Swimwear", "Summer dresses"] },
    { name: "Sunshine Yellow", hex: "#FFEA00", season: "SS26", usage: ["Accessories", "Accents"] },
    { name: "Vibrant Pink", hex: "#FF1493", season: "SS26", usage: ["Evening wear", "Statement pieces"] },
  ],
  styleMovements: [
    {
      name: "Tropical Luxe",
      description: "Elevated resort wear with Latin flair",
      keyPieces: ["Printed maxi dresses", "Linen sets", "Woven bags", "Statement jewelry"],
      influences: ["Beach culture", "Carnival", "Indigenous crafts", "Global resort"],
      targetAudience: ["Resort-goers", "Beach lovers", "Latin diaspora"],
    },
  ],
  publications: [
    { name: "Vogue Brasil", focus: "Brazilian fashion", gender: "female" },
    { name: "Vogue Mexico", focus: "Mexican fashion and culture", gender: "female" },
    { name: "GQ Brasil", focus: "Brazilian menswear", gender: "male" },
  ],
  culturalNotes: [
    "Colour and print are celebrated in Latin American fashion",
    "Body confidence is embraced - form-fitting silhouettes are popular",
    "Artisanal and handmade pieces are valued",
    "Beach-to-bar dressing is a lifestyle",
  ],
  seasonalFocus: "SS26 is year-round focus due to tropical climate in most regions",
};

const ALL_REGIONAL_TRENDS: RegionalTrends[] = [
  UK_TRENDS,
  US_TRENDS,
  FRANCE_TRENDS,
  ITALY_TRENDS,
  CARIBBEAN_TRENDS,
  SOUTH_AFRICA_TRENDS,
  NORDIC_TRENDS,
  MIDDLE_EAST_TRENDS,
  ASIA_TRENDS,
  SOUTH_ASIA_TRENDS,
  LATIN_AMERICA_TRENDS,
];

export class TrendInsightsService {
  static async getTrendsForRegion(country: string): Promise<RegionalTrends | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const normalizedCountry = country.toLowerCase();
    
    for (const region of ALL_REGIONAL_TRENDS) {
      const found = region.countries.some(c => c.toLowerCase() === normalizedCountry);
      if (found) {
        return region;
      }
    }
    
    if (normalizedCountry.includes("united kingdom") || normalizedCountry.includes("uk") || normalizedCountry.includes("england")) {
      return UK_TRENDS;
    }
    if (normalizedCountry.includes("united states") || normalizedCountry.includes("usa") || normalizedCountry.includes("america")) {
      return US_TRENDS;
    }
    
    return UK_TRENDS;
  }

  static async getInfluencersForRegion(
    country: string,
    gender: "male" | "female"
  ): Promise<FashionInfluencer[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    return gender === "male" ? trends.maleInfluencers : trends.femaleInfluencers;
  }

  static async getTrendingItemsForRegion(
    country: string,
    gender: "male" | "female"
  ): Promise<TrendingItem[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    return gender === "male" ? trends.trendingItems.male : trends.trendingItems.female;
  }

  static async getColorPaletteForRegion(country: string): Promise<ColorTrend[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    return trends.colorPalette;
  }

  static async getStyleMovementsForRegion(country: string): Promise<StyleMovement[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    return trends.styleMovements;
  }

  static async getPublicationsForRegion(
    country: string,
    gender?: "male" | "female"
  ): Promise<{ name: string; focus: string; gender: string }[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    if (gender) {
      return trends.publications.filter(p => p.gender === gender || p.gender === "unisex");
    }
    return trends.publications;
  }

  static async getCulturalNotesForRegion(country: string): Promise<string[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];
    
    return trends.culturalNotes;
  }

  static async generateTrendInsights(
    country: string,
    gender: "male" | "female",
    subscriptionTier: "free" | "basic" | "premium" | "vip"
  ): Promise<TrendInsight[]> {
    const trends = await this.getTrendsForRegion(country);
    if (!trends) return [];

    const insights: TrendInsight[] = [];
    const trendingItems = gender === "male" ? trends.trendingItems.male : trends.trendingItems.female;
    const influencers = gender === "male" ? trends.maleInfluencers : trends.femaleInfluencers;

    trendingItems.slice(0, 3).forEach((item, index) => {
      insights.push({
        id: `trend-${index}`,
        title: `${item.name} is Trending`,
        description: `${item.description}. Top brands: ${item.brands.slice(0, 3).join(", ")}`,
        region: trends.region,
        gender,
        category: item.category,
        source: trends.publications[0]?.name || "Style Experts",
        date: new Date().toISOString().split("T")[0],
        tierAccess: item.hotLevel >= 5 ? "free" : "basic",
      });
    });

    if (subscriptionTier !== "free" && influencers.length > 0) {
      const topInfluencer = influencers[0];
      insights.push({
        id: "influencer-spotlight",
        title: `Influencer Spotlight: ${topInfluencer.name}`,
        description: `Follow ${topInfluencer.handle} for ${topInfluencer.specialty.join(", ")}. ${topInfluencer.followers} followers.`,
        region: trends.region,
        gender,
        category: "Influencer",
        source: topInfluencer.platform,
        date: new Date().toISOString().split("T")[0],
        tierAccess: "basic",
      });
    }

    if ((subscriptionTier === "premium" || subscriptionTier === "vip") && trends.styleMovements.length > 0) {
      const movement = trends.styleMovements[0];
      insights.push({
        id: "style-movement",
        title: `Style Movement: ${movement.name}`,
        description: `${movement.description}. Key pieces: ${movement.keyPieces.slice(0, 3).join(", ")}`,
        region: trends.region,
        gender: "unisex",
        category: "Style Movement",
        source: "Fashion Analysts",
        date: new Date().toISOString().split("T")[0],
        tierAccess: "premium",
      });
    }

    if (subscriptionTier === "vip") {
      const colors = trends.colorPalette.slice(0, 3);
      insights.push({
        id: "color-forecast",
        title: "2025/2026 Colour Forecast",
        description: `Key colours for your region: ${colors.map(c => c.name).join(", ")}. ${colors[0]?.usage.join(", ") || ""}`,
        region: trends.region,
        gender: "unisex",
        category: "Colour Trends",
        source: "Colour Analysts",
        date: new Date().toISOString().split("T")[0],
        tierAccess: "vip",
      });
    }

    return insights;
  }

  static async getHotItemsByCategory(
    country: string,
    gender: "male" | "female",
    category: string
  ): Promise<TrendingItem[]> {
    const items = await this.getTrendingItemsForRegion(country, gender);
    if (category === "All") return items;
    return items.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }

  static getGlobalTrendingBrands(gender: "male" | "female"): string[] {
    const maleBrands = [
      "Zegna", "Brunello Cucinelli", "Loro Piana", "The Row",
      "Fear of God", "Rhude", "Ami Paris", "Jacquemus",
      "Aime Leon Dore", "Kith", "Carhartt WIP", "Our Legacy"
    ];
    
    const femaleBrands = [
      "The Row", "Bottega Veneta", "Khaite", "Toteme",
      "Ganni", "By Far", "Jacquemus", "Nanushka",
      "Staud", "Reformation", "Rouje", "Sezane"
    ];
    
    return gender === "male" ? maleBrands : femaleBrands;
  }

  static get2025ColorTrends(): ColorTrend[] {
    return [
      { name: "Mocha Mousse", hex: "#4A3428", pantone: "Pantone 2025 COTY", season: "FW25", usage: ["Foundation pieces", "Accessories", "Outerwear"] },
      { name: "Cloud Dancer", hex: "#E8DDD3", pantone: "Pantone 2026 COTY", season: "SS26", usage: ["Layering", "Summer pieces", "Bridal"] },
      { name: "Capri Blue", hex: "#0077B6", season: "SS26", usage: ["Statement pieces", "Swimwear", "Accessories"] },
      { name: "Berry Red", hex: "#8B2F39", season: "FW25", usage: ["Evening wear", "Bold statements", "Lips"] },
      { name: "Parma Violet", hex: "#9B7EBD", season: "SS26", usage: ["Soft tailoring", "Feminine pieces"] },
      { name: "Lemon Grass", hex: "#A8C256", season: "SS26", usage: ["Fresh accents", "Activewear"] },
      { name: "Brandied Melon", hex: "#C87941", season: "FW25", usage: ["Warm neutrals", "Leather goods"] },
      { name: "Lyons Blue", hex: "#1E5B73", season: "FW25", usage: ["Professional wear", "Menswear"] },
    ];
  }

  static getAllRegions(): string[] {
    return ALL_REGIONAL_TRENDS.map(r => r.region);
  }
}

export default TrendInsightsService;
