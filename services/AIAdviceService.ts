const REGIONAL_INFLUENCER_STYLES: Record<string, {
  influencers: { name: string; handle: string; signature: string; gender: 'female' | 'male' }[];
  styleTips: string[];
  trendingPieces: string[];
  mensTrendingPieces?: string[];
}> = {
  'North America': {
    influencers: [
      { name: "Monroe Steele", handle: "@monroesteele", signature: "Effortlessly chic dresses with vintage Chanel accents and YSL leather jackets", gender: 'female' },
      { name: "Fashion Influx", handle: "@fashioninflux", signature: "Curated trends and styling hacks for everyday elegance", gender: 'female' },
      { name: "Camille Styles", handle: "@camillestyles", signature: "Elevated basics with timeless California cool", gender: 'female' },
      { name: "LeBron James", handle: "@kingjames", signature: "NBA legend with designer suits and streetwear collaborations with Thom Browne", gender: 'male' },
      { name: "Russell Westbrook", handle: "@russwest44", signature: "NBA's boldest dresser - avant-garde fashion with high-fashion runway pieces", gender: 'male' },
      { name: "Odell Beckham Jr", handle: "@obj", signature: "NFL style icon mixing luxury brands with streetwear edge", gender: 'male' },
      { name: "Timothée Chalamet", handle: "@tchalamet", signature: "Hollywood's new style king - slim tailoring, vintage pieces, and bold color choices", gender: 'male' },
      { name: "Michael B. Jordan", handle: "@michaelbjordan", signature: "Leading man elegance with Coach collaborations and sharp suiting", gender: 'male' },
    ],
    styleTips: [
      "Channel Monroe Steele's approach: mix high-end luxury pieces with accessible fashion for an 'effortlessly chic' look that doesn't appear over-styled.",
      "Try the 'French tuck' popularized by American influencers - tuck just the front of your shirt for a polished yet casual vibe.",
      "Statement belts are huge right now - add a vintage-style chain belt to elevate a simple dress, inspired by NYC street style.",
      "Layer a structured blazer over a relaxed outfit - it's the go-to formula for looking put-together without trying too hard.",
      "Athleisure is the new casual - Lululemon leggings with an oversized blazer and On Running sneakers is the ultimate rest day look that's shopping-ready.",
      "For men: Take notes from LeBron and Russell Westbrook - NBA players are defining American menswear with bold designer choices and perfectly tailored suits.",
      "For men: Timothée Chalamet proves slim-fit tailoring and vintage pieces work beautifully together - don't be afraid to mix eras.",
    ],
    trendingPieces: ["Barrel-leg jeans", "Shearling Penny Lane coat", "Leopard print pieces", "Lululemon Align leggings", "On Running Cloudmonster", "Hoka Bondi 8"],
    mensTrendingPieces: ["Oversized blazer", "Cuban collar shirt", "Chunky sneakers", "Gold chain", "Slim-fit suit", "Statement sunglasses"],
  },
  'UK': {
    influencers: [
      { name: "Victoria Magrath", handle: "@inthefrow", signature: "Luxury high-end fashion with impeccable taste", gender: 'female' },
      { name: "Lydia Jane Tomlinson", handle: "@lydiajanetomlinson", signature: "Wardrobe maximization and smart styling tips", gender: 'female' },
      { name: "Alexandra Stedman", handle: "@alexandra.stedman", signature: "Sustainable styling and thoughtful wardrobe repeating", gender: 'female' },
      { name: "David Beckham", handle: "@davidbeckham", signature: "British style icon - tailored suits, flat caps, and effortless country gentleman aesthetic", gender: 'male' },
      { name: "Hector Bellerin", handle: "@hectorbellerin", signature: "Arsenal legend and fashion-forward footballer with sustainable, avant-garde style", gender: 'male' },
      { name: "Marcus Rashford", handle: "@marcusrashford", signature: "Manchester United star with smart casual elegance and Burberry campaigns", gender: 'male' },
      { name: "Stormzy", handle: "@stabormy", signature: "Grime artist setting trends with Burberry and streetwear fusion", gender: 'male' },
    ],
    styleTips: [
      "Take inspiration from Victoria Magrath: invest in quality over quantity, choosing pieces that work across multiple occasions.",
      "British influencers love the 'smart casual' balance - pair tailored trousers with a relaxed knit for effortless sophistication.",
      "Embrace sustainable fashion like Alexandra Stedman - rewear and restyle pieces creatively rather than always buying new.",
      "The London street style formula: neutral base + one statement piece + quality accessories.",
      "Gymshark and Sweaty Betty have made athleisure acceptable everywhere - leggings with a long coat and chunky trainers is the new weekend uniform.",
      "For men: David Beckham's country gentleman look - flat caps, tweed, and quality leather boots - is timeless British style.",
      "For men: Hector Bellerin proves footballers can be fashion pioneers - embrace sustainable brands and avant-garde silhouettes.",
    ],
    trendingPieces: ["Trench coat", "Tailored wool coat", "Gymshark seamless sets", "Sweaty Betty leggings", "On Running sneakers", "Oner Active"],
    mensTrendingPieces: ["Flat cap", "Tweed blazer", "Chelsea boots", "Burberry scarf", "Barbour jacket", "Quality knitwear"],
  },
  'Europe': {
    influencers: [
      { name: "Jeanne Damas", handle: "@jeannedamas", signature: "Classic Parisian style with Rouje's effortless femininity", gender: 'female' },
      { name: "Chiara Ferragni", handle: "@chiaraferragni", signature: "Italian glamour meets playful luxury fashion", gender: 'female' },
      { name: "Leonie Hanne", handle: "@leoniehanne", signature: "German precision styling with globe-trotting elegance", gender: 'female' },
      { name: "Cristiano Ronaldo", handle: "@cristiano", signature: "Most-followed athlete - designer suits, CR7 fashion line, and luxury watches", gender: 'male' },
      { name: "Kylian Mbappé", handle: "@k.mbappe", signature: "French football star with Dior campaigns and youthful streetwear edge", gender: 'male' },
      { name: "Antoine Griezmann", handle: "@antogriezmann", signature: "French striker mixing sportswear with high fashion", gender: 'male' },
      { name: "Erling Haaland", handle: "@eraborang.haaland", signature: "Norwegian goal machine with minimalist Scandinavian style", gender: 'male' },
      { name: "Jude Bellingham", handle: "@judebellingham", signature: "England's rising star with Gucci campaigns and sharp tailoring", gender: 'male' },
    ],
    styleTips: [
      "Embrace the 'French girl' aesthetic: less is more, but every piece should be thoughtfully chosen.",
      "Italian influencers like Chiara Ferragni teach us to embrace glamour confidently - don't shy away from bold designer pieces.",
      "Master the art of looking undone yet polished - slightly tousled hair, minimal makeup, but impeccable tailoring.",
      "Invest in quality basics that serve as a canvas for rotating statement pieces - the European capsule wardrobe approach.",
      "For men: European footballers like Ronaldo and Mbappé set the global standard - sharp suits, designer collaborations, and impeccable grooming.",
      "For men: Jude Bellingham's Gucci partnership shows how young players are becoming fashion icons - embrace bold designer pieces confidently.",
    ],
    trendingPieces: ["Striped Breton top", "High-waisted tailored pants", "Ballet flats", "Silk scarf", "Classic handbag"],
    mensTrendingPieces: ["Double-breasted blazer", "Slim-fit chinos", "Leather loafers", "Designer sunglasses", "Quality polo shirt", "Luxury watch"],
  },
  'Middle East': {
    influencers: [
      { name: "Karen Wazen", handle: "@karenwazen", signature: "Fashion entrepreneurship with luxury eyewear design", gender: 'female' },
      { name: "Rawan Bin Hussain", handle: "@rawan", signature: "Glamorous editorial style with Gucci and Lancôme elegance", gender: 'female' },
      { name: "Huda Kattan", handle: "@huda", signature: "Beauty empire builder with polished luxury aesthetic", gender: 'female' },
      { name: "Mo Salah", handle: "@mosalah", signature: "Egyptian football king with modest luxury style and understated elegance", gender: 'male' },
      { name: "Riyad Mahrez", handle: "@riyadmahrez26.7", signature: "Algerian playmaker mixing European fashion with Middle Eastern flair", gender: 'male' },
    ],
    styleTips: [
      "Dubai influencers master the art of mixing modest fashion with high glamour - structured silhouettes that command attention.",
      "Invest in statement accessories - the right designer sunglasses or handbag can transform a simple outfit.",
      "Embrace rich fabrics and luxe textures - velvet, silk, and quality leather are staples in Middle Eastern fashion.",
      "Bold makeup pairs beautifully with understated outfits, or vice versa - master the balance like Huda Kattan.",
      "For men: Mo Salah's understated luxury approach - quality basics with statement watches - defines modern Middle Eastern menswear.",
    ],
    trendingPieces: ["Designer sunglasses", "Structured handbag", "Modest maxi dress", "Gold jewelry", "Statement heels"],
    mensTrendingPieces: ["Luxury watch", "White sneakers", "Linen shirt", "Designer sunglasses", "Quality leather belt"],
  },
  'Asia': {
    influencers: [
      { name: "Irene Kim", handle: "@ireneisgood", signature: "K-fashion with colorful hair and streetwear edge", gender: 'female' },
      { name: "Heart Evangelista", handle: "@iamhearte", signature: "Filipino elegance with Paris Fashion Week sophistication", gender: 'female' },
      { name: "Ming Xi", handle: "@mingxi11", signature: "Chinese supermodel grace with Chanel and Dior refinement", gender: 'female' },
      { name: "Son Heung-min", handle: "@hm_son7", signature: "Korean football star with clean-cut elegance and Hugo Boss campaigns", gender: 'male' },
      { name: "Takumi Minamino", handle: "@takaboranaminamino", signature: "Japanese footballer with understated Japanese minimalism", gender: 'male' },
      { name: "G-Dragon", handle: "@xxxibgdrgn", signature: "K-pop fashion icon defining Korean streetwear and luxury fusion", gender: 'male' },
    ],
    styleTips: [
      "K-fashion teaches us to embrace youthful experimentation - mix unexpected colors and silhouettes confidently.",
      "Asian street style masters layering - try combining different textures and lengths for visual interest.",
      "Take inspiration from Heart Evangelista: elegance and artistry can coexist in everyday fashion.",
      "Don't underestimate the power of skincare and a polished appearance as part of your overall style presentation.",
      "For men: G-Dragon pioneered the K-fashion movement - oversized silhouettes, bold accessories, and fearless color choices.",
      "For men: Son Heung-min's clean-cut style shows how minimalism and sharp tailoring work beautifully together.",
    ],
    trendingPieces: ["Oversized blazer", "Platform shoes", "Mini bag", "Statement earrings", "Cropped cardigan"],
    mensTrendingPieces: ["Oversized hoodie", "Wide-leg trousers", "Platform sneakers", "Bucket hat", "Layered chains"],
  },
  'South Asia': {
    influencers: [
      { name: "Masoom Minawala", handle: "@masoomminawala", signature: "Global luxury meets Indian heritage fusion", gender: 'female' },
      { name: "Komal Pandey", handle: "@komalpandey", signature: "Bold experimental looks with colorful confidence", gender: 'female' },
      { name: "Diipa Büller-Khosla", handle: "@difrancesco", signature: "Ayurvedic beauty with couture saree moments", gender: 'female' },
      { name: "Virat Kohli", handle: "@virat.kohli", signature: "Indian cricket captain with luxury brand partnerships and streetwear fusion", gender: 'male' },
      { name: "Ranveer Singh", handle: "@ranveersingh", signature: "Bollywood's boldest dresser - maximalist fashion with fearless experimentation", gender: 'male' },
    ],
    styleTips: [
      "Komal Pandey shows us that bold color combinations work beautifully - don't be afraid to mix vibrant hues.",
      "Blend Western trends with traditional elements - a modern silhouette with ethnic jewelry creates unique fusion style.",
      "Masoom Minawala demonstrates that luxury and accessibility can coexist - invest strategically in statement pieces.",
      "Embrace maximalist accessorizing - layered jewelry and detailed embroidery celebrate South Asian fashion heritage.",
      "For men: Ranveer Singh proves Indian men can embrace maximalist fashion - bold prints, bright colors, and dramatic silhouettes.",
      "For men: Virat Kohli's evolution from sportswear to luxury fashion shows the power of a versatile wardrobe.",
    ],
    trendingPieces: ["Statement ethnic jewelry", "Fusion kurta sets", "Embroidered jacket", "Silk saree", "Juttis/kolhapuris"],
    mensTrendingPieces: ["Nehru jacket", "Printed kurta", "Designer sneakers", "Aviator sunglasses", "Statement watch"],
  },
  'Africa': {
    influencers: [
      { name: "Temi Otedola", handle: "@temiotedola", signature: "Luxury fashion blogger attending Paris Fashion Week", gender: 'female' },
      { name: "Mihlali Ndamase", handle: "@mihlalii_n", signature: "South African beauty and fashion with Forbes recognition", gender: 'female' },
      { name: "Kefilwe Mabote", handle: "@kefilwe_mabote", signature: "Luxury lifestyle and property empire style", gender: 'female' },
      { name: "Sadio Mané", handle: "@saaboranmane", signature: "Senegalese football legend with understated elegance and cultural pride", gender: 'male' },
      { name: "Victor Osimhen", handle: "@victorosimhen9", signature: "Nigerian striker with bold streetwear and luxury blend", gender: 'male' },
    ],
    styleTips: [
      "African fashion influencers celebrate bold prints and vibrant colors - embrace Ankara and Kente-inspired pieces.",
      "Temi Otedola shows how to mix African designers with international luxury brands seamlessly.",
      "Statement jewelry with cultural significance elevates any outfit - gold and beadwork are timeless choices.",
      "Don't shy away from dramatic silhouettes - flowing sleeves, voluminous skirts, and sculptural shapes celebrate African aesthetics.",
      "For men: African footballers like Sadio Mané show how cultural pride and international luxury can blend beautifully.",
    ],
    trendingPieces: ["Ankara print blazer", "Statement gold jewelry", "Head wrap/turban", "Flowing kaftan", "Beaded accessories"],
    mensTrendingPieces: ["Ankara print shirt", "Agbada", "Gold chain", "Designer sneakers", "Traditional cap"],
  },
  'Latin America': {
    influencers: [
      { name: "Thassia Naves", handle: "@thassianaves", signature: "Brazilian globetrotting fashion with Forbes Under 30 style", gender: 'female' },
      { name: "Yuya", handle: "@yuyacst", signature: "Mexican beauty pioneer with authentic lifestyle content", gender: 'female' },
      { name: "Pamela Allier", handle: "@pameallier", signature: "Sustainable fashion for eco-conscious millennials", gender: 'female' },
      { name: "Neymar Jr", handle: "@neymarjr", signature: "Brazilian superstar with bold streetwear, designer pieces, and fearless hair choices", gender: 'male' },
      { name: "Vinicius Jr", handle: "@vinijr", signature: "Real Madrid star with youthful Brazilian swagger and luxury brand partnerships", gender: 'male' },
    ],
    styleTips: [
      "Brazilian influencers embrace body confidence - choose pieces that celebrate your natural shape without restriction.",
      "Latin American fashion loves vibrant colors and playful prints - don't hold back on expressing joy through clothing.",
      "Sustainable fashion is growing in LATAM - Pamela Allier shows how eco-conscious choices can still be stylish.",
      "Mix high-end pieces with local artisan finds for authentic, culturally-rich style expression.",
      "For men: Neymar's fearless approach to fashion - from bold hair to designer streetwear - inspires confidence in self-expression.",
    ],
    trendingPieces: ["Colorful maxi dress", "Artisan handmade accessories", "Linen separates", "Bold earrings", "Strappy sandals"],
    mensTrendingPieces: ["Printed shirt", "Slim-fit shorts", "Designer sandals", "Gold jewelry", "Statement sneakers"],
  },
  'Australia': {
    influencers: [
      { name: "Nicole Warne", handle: "@garypeppergirl", signature: "Gary Pepper Girl luxury fashion meets travel", gender: 'female' },
      { name: "Jessica Stein", handle: "@tuulavintage", signature: "Vintage finds with contemporary styling", gender: 'female' },
      { name: "Carmen Hamilton", handle: "@chroniclesofher", signature: "Modern minimalist with bold accessories", gender: 'female' },
      { name: "Chris Hemsworth", handle: "@chrishemsworth", signature: "Thor star with laid-back Australian masculinity and fitness-forward style", gender: 'male' },
      { name: "Liam Hemsworth", handle: "@liamhemsworth", signature: "Australian actor with classic casual elegance", gender: 'male' },
    ],
    styleTips: [
      "Australian fashion embraces laid-back luxury - quality basics styled with intention rather than excess.",
      "The Sydney athleisure scene is huge - Lululemon, On Running and Hoka are perfect for the coffee-run-to-shopping transition that defines Aussie weekend style.",
      "Nicole Warne shows that travel and fashion go hand-in-hand - invest in versatile pieces that work across destinations.",
      "The Sydney street style formula: minimalist base + architectural accessory + natural textures.",
      "Sustainable and ethical fashion is central to Australian influencer culture - quality over fast fashion always.",
      "For men: The Hemsworth brothers define Aussie masculinity - fitted basics, quality denim, and effortless grooming.",
    ],
    trendingPieces: ["Linen blazer", "Vintage denim", "Lululemon Define jacket", "On Running Cloud 5", "Hoka sneakers", "Woven bag"],
    mensTrendingPieces: ["Linen shirt", "Quality denim", "Leather boots", "Simple tee", "Aviator sunglasses"],
  },
};

const TRENDING_STYLES_2024_2025 = {
  colors: {
    hot: ["Deep chocolate brown", "Burgundy", "Icy blue/powder blue", "Butter yellow", "Mint green", "Marigold gold", "Cardinal red"],
    neutral: ["Leopard print (the new neutral)", "Cream", "Olive green", "Midnight plum", "Navy blue", "Forest green"],
    avoid: ["Neon green", "Bright hot pink (Barbiecore fading)"],
  },
  silhouettes: {
    trending: ["Barrel-leg jeans", "Relaxed oversized fits", "Micro mini skirts", "Sculptural/architectural shapes", "Western-inspired pieces"],
    classic: ["High-waisted tailored pants", "Structured blazers", "A-line midi skirts"],
    preppy: ["Pleated tennis skirts", "Cable-knit sweaters", "Tailored chinos", "Blazers with gold buttons", "Collared shirts"],
  },
  pieces: {
    mustHave: ["Shearling Penny Lane coat", "Leopard print anything", "Statement belt", "Polo shirt (Miu Miu inspired)", "Head scarf/silk scarf"],
    accessories: ["Sculptural earrings", "Animal-shaped purses", "Cowboy boots", "Ballet flats", "Geometric handbags"],
    athleisure: ["Gymshark Vital leggings", "Lululemon Align pants", "On Running Cloudmonster", "Hoka Bondi 8", "Sweaty Betty Power leggings", "Oner Active sets"],
    preppy: ["Pearl necklace", "Headband", "Loafers", "Tennis bracelet", "Quilted bag", "Cashmere sweater"],
    countryside: ["Barbour jacket", "Hunter boots", "Tweed blazer", "Wax cotton bag", "Flat cap", "Gilet/vest"],
  },
  aesthetics: ["Quiet luxury", "Coastal grandma", "Western chic", "Wearable art", "Underconsumption core", "Rest day chic", "Old money preppy", "Chic farmer/Countryside", "Ivy League"],
};

const STYLE_ADVICE_TEMPLATES = {
  general: [
    "Great outfit choice! The proportions work really well together. Consider adding a statement accessory to elevate the look.",
    "Love the color coordination here! The fit is flattering. For a bolder look, try layering with a contrasting texture.",
    "This is a solid foundation look. The silhouette suits your body type well. Adding a belt could help define your waist more.",
    "Nice balance between casual and polished! The fabric quality shows. Consider rolling up sleeves for a more relaxed vibe.",
    "The monochromatic approach works beautifully! To add dimension, try pieces with subtle texture variations.",
  ],
  casual: [
    "Perfect everyday look! The relaxed fit is comfortable yet stylish. Try cuffing the pants for a more intentional finish.",
    "This casual outfit has great street style potential. Adding white sneakers would complete the effortless vibe.",
    "Love how you've mixed basics here! Consider adding a crossbody bag to add visual interest to the silhouette.",
    "The denim works well with this top. For variety, try French-tucking the front of your shirt.",
    "Casual done right! The sneakers are a great choice. A baseball cap could add a fun sporty element.",
  ],
  formal: [
    "Elegant and sophisticated! The tailoring fits well. A pocket square would add a refined finishing touch.",
    "This formal look is polished and professional. Consider a metallic accessory to catch the light beautifully.",
    "Classic combination done right! The fabric drapes nicely. Pointed-toe shoes would elongate your silhouette.",
    "You've nailed the dress code! The subtle details show attention to styling. A watch would complete the look.",
    "Sleek and powerful outfit! The structure of this piece is flattering. Try a bold lip color to make it pop.",
  ],
  colorAdvice: [
    "This color palette is harmonious! You've chosen complementary tones that enhance your complexion.",
    "The neutral base allows for versatile styling. Consider adding a pop of color through accessories.",
    "Bold color choice! This shade suits your undertone. Pair with gold jewelry to enhance the warmth.",
    "The color blocking is eye-catching! For a softer approach, try similar tones in different saturations.",
    "Earth tones look great on you! Consider adding a jewel tone accent for visual interest.",
  ],
  proportions: [
    "The high-waist placement is visually lengthening. This creates a balanced and elegant silhouette.",
    "Great job with the proportions! The fitted top with relaxed bottom is a universally flattering formula.",
    "The cropped length works well with the high-waisted bottom. This is a modern and fashion-forward combination.",
    "Tucking your top defines your waist beautifully. Consider half-tucking for a more casual vibe.",
    "The oversized top balanced with slim pants creates visual interest. This proportion play is very chic.",
  ],
  seasonal: {
    spring: [
      "Perfect spring layering! Light fabrics work well for transitional weather. Consider pastels to match the season.",
      "This outfit captures spring freshness! Floral prints would complement this base beautifully.",
    ],
    summer: [
      "Light and breezy - perfect for warm weather! Natural fabrics like linen would keep you cool and stylish.",
      "Great summer silhouette! Consider adding sunglasses and a woven bag to complete the vacation vibe.",
    ],
    fall: [
      "Cozy fall layering done right! The warm tones are seasonal and flattering. Try adding a scarf for extra dimension.",
      "Perfect autumn outfit! The layers work well together. Consider swapping to boots for a complete fall look.",
    ],
    winter: [
      "Winter dressing at its finest! The layering is both practical and stylish. Add leather gloves for a polished finish.",
      "Cozy and chic winter look! The textures mix well. A structured bag would add sophistication.",
    ],
  },
  sizeInclusive: [
    "This fit is celebrating your shape beautifully! The fabric choice is excellent for comfortable movement.",
    "Love how you've styled this! The strategic fit-and-flare creates a gorgeous silhouette.",
    "You're rocking this look! The structured shoulder balances the outfit perfectly.",
    "Stunning choice! The empire waist is incredibly flattering and the fabric flows elegantly.",
    "This outfit highlights your best features! The V-neckline elongates beautifully.",
  ],
  trendingNow: [
    "You're totally on-trend! Leopard print is THE neutral of 2024 - you're wearing it like a true fashion insider.",
    "Love seeing barrel-leg jeans in action! This geometric silhouette is universally flattering and so current.",
    "The shearling/fuzzy coat is giving major Penny Lane vibes - celebrities and influencers are obsessed with this look!",
    "Deep chocolate brown instead of all-black? Very fashion-forward! This is the 'quiet luxury' moment happening right now.",
    "The oversized relaxed silhouette you've chosen is peak 2025 style - understated luxury at its finest.",
  ],
  athleisure: [
    "Rest day chic done perfectly! Athleisure for shopping and brunch is THE move right now. Your leggings-to-lifestyle look is spot on.",
    "Love this gym-to-street transition! Pairing quality activewear with everyday pieces is what 2024/2025 fashion is all about.",
    "This athleisure look is exactly what influencers are wearing on their coffee runs! Consider adding an oversized blazer to elevate it further.",
    "Yoga pants outside the studio? Absolutely! The 'rest day outfit' trend means quality leggings are now acceptable everywhere.",
    "Your activewear styling is on point! The key is quality pieces - brands like Gymshark, Lululemon, and Sweaty Betty make athleisure look intentional, not lazy.",
    "This is giving major wellness-era vibes! On Running or Hoka sneakers would complete this 'I take care of myself' aesthetic perfectly.",
  ],
  preppy: [
    "Old money elegance at its finest! This preppy look channels Ivy League sophistication with effortless grace.",
    "The classic preppy aesthetic is having a major moment! Your cable-knit and collared combination is perfectly polished.",
    "Very 'quiet wealth' - the understated quality pieces you've chosen speak louder than logos ever could.",
    "Love this country club chic! The tailored fit and classic colors give off confident, established style.",
    "This is giving Kennedy family summer vibes! Pearl accents or loafers would complete the old money aesthetic.",
    "Preppy done right! The clean lines and quality fabrics show attention to detail - this is investment dressing at its best.",
    "For men: Ralph Lauren and Brooks Brothers vibes! This preppy look channels East Coast sophistication perfectly.",
    "For men: The blazer with gold buttons is peak old money style - David Beckham would approve of this country gentleman look.",
  ],
  countryside: [
    "Chic farmer aesthetic nailed! This elevated countryside look is perfect for the 'I have land' aesthetic.",
    "Love this rural luxe styling! The practical-meets-polished approach is giving wealthy estate owner vibes.",
    "Barbour jacket with that outfit? Chef's kiss! This is the sophisticated countryside look that's huge right now.",
    "Very 'I weekend in the Cotswolds' - the tweed and quality boots combination is timeless British countryside elegance.",
    "This country chic look balances practicality with style beautifully - Hunter boots or wellies would complete it.",
    "The elevated farm aesthetic is trending! Your mix of rugged and refined pieces shows impeccable taste.",
    "For men: This is peak country gentleman - think David Beckham at his Cotswolds estate with flat caps and quality knitwear.",
    "For men: Very 'I shoot on the weekends' - the tweed and Barbour combination is classic British countryside style.",
  ],
};

const HASHTAG_SUGGESTIONS = [
  "#OOTD #StyleWise #FashionAdvice",
  "#OutfitInspo #StyleTips #FashionCommunity",
  "#WhatIWore #FashionDiary #StreetStyle",
  "#StyleOfTheDay #OutfitGoals #FashionForward",
  "#DailyFashion #StyleInspiration #LookOfTheDay",
];

const PRODUCT_SUGGESTIONS = [
  { category: "Accessories", items: ["Statement earrings", "Leather belt", "Crossbody bag", "Silk scarf"] },
  { category: "Shoes", items: ["White sneakers", "Block heels", "Ankle boots", "Loafers"] },
  { category: "Layers", items: ["Denim jacket", "Cardigan", "Blazer", "Trench coat"] },
  { category: "Basics", items: ["White t-shirt", "Black trousers", "Classic jeans", "Neutral sweater"] },
  { category: "Athleisure", items: ["Lululemon Align leggings", "On Running sneakers", "Gymshark sports bra", "Oversized hoodie", "Hoka running shoes"] },
  { category: "Preppy", items: ["Pearl necklace", "Cable-knit sweater", "Penny loafers", "Tennis bracelet", "Quilted handbag", "Cashmere cardigan"] },
  { category: "Countryside", items: ["Barbour jacket", "Hunter boots", "Tweed blazer", "Flat cap", "Wax cotton bag", "Quilted gilet"] },
];

export interface AIAdviceResult {
  mainAdvice: string;
  colorAdvice?: string;
  proportionAdvice?: string;
  suggestions: string[];
  hashtags: string[];
  productRecommendations: { category: string; items: string[] }[];
  confidence: number;
  influencerInsight?: string;
  trendingTip?: string;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function getRegionFromCountry(country: string): string {
  const regionMap: Record<string, string> = {
    'United States': 'North America', 'Canada': 'North America', 'Mexico': 'Latin America',
    'United Kingdom': 'UK', 'Ireland': 'UK',
    'France': 'Europe', 'Germany': 'Europe', 'Italy': 'Europe', 'Spain': 'Europe', 'Netherlands': 'Europe',
    'Belgium': 'Europe', 'Switzerland': 'Europe', 'Austria': 'Europe', 'Portugal': 'Europe', 'Greece': 'Europe',
    'Sweden': 'Europe', 'Norway': 'Europe', 'Denmark': 'Europe', 'Finland': 'Europe', 'Iceland': 'Europe',
    'Poland': 'Europe', 'Czech Republic': 'Europe', 'Hungary': 'Europe', 'Romania': 'Europe',
    'United Arab Emirates': 'Middle East', 'Saudi Arabia': 'Middle East', 'Qatar': 'Middle East',
    'Kuwait': 'Middle East', 'Bahrain': 'Middle East', 'Oman': 'Middle East', 'Jordan': 'Middle East',
    'Lebanon': 'Middle East', 'Egypt': 'Middle East', 'Israel': 'Middle East', 'Turkey': 'Middle East',
    'Japan': 'Asia', 'South Korea': 'Asia', 'China': 'Asia', 'Hong Kong': 'Asia', 'Taiwan': 'Asia',
    'Singapore': 'Asia', 'Thailand': 'Asia', 'Malaysia': 'Asia', 'Indonesia': 'Asia', 'Philippines': 'Asia',
    'Vietnam': 'Asia',
    'India': 'South Asia', 'Pakistan': 'South Asia', 'Bangladesh': 'South Asia', 'Sri Lanka': 'South Asia',
    'Nepal': 'South Asia',
    'Nigeria': 'Africa', 'South Africa': 'Africa', 'Kenya': 'Africa', 'Ghana': 'Africa', 'Ethiopia': 'Africa',
    'Morocco': 'Africa', 'Tanzania': 'Africa',
    'Brazil': 'Latin America', 'Argentina': 'Latin America', 'Colombia': 'Latin America', 'Chile': 'Latin America',
    'Peru': 'Latin America', 'Venezuela': 'Latin America', 'Cuba': 'Latin America', 'Puerto Rico': 'Latin America',
    'Jamaica': 'Latin America', 'Dominican Republic': 'Latin America',
    'Australia': 'Australia', 'New Zealand': 'Australia',
  };
  return regionMap[country] || 'North America';
}

function generateInfluencerInsight(region: string): string {
  const regionData = REGIONAL_INFLUENCER_STYLES[region];
  if (!regionData) return "";
  
  const influencer = getRandomItem(regionData.influencers);
  const styleTip = getRandomItem(regionData.styleTips);
  
  return styleTip;
}

function generateTrendingTip(description: string): string {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('leopard') || descLower.includes('animal print')) {
    return STYLE_ADVICE_TEMPLATES.trendingNow[0];
  }
  if (descLower.includes('barrel') || descLower.includes('wide leg')) {
    return STYLE_ADVICE_TEMPLATES.trendingNow[1];
  }
  if (descLower.includes('shearling') || descLower.includes('fuzzy') || descLower.includes('teddy')) {
    return STYLE_ADVICE_TEMPLATES.trendingNow[2];
  }
  if (descLower.includes('brown') || descLower.includes('chocolate') || descLower.includes('caramel')) {
    return STYLE_ADVICE_TEMPLATES.trendingNow[3];
  }
  if (descLower.includes('oversized') || descLower.includes('relaxed') || descLower.includes('loose')) {
    return STYLE_ADVICE_TEMPLATES.trendingNow[4];
  }
  
  return getRandomItem(STYLE_ADVICE_TEMPLATES.trendingNow);
}

function generateAdvice(description: string, isPremium: boolean, userCountry?: string): AIAdviceResult {
  const descLower = description.toLowerCase();

  let category: 'general' | 'casual' | 'formal' = 'general';
  if (descLower.includes('casual') || descLower.includes('jeans') || descLower.includes('sneaker')) {
    category = 'casual';
  } else if (descLower.includes('formal') || descLower.includes('business') || descLower.includes('dress') || descLower.includes('suit')) {
    category = 'formal';
  }

  const mainAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES[category]);
  const colorAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.colorAdvice);
  const proportionAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.proportions);
  const seasonalAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.seasonal[getCurrentSeason()]);
  const sizeInclusiveAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.sizeInclusive);
  
  const region = userCountry ? getRegionFromCountry(userCountry) : 'North America';
  const influencerInsight = generateInfluencerInsight(region);
  const trendingTip = generateTrendingTip(description);

  const suggestions = [seasonalAdvice];
  if (isPremium) {
    suggestions.push(sizeInclusiveAdvice);
  }

  const hashtags = getRandomItem(HASHTAG_SUGGESTIONS).split(' ');

  const numProducts = isPremium ? 3 : 1;
  const shuffledProducts = [...PRODUCT_SUGGESTIONS].sort(() => Math.random() - 0.5);
  const productRecommendations = shuffledProducts.slice(0, numProducts);

  return {
    mainAdvice,
    colorAdvice: isPremium ? colorAdvice : undefined,
    proportionAdvice: isPremium ? proportionAdvice : undefined,
    suggestions,
    hashtags,
    productRecommendations,
    confidence: 0.85 + Math.random() * 0.1,
    influencerInsight: isPremium ? influencerInsight : undefined,
    trendingTip: trendingTip,
  };
}

export async function getAIFashionAdvice(
  imageUri: string,
  description: string,
  isPremiumUser: boolean = false,
  userCountry?: string
): Promise<AIAdviceResult> {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  return generateAdvice(description, isPremiumUser, userCountry);
}

export async function getQuickAdvice(description: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const category = description.toLowerCase().includes('casual') ? 'casual' :
    description.toLowerCase().includes('formal') ? 'formal' : 'general';

  return getRandomItem(STYLE_ADVICE_TEMPLATES[category]);
}

export function generateShareableCaption(advice: AIAdviceResult): string {
  const caption = `${advice.mainAdvice}\n\n${advice.hashtags.join(' ')}`;
  return caption;
}

export function getComparisonAdvice(): { optionA: string; optionB: string; recommendation: string } {
  const recommendations = [
    {
      optionA: "Option A has a more relaxed, casual vibe that's perfect for everyday wear.",
      optionB: "Option B is slightly more polished and could transition well to evening events.",
      recommendation: "Both are great choices! Go with A for comfort-focused days, B when you want to make more of a statement.",
    },
    {
      optionA: "The color palette in Option A is very harmonious and easy to accessorize.",
      optionB: "Option B has bolder color choices that make more of a visual impact.",
      recommendation: "If you want versatility, choose A. For a memorable look, go with B.",
    },
    {
      optionA: "Option A features classic pieces that never go out of style.",
      optionB: "Option B incorporates more current trends for a fashion-forward look.",
      recommendation: "A is perfect for building a capsule wardrobe. B is great for staying on-trend.",
    },
  ];

  return getRandomItem(recommendations);
}

export function getInfluencerStyleGuide(country: string): {
  influencers: { name: string; handle: string; signature: string }[];
  styleTips: string[];
  trendingPieces: string[];
} {
  const region = getRegionFromCountry(country);
  return REGIONAL_INFLUENCER_STYLES[region] || REGIONAL_INFLUENCER_STYLES['North America'];
}

export function getStyleOfTheDayContent(country: string): {
  title: string;
  tip: string;
  influencerCredit: string;
  trendingColors: string[];
  mustHavePieces: string[];
} {
  const region = getRegionFromCountry(country);
  const regionData = REGIONAL_INFLUENCER_STYLES[region] || REGIONAL_INFLUENCER_STYLES['North America'];
  const influencer = getRandomItem(regionData.influencers);
  
  return {
    title: `Today's Style Inspiration from ${region}`,
    tip: getRandomItem(regionData.styleTips),
    influencerCredit: `Inspired by ${influencer.name} (${influencer.handle})`,
    trendingColors: TRENDING_STYLES_2024_2025.colors.hot.slice(0, 4),
    mustHavePieces: regionData.trendingPieces,
  };
}

export { REGIONAL_INFLUENCER_STYLES, TRENDING_STYLES_2024_2025 };
