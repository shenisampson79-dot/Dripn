/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * AI Fashion Advice Service - Powers Ruby and Max AI stylists
 */

import TrendInsightsService, { 
  TrendingItem, 
  FashionInfluencer, 
  ColorTrend,
  StyleMovement,
  RegionalTrends 
} from './TrendInsightsService';
import ContentPersonalizationService from './ContentPersonalizationService';
import { DripnGoal, ExtendedPreferences, SubscriptionTier } from '@/contexts/AuthContext';
import { normalizeSubscriptionTier, isPaidTier } from '@/utils/subscriptionTier';
import { getTrendPreviewLimits } from '@/utils/tierMatrix';

const REGIONAL_INFLUENCER_STYLES: Record<string, {
  influencers: { name: string; handle: string; signature: string; gender: 'female' | 'male' }[];
  styleTips: string[];
  mensStyleTips?: string[];
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
    ],
    mensStyleTips: [
      "Take notes from LeBron and Russell Westbrook - NBA players are defining American menswear with bold designer choices and perfectly tailored suits.",
      "Timothée Chalamet proves slim-fit tailoring and vintage pieces work beautifully together - don't be afraid to mix eras.",
      "Michael B. Jordan's Coach collaborations show how to blend luxury brands with accessible streetwear for everyday elegance.",
      "Odell Beckham Jr masters the art of mixing luxury pieces with athletic wear - try a designer jacket with premium sneakers.",
      "The oversized blazer with slim trousers is the modern power look - it works for business and weekend brunch alike.",
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
      "The Ugg trend is back stronger than ever - pair classic Ugg boots or Tasman slippers with oversized baggy sweatpants or boyfriend jeans for the ultimate cosy autumn/winter look.",
      "The North Face puffer jackets are the go-to for British winters - the Nuptse is iconic. For rain, their waterproof shells are essential.",
      "For premium outdoor style, Arc'teryx and Rab offer technical excellence that looks amazing. Mackage brings luxury to winter outerwear.",
    ],
    mensStyleTips: [
      "David Beckham's country gentleman look - flat caps, tweed, and quality leather boots - is timeless British style that works for any occasion.",
      "Hector Bellerin proves footballers can be fashion pioneers - embrace sustainable brands and avant-garde silhouettes for a forward-thinking look.",
      "Marcus Rashford's Burberry partnerships show how to blend British heritage with modern sportswear - think classic trenches with fresh trainers.",
      "Stormzy's Burberry collaborations define modern British menswear - oversized puffers, tracksuits, and bold branding work together beautifully.",
      "Stone Island and C.P. Company are essential UK football casual brands - invest in quality pieces that show heritage and style.",
      "The North Face Nuptse is the ultimate British winter essential - pair with slim joggers and clean trainers for the perfect casual look.",
    ],
    trendingPieces: ["Trench coat", "Tailored wool coat", "Gymshark seamless sets", "Sweaty Betty leggings", "On Running sneakers", "Oner Active", "Ugg Classic Mini boots", "Ugg Tasman slippers", "Oversized baggy sweatpants", "Boyfriend jeans", "The North Face puffer jacket", "The North Face rain jacket", "Rab down jacket", "Arc'teryx shell jacket", "Jack Wolfskin waterproof", "Mackage wool coat"],
    mensTrendingPieces: ["Flat cap", "Tweed blazer", "Chelsea boots", "Burberry scarf", "Barbour jacket", "Quality knitwear", "Stone Island jumper", "C.P. Company jacket", "Lyle & Scott polo", "White trainers", "The North Face Nuptse", "The North Face rain jacket", "Rab Microlight jacket", "Arc'teryx Beta jacket", "Jack Wolfskin parka"],
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
      "Ugg boots with oversized sweatpants or boyfriend jeans is the go-to cosy look across Europe this autumn/winter - comfort meets effortless style.",
    ],
    mensStyleTips: [
      "European footballers like Ronaldo and Mbappé set the global standard - sharp suits, designer collaborations, and impeccable grooming.",
      "Jude Bellingham's Gucci partnership shows how young players are becoming fashion icons - embrace bold designer pieces confidently.",
      "Erling Haaland proves Scandinavian minimalism works - clean lines, neutral colors, and quality fabrics create effortless sophistication.",
      "Kylian Mbappé's Dior campaigns define modern French menswear - youthful streetwear meets luxury tailoring perfectly.",
      "The double-breasted blazer is essential European style - pair with slim chinos and leather loafers for timeless elegance.",
    ],
    trendingPieces: ["Striped Breton top", "High-waisted tailored pants", "Ballet flats", "Silk scarf", "Classic handbag", "Ugg Classic boots", "Ugg Tasman slippers", "Oversized sweatpants", "Boyfriend jeans"],
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
    ],
    mensStyleTips: [
      "Mo Salah's understated luxury approach - quality basics with statement watches - defines modern Middle Eastern menswear.",
      "Riyad Mahrez blends European fashion with Middle Eastern flair - sharp tailoring meets relaxed elegance perfectly.",
      "Dubai's luxury menswear scene favors clean white sneakers with quality linen - perfect for hot weather sophistication.",
      "Invest in designer sunglasses and a statement watch - these two accessories define Gulf menswear.",
      "The linen shirt is essential for Middle Eastern style - pair with slim trousers for effortless elegance.",
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
    ],
    mensStyleTips: [
      "G-Dragon pioneered the K-fashion movement - oversized silhouettes, bold accessories, and fearless color choices define the look.",
      "Son Heung-min's clean-cut style shows how minimalism and sharp tailoring work beautifully together - Hugo Boss elegance.",
      "Takumi Minamino embodies Japanese minimalism - quality basics in neutral tones create understated sophistication.",
      "K-pop style embraces layering - try an oversized hoodie with wide-leg trousers and platform sneakers.",
      "Bucket hats and layered chains are essential Asian streetwear accessories - subtle flex meets functionality.",
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
    ],
    mensStyleTips: [
      "Ranveer Singh proves Indian men can embrace maximalist fashion - bold prints, bright colors, and dramatic silhouettes make a statement.",
      "Virat Kohli's evolution from sportswear to luxury fashion shows the power of a versatile wardrobe - invest in quality pieces.",
      "The Nehru jacket is essential Indian menswear - pair with slim trousers and designer sneakers for modern fusion style.",
      "Printed kurtas work beautifully for casual and festive occasions - embrace bold patterns and rich colors.",
      "Aviator sunglasses and a statement watch complete any South Asian look - classic accessories never go out of style.",
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
    ],
    mensStyleTips: [
      "Sadio Mané shows how cultural pride and international luxury blend beautifully - elegant simplicity with meaningful accessories.",
      "Victor Osimhen's bold streetwear mixed with luxury pieces defines modern Nigerian menswear - don't be afraid to stand out.",
      "Ankara print shirts are essential African menswear - pair with slim trousers and designer sneakers for contemporary style.",
      "The Agbada is timeless elegance for special occasions - traditional craftsmanship meets sophisticated tailoring.",
      "Gold chains and traditional caps add cultural significance to any outfit - heritage accessories that make a statement.",
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
    ],
    mensStyleTips: [
      "Neymar's fearless approach to fashion - from bold hair to designer streetwear - inspires confidence in self-expression.",
      "Vinicius Jr's youthful Brazilian swagger shows how luxury brands and streetwear create the perfect match.",
      "Printed shirts are essential Latin American menswear - embrace bold patterns and vibrant colors for summer style.",
      "Gold jewelry is a staple of Brazilian menswear - chains and bracelets add personality to any outfit.",
      "Statement sneakers complete the look - invest in bold colorways that match your personality.",
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
    ],
    mensStyleTips: [
      "The Hemsworth brothers define Aussie masculinity - fitted basics, quality denim, and effortless grooming.",
      "Chris Hemsworth's fitness-forward style shows how gym wear transitions seamlessly to casual - invest in quality athleisure.",
      "Liam Hemsworth's classic casual elegance proves simple works - a quality tee, fitted jeans, and leather boots are timeless.",
      "Linen shirts are essential Australian menswear - perfect for the beach-to-bar lifestyle.",
      "Aviator sunglasses complete the Aussie look - classic style that works from surf to city.",
    ],
    trendingPieces: ["Linen blazer", "Vintage denim", "Lululemon Define jacket", "On Running Cloud 5", "Hoka sneakers", "Woven bag"],
    mensTrendingPieces: ["Linen shirt", "Quality denim", "Leather boots", "Simple tee", "Aviator sunglasses"],
  },
};

const TRENDING_STYLES_2025_2026 = {
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
    winterAccessories: ["Cashmere scarf", "Leather gloves", "Wool beanie", "Faux fur hat", "Chunky knit scarf", "Touch-screen gloves", "Beret", "Merino wool mittens"],
    oversizedTrend: ["Oversized jumper", "Wide-leg trousers", "Baggy jeans", "Boyfriend blazer", "Oversized t-shirt", "Slouchy cardigan", "Boxy hoodie", "Relaxed shirt dress"],
  },
  accessories: {
    luxuryBagsWomen: {
      trending: [
        { brand: "Celine", item: "Triomphe Bag", style: "Quiet luxury essential with iconic clasp" },
        { brand: "Celine", item: "Ava Bag", style: "Minimalist hobo silhouette for everyday elegance" },
        { brand: "Celine", item: "16 Bag", style: "Structured sophistication for the modern woman" },
        { brand: "Chanel", item: "Classic Flap Bag", style: "Timeless investment piece - the ultimate status symbol" },
        { brand: "Chanel", item: "Boy Bag", style: "Edgier take on classic Chanel with chain strap" },
        { brand: "Chanel", item: "Gabrielle Bag", style: "Relaxed hobo style with double chain" },
        { brand: "Mulberry", item: "Bayswater", style: "British heritage icon - perfect for work and weekend" },
        { brand: "Mulberry", item: "Lily", style: "Compact crossbody with signature postman's lock" },
        { brand: "Mulberry", item: "Alexa", style: "Satchel style named after Alexa Chung - effortlessly cool" },
        { brand: "Bottega Veneta", item: "Jodie Bag", style: "Woven intrecciato leather - quiet luxury statement" },
        { brand: "Bottega Veneta", item: "Cassette Bag", style: "Padded intrecciato - tactile luxury" },
        { brand: "Loewe", item: "Puzzle Bag", style: "Geometric masterpiece - creative and versatile" },
        { brand: "Loewe", item: "Hammock Bag", style: "Architectural shape with multiple carrying options" },
        { brand: "Dior", item: "Lady Dior", style: "Elegant cannage quilting - forever iconic" },
        { brand: "Dior", item: "Saddle Bag", style: "Y2K revival - curved silhouette is back" },
        { brand: "Hermes", item: "Birkin", style: "The ultimate investment bag - waitlist worthy" },
        { brand: "Hermes", item: "Kelly", style: "Structured elegance with timeless appeal" },
        { brand: "YSL", item: "Loulou", style: "Chevron quilted with YSL logo - effortlessly chic" },
        { brand: "Prada", item: "Re-Edition 2005", style: "Nylon nostalgia - Y2K essential" },
        { brand: "Prada", item: "Galleria", style: "Saffiano leather - professional and polished" },
      ],
      styling: [
        "A Celine Triomphe instantly elevates any outfit - the epitome of quiet luxury.",
        "Chanel Classic Flap is an investment piece - wear it crossbody for modern styling.",
        "Mulberry Bayswater is the ultimate British bag - perfect with tailored separates.",
        "Bottega's intrecciato weave needs no logo - true 'if you know, you know' luxury.",
      ],
    },
    luxuryBagsMen: {
      trending: [
        { brand: "Louis Vuitton", item: "Christopher Backpack", style: "Monogram canvas - young, cool, and practical" },
        { brand: "Louis Vuitton", item: "Keepall 45", style: "Weekend getaway essential - iconic travel piece" },
        { brand: "Louis Vuitton", item: "District PM", style: "Messenger bag for the modern gentleman" },
        { brand: "MCM", item: "Stark Backpack", style: "Cognac visetos - statement streetwear luxury" },
        { brand: "MCM", item: "Traveler Weekender", style: "Bold logo print for the confident traveler" },
        { brand: "Gucci", item: "GG Supreme Backpack", style: "Heritage monogram with modern edge" },
        { brand: "Gucci", item: "Ophidia Messenger", style: "Web stripe detail - recognizable luxury" },
        { brand: "Prada", item: "Re-Nylon Backpack", style: "Sustainable nylon - sleek and functional" },
        { brand: "Dior", item: "Saddle Messenger", style: "Artistic statement piece for fashion-forward men" },
        { brand: "Rimowa", item: "Original Cabin", style: "Aluminum suitcase - business traveler essential" },
        { brand: "Rimowa", item: "Essential Lite", style: "Lightweight polycarbonate for frequent flyers" },
        { brand: "Tumi", item: "Alpha Bravo", style: "Professional and durable - executive choice" },
        { brand: "Montblanc", item: "Meisterstuck Briefcase", style: "Leather craftsmanship for the boardroom" },
        { brand: "Berluti", item: "Un Jour Briefcase", style: "Patina leather - ultimate in bespoke luxury" },
      ],
      styling: [
        "LV Christopher Backpack says 'young professional' - pairs perfectly with streetwear or smart casual.",
        "MCM Stark is a statement piece - let the bag be the focal point of your outfit.",
        "Rimowa is the status symbol for business travelers - sleek, durable, and instantly recognizable.",
        "A quality briefcase from Montblanc or Berluti shows you mean business.",
      ],
    },
    designerEyewear: {
      trending: [
        { brand: "Miu Miu", item: "SMU 01ZS", style: "Oversized cat-eye - playful and feminine" },
        { brand: "Miu Miu", item: "SMU 02ZS", style: "Crystal embellished - statement glamour" },
        { brand: "Miu Miu", item: "VMU 03UV", style: "Round optical frames - quirky chic" },
        { brand: "Celine", item: "CL40220I", style: "Square oversized - French minimalism" },
        { brand: "Celine", item: "Triomphe", style: "Gold-tone metal with logo - understated luxury" },
        { brand: "Prada", item: "SPR A16S", style: "Geometric cat-eye - architectural elegance" },
        { brand: "Prada", item: "VPR 14ZV", style: "Thick acetate optical - intellectual chic" },
        { brand: "Gucci", item: "GG1300S", style: "Oversized square - Hollywood glamour" },
        { brand: "Gucci", item: "GG0061S", style: "Round with Web stripe - retro luxury" },
        { brand: "Gucci", item: "GG1221O", style: "Cat-eye optical - vintage sophistication" },
        { brand: "Ray-Ban", item: "Wayfarer", style: "Timeless classic - works with everything" },
        { brand: "Ray-Ban", item: "Aviator", style: "Iconic shape - effortlessly cool" },
        { brand: "Oliver Peoples", item: "O'Malley", style: "Vintage round - celebrity favorite" },
        { brand: "Tom Ford", item: "FT0237", style: "Oversized square - bold statement" },
        { brand: "Cartier", item: "CT0270S", style: "Rimless gold - quiet wealth" },
      ],
      styling: [
        "Miu Miu sunglasses are the 'it girl' accessory - playful, feminine, and Instagram-ready.",
        "Celine eyewear embodies French minimalism - let the quality speak for itself.",
        "Prada frames add instant intellectualism - perfect for the fashion-forward professional.",
        "Gucci sunglasses are recognizable luxury - the Web stripe is iconic.",
        "For men: Cartier rimless says 'old money' while Ray-Ban Aviators are timelessly cool.",
      ],
    },
    belts: {
      trending: [
        { brand: "Hermes", item: "H Belt", style: "The iconic H buckle - investment piece" },
        { brand: "Gucci", item: "GG Marmont Belt", style: "Double G buckle - instantly recognizable" },
        { brand: "Gucci", item: "Interlocking G Belt", style: "Signature logo - statement accessory" },
        { brand: "Louis Vuitton", item: "LV Initiales Belt", style: "Monogram buckle - classic luxury" },
        { brand: "Celine", item: "Triomphe Belt", style: "Art deco buckle - quiet sophistication" },
        { brand: "Bottega Veneta", item: "Intrecciato Belt", style: "Woven leather - no-logo luxury" },
        { brand: "Prada", item: "Saffiano Belt", style: "Triangle logo - modern minimalism" },
        { brand: "YSL", item: "Cassandre Belt", style: "YSL logo buckle - Parisian chic" },
        { brand: "Dior", item: "Saddle Belt", style: "Curved buckle - statement waist definition" },
        { brand: "Ferragamo", item: "Gancini Belt", style: "Double horseshoe - Italian elegance" },
      ],
      styling: [
        "An Hermes H belt is the ultimate stealth wealth accessory - recognized by those who know.",
        "Gucci GG belt makes any outfit more fashionable - perfect for elevating jeans.",
        "Celine Triomphe belt is quiet luxury personified - elegant without being flashy.",
        "For men: Ferragamo Gancini is the boardroom power move.",
      ],
    },
    jewelry: {
      trending: [
        { brand: "Cartier", item: "Love Bracelet", style: "The commitment piece - wear it forever" },
        { brand: "Cartier", item: "Juste un Clou", style: "Nail bracelet - edgy elegance" },
        { brand: "Cartier", item: "Trinity Ring", style: "Three-band rolling ring - timeless symbolism" },
        { brand: "Tiffany & Co", item: "T Collection", style: "Modern T motif - contemporary classic" },
        { brand: "Tiffany & Co", item: "Return to Tiffany", style: "Heart tag - iconic and romantic" },
        { brand: "Tiffany & Co", item: "Elsa Peretti Bean", style: "Sculptural pendant - artistic elegance" },
        { brand: "Van Cleef & Arpels", item: "Alhambra Necklace", style: "Four-leaf clover - lucky luxury" },
        { brand: "Van Cleef & Arpels", item: "Perlee Bracelet", style: "Gold beads - playful sophistication" },
        { brand: "Bvlgari", item: "B.zero1 Ring", style: "Spiral design - bold Italian statement" },
        { brand: "Bvlgari", item: "Serpenti Bracelet", style: "Snake wrap - powerful femininity" },
        { brand: "Messika", item: "Move Collection", style: "Dancing diamonds - modern Parisian" },
        { brand: "David Yurman", item: "Cable Bracelet", style: "Twisted cable - American luxury" },
        { brand: "Mejuri", item: "Bold Hoops", style: "Affordable luxury - everyday gold" },
      ],
      mensTrending: [
        { brand: "Cartier", item: "Love Bracelet", style: "Unisex classic - commitment symbol" },
        { brand: "David Yurman", item: "Spiritual Beads", style: "Subtle sophistication - layering essential" },
        { brand: "Tom Wood", item: "Cushion Ring", style: "Scandinavian minimalism - cool and understated" },
        { brand: "Miansai", item: "Cuff Bracelet", style: "Nautical-inspired - casual luxury" },
        { brand: "Gucci", item: "Interlocking G Ring", style: "Logo jewelry - recognizable style" },
      ],
      styling: [
        "Cartier Love bracelet is the ultimate 'forever' piece - once it's on, it stays on.",
        "Van Cleef Alhambra is quiet old money - recognized by those in the know.",
        "Stack your Mejuri hoops with luxury pieces - affordable meets aspirational.",
        "For men: David Yurman and Tom Wood offer sophisticated options without being flashy.",
      ],
    },
    watches: {
      womens: [
        { brand: "Cartier", item: "Tank", style: "Art deco icon - timeless elegance" },
        { brand: "Cartier", item: "Panthère", style: "Link bracelet - jewelry meets timepiece" },
        { brand: "Rolex", item: "Datejust 31", style: "Investment classic - eternal style" },
        { brand: "Chanel", item: "J12", style: "Ceramic sporty chic - modern icon" },
      ],
      mens: [
        { brand: "Rolex", item: "Submariner", style: "The ultimate dive watch - status symbol" },
        { brand: "Rolex", item: "Datejust 41", style: "Classic everyday luxury - versatile" },
        { brand: "Omega", item: "Seamaster", style: "James Bond approved - sophisticated sporty" },
        { brand: "Patek Philippe", item: "Nautilus", style: "Holy grail - true wealth indicator" },
        { brand: "AP", item: "Royal Oak", style: "Octagonal icon - modern luxury" },
        { brand: "TAG Heuer", item: "Monaco", style: "Racing heritage - bold square case" },
      ],
      styling: [
        "A Cartier Tank is the thinking woman's watch - elegant without trying.",
        "Rolex Submariner is the modern gentleman's essential - works with everything.",
        "Patek Nautilus is 'if you know, you know' luxury - the ultimate flex.",
      ],
    },
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
  luxuryBags: [
    "That bag is everything! A Celine Triomphe or Chanel Classic Flap would be the perfect finishing touch for this outfit.",
    "Love the outfit - now let's talk arm candy! A Mulberry Bayswater or Bottega Veneta Jodie would elevate this to magazine-worthy.",
    "The bag choice here is key! Consider a structured Hermes Kelly for formal or a relaxed Loewe Puzzle for everyday chic.",
    "Your outfit is screaming for a statement bag! The Dior Lady Dior or YSL Loulou would be perfection.",
    "For quiet luxury vibes, a Celine Ava or Bottega Cassette would complete this look without being flashy.",
    "Investment bag worthy! A Chanel Boy Bag or Prada Galleria would take this outfit from great to iconic.",
  ],
  mensBags: [
    "For men: An LV Christopher Backpack would add that effortless cool factor to this outfit - young, professional, and on-trend.",
    "This look needs an MCM Stark Backpack or Gucci GG Supreme - statement luxury that shows personality.",
    "Business ready! A Rimowa suitcase and Montblanc briefcase would complete the executive traveler aesthetic.",
    "The Prada Re-Nylon Backpack would be perfect here - sleek, sustainable, and very 'I work in tech but dress well'.",
    "For frequent flyers: Tumi Alpha Bravo or Berluti Un Jour says 'I travel first class' without saying a word.",
    "That casual-cool outfit would pair perfectly with an LV Keepall 45 for weekend getaways - iconic travel style.",
  ],
  designerEyewear: [
    "Those Miu Miu sunglasses would make this outfit pop! The playful cat-eye frames are THE 'it girl' accessory right now.",
    "Celine eyewear would complete this French minimalist vibe perfectly - understated luxury at its finest.",
    "Consider Prada frames to add intellectual chic to this look - the geometric shapes are architectural elegance.",
    "Gucci sunglasses with the Web stripe would be the perfect bold statement for this outfit - recognizable luxury.",
    "For men: Cartier rimless sunglasses scream 'old money' while Ray-Ban Aviators are timelessly cool.",
    "Designer eyewear is the finishing touch! Oliver Peoples O'Malley or Tom Ford oversized frames would be perfect.",
  ],
  beltsAndAccessories: [
    "A statement belt would transform this look! An Hermes H Belt or Gucci GG Marmont adds instant luxury.",
    "Love the outfit - now cinch it with a Celine Triomphe belt for that quiet sophistication touch.",
    "This waistline is asking for definition! A YSL Cassandre or Dior Saddle belt would be stunning.",
    "For men: Ferragamo Gancini belt is the boardroom power move - Italian elegance without being flashy.",
    "Bottega Veneta Intrecciato belt is 'if you know, you know' luxury - the woven leather needs no logo.",
    "Belt styling tip: Match your belt hardware to your bag hardware for that polished, put-together look.",
  ],
  jewelryFocus: [
    "Cartier Love bracelet would be the perfect addition - the ultimate 'forever' piece for any outfit.",
    "Stack game strong! Mix Mejuri everyday pieces with a Van Cleef Alhambra for that layered luxury look.",
    "Tiffany T Collection or Elsa Peretti Bean would add modern elegance to this outfit - timeless investment pieces.",
    "For statement jewelry: Bvlgari Serpenti bracelet adds powerful femininity while staying sophisticated.",
    "Don't forget the wrist! A Cartier Tank or Rolex Datejust elevates any look - jewelry meets timepiece.",
    "For men: David Yurman Spiritual Beads or Tom Wood rings add subtle sophistication without overdoing it.",
    "Jewelry tip: The rule of three - one statement piece plus two subtle ones creates the perfect balance.",
  ],
  winterAccessories: [
    "A cashmere scarf would be the perfect finishing touch for this winter look - luxurious warmth with style!",
    "Add leather gloves to complete the sophisticated winter ensemble - both practical and chic.",
    "A wool beanie would add cosy cool vibes! Cashmere or merino wool elevates the look instantly.",
    "For women: A beret or faux fur hat would give this outfit Parisian winter chic vibes.",
    "For men: A flat cap or newsboy cap would add dapper warmth - very British gentleman.",
    "Don't forget your extremities! Quality gloves and a chunky knit scarf make winter dressing intentional, not accidental.",
    "Touch-screen gloves are a must for the modern winter wardrobe - style meets functionality.",
    "A silk-lined leather glove is the ultimate luxury winter accessory - warm, elegant, and timeless.",
  ],
  oversizedTrend: [
    "Obsessed with this oversized silhouette! The relaxed fit is PEAK 2025 fashion - you're nailing the trend.",
    "Oversized jumpers are having a major moment! Pair with fitted bottoms to balance the proportions perfectly.",
    "Love the baggy jeans! Wide-leg and relaxed denim is dominating street style right now.",
    "The oversized t-shirt look is effortlessly cool - tuck it into high-waisted trousers for definition.",
    "For women: Boyfriend blazers and oversized shirts are the ultimate power move - comfort meets confidence.",
    "The slouchy cardigan is giving major cosy-chic vibes! Layer over fitted basics for that perfect contrast.",
    "Oversized hoodie styling tip: Keep it balanced with slim or tapered bottoms to avoid looking shapeless.",
    "Wide-leg trousers are everywhere right now! The relaxed silhouette screams fashion-forward thinking.",
    "For men: Boxy fits and relaxed silhouettes show you understand modern menswear - very fashion conscious.",
  ],
};

const HASHTAG_SUGGESTIONS = [
  "#OOTD #Dripn #FashionAdvice",
  "#OutfitInspo #StyleTips #FashionCommunity",
  "#WhatIWore #FashionDiary #StreetStyle",
  "#StyleOfTheDay #OutfitGoals #FashionForward",
  "#DailyFashion #StyleInspiration #LookOfTheDay",
];

const PRODUCT_SUGGESTIONS_FEMALE = [
  { category: "Accessories", items: ["Statement earrings", "Leather belt", "Crossbody bag", "Silk scarf"] },
  { category: "Shoes", items: ["White sneakers", "Block heels", "Ankle boots", "Loafers"] },
  { category: "Layers", items: ["Denim jacket", "Cardigan", "Blazer", "Trench coat"] },
  { category: "Basics", items: ["White t-shirt", "Black trousers", "Classic jeans", "Neutral sweater"] },
  { category: "Oversized Trend", items: ["Oversized jumper", "Wide-leg trousers", "Boyfriend blazer", "Oversized t-shirt", "Baggy jeans", "Slouchy cardigan", "Oversized shirt dress", "Relaxed hoodie"] },
  { category: "Winter Accessories", items: ["Cashmere scarf", "Wool beanie", "Leather gloves", "Faux fur hat", "Chunky knit scarf", "Touch-screen gloves", "Beret", "Cable-knit mittens"] },
  { category: "Athleisure", items: ["Lululemon Align leggings", "On Running sneakers", "Gymshark seamless set", "Oversized hoodie", "Hoka running shoes"] },
  { category: "Preppy", items: ["Pearl necklace", "Cable-knit sweater", "Penny loafers", "Tennis bracelet", "Quilted handbag", "Cashmere cardigan"] },
  { category: "Countryside", items: ["Barbour jacket", "Hunter boots", "Tweed blazer", "Wax cotton bag", "Quilted gilet"] },
  { category: "Cosy Comfort", items: ["Ugg Classic Mini boots", "Ugg Classic Short boots", "Ugg Tasman slippers", "Ugg Ultra Mini boots", "Oversized baggy sweatpants", "Boyfriend jeans", "Oversized knit jumper", "Cosy fleece hoodie", "Teddy fleece jacket"] },
  { category: "Outerwear", items: ["The North Face Nuptse puffer", "The North Face rain jacket", "Rab Microlight Alpine", "Arc'teryx Beta jacket", "Jack Wolfskin waterproof", "Mackage wool coat", "Mackage down parka", "The North Face fleece"] },
  { category: "Luxury Bags", items: ["Celine Triomphe", "Chanel Classic Flap", "Mulberry Bayswater", "Bottega Veneta Jodie", "Loewe Puzzle", "Hermes Kelly", "Dior Lady Dior", "YSL Loulou"] },
  { category: "Designer Eyewear", items: ["Miu Miu cat-eye", "Celine square oversized", "Prada geometric", "Gucci Web stripe", "Ray-Ban Aviator", "Oliver Peoples O'Malley"] },
  { category: "Designer Belts", items: ["Hermes H Belt", "Gucci GG Marmont", "Celine Triomphe Belt", "Bottega Intrecciato", "YSL Cassandre", "Dior Saddle Belt"] },
  { category: "Fine Jewelry", items: ["Cartier Love Bracelet", "Tiffany T Collection", "Van Cleef Alhambra", "Bvlgari Serpenti", "Messika Move", "Mejuri Bold Hoops"] },
  { category: "Watches", items: ["Cartier Tank", "Cartier Panthere", "Rolex Datejust 31", "Chanel J12"] },
];

const PRODUCT_SUGGESTIONS_MALE = [
  { category: "Accessories", items: ["Quality leather belt", "Messenger bag", "Silk tie", "Leather wallet"] },
  { category: "Shoes", items: ["White sneakers", "Leather loafers", "Chelsea boots", "Oxford shoes"] },
  { category: "Layers", items: ["Denim jacket", "Bomber jacket", "Blazer", "Trench coat"] },
  { category: "Basics", items: ["White t-shirt", "Tailored trousers", "Classic jeans", "Quality polo shirt"] },
  { category: "Oversized Trend", items: ["Oversized hoodie", "Wide-leg trousers", "Relaxed fit jeans", "Boxy t-shirt", "Oversized knit jumper", "Relaxed blazer"] },
  { category: "Winter Accessories", items: ["Wool scarf", "Cashmere beanie", "Leather gloves", "Flat cap", "Merino wool scarf", "Driving gloves", "Newsboy cap", "Tech-friendly gloves"] },
  { category: "Athleisure", items: ["Gymshark training shorts", "On Running sneakers", "Performance hoodie", "Hoka running shoes", "Nike Dri-Fit tee"] },
  { category: "Preppy", items: ["Cable-knit sweater", "Penny loafers", "Oxford shirt", "Cashmere cardigan", "Blazer with gold buttons"] },
  { category: "Countryside", items: ["Barbour jacket", "Hunter boots", "Tweed blazer", "Flat cap", "Quilted gilet"] },
  { category: "Football Casual", items: ["Stone Island jumper", "Stone Island jacket", "C.P. Company goggle jacket", "C.P. Company soft shell", "Lyle & Scott polo", "Lyle & Scott quarter zip", "Straight-leg jeans", "White trainers", "Stone Island badge hoodie", "C.P. Company lens beanie"] },
  { category: "Outerwear", items: ["The North Face Nuptse", "The North Face McMurdo parka", "The North Face rain jacket", "Rab Microlight jacket", "Arc'teryx Beta jacket", "Arc'teryx Atom hoodie", "Jack Wolfskin parka", "Jack Wolfskin rain jacket"] },
  { category: "Luxury Bags", items: ["LV Christopher Backpack", "MCM Stark Backpack", "Gucci GG Supreme", "Rimowa Original Cabin", "Tumi Alpha Bravo", "Montblanc Briefcase", "Berluti Un Jour"] },
  { category: "Designer Eyewear", items: ["Ray-Ban Aviator", "Ray-Ban Wayfarer", "Cartier rimless", "Oliver Peoples O'Malley", "Tom Ford square", "Persol 649"] },
  { category: "Designer Belts", items: ["Hermes H Belt", "Gucci GG Marmont", "Ferragamo Gancini", "Bottega Intrecciato", "Louis Vuitton Initiales"] },
  { category: "Fine Jewelry", items: ["Cartier Love Bracelet", "David Yurman Spiritual Beads", "Tom Wood Cushion Ring", "Miansai Cuff", "Gucci Interlocking G Ring"] },
  { category: "Watches", items: ["Rolex Submariner", "Rolex Datejust 41", "Omega Seamaster", "Patek Philippe Nautilus", "TAG Heuer Monaco", "AP Royal Oak"] },
];

const CURATED_OUTFIT_LIBRARY: Record<string, Record<'female' | 'male', { id: string; imageUri: string; title: string; description: string }[]>> = {
  casual: {
    female: [
      { id: 'cas-f-1', imageUri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400', title: 'Relaxed Weekend Look', description: 'High-waisted jeans with a cozy knit sweater and white sneakers' },
      { id: 'cas-f-2', imageUri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400', title: 'Effortless Chic', description: 'Oversized blazer with vintage tee and mom jeans' },
      { id: 'cas-f-3', imageUri: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400', title: 'Coffee Run Ready', description: 'Midi skirt with tucked blouse and ankle boots' },
      { id: 'cas-f-4', imageUri: 'https://images.unsplash.com/photo-1485968579169-a6f4c5cb8365?w=400', title: 'Minimalist Casual', description: 'Wide-leg trousers with fitted turtleneck' },
    ],
    male: [
      { id: 'cas-m-1', imageUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', title: 'Smart Weekend', description: 'Chinos with polo shirt and leather loafers' },
      { id: 'cas-m-2', imageUri: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400', title: 'Urban Casual', description: 'Dark jeans with crew neck sweater and clean sneakers' },
      { id: 'cas-m-3', imageUri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', title: 'Layered Look', description: 'Oxford shirt under lightweight knit with chinos' },
      { id: 'cas-m-4', imageUri: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400', title: 'Relaxed Modern', description: 'Relaxed fit jeans with quality t-shirt and bomber jacket' },
    ],
  },
  formal: {
    female: [
      { id: 'for-f-1', imageUri: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400', title: 'Power Suit', description: 'Tailored blazer with matching trousers and silk cami' },
      { id: 'for-f-2', imageUri: 'https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=400', title: 'Elegant Evening', description: 'Midi dress with statement jewelry and heels' },
      { id: 'for-f-3', imageUri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400', title: 'Business Chic', description: 'Pencil skirt with structured blouse and court shoes' },
      { id: 'for-f-4', imageUri: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400', title: 'Sophisticated Style', description: 'Wide-leg suit with delicate accessories' },
    ],
    male: [
      { id: 'for-m-1', imageUri: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400', title: 'Classic Suit', description: 'Navy two-piece suit with crisp white shirt and silk tie' },
      { id: 'for-m-2', imageUri: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400', title: 'Modern Business', description: 'Slim-fit charcoal suit with minimal accessories' },
      { id: 'for-m-3', imageUri: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400', title: 'Executive Look', description: 'Three-piece suit with pocket square and oxford shoes' },
      { id: 'for-m-4', imageUri: 'https://images.unsplash.com/photo-1611601322175-ef8ae6e5ba8f?w=400', title: 'Black Tie', description: 'Tuxedo with bow tie and patent leather shoes' },
    ],
  },
  streetwear: {
    female: [
      { id: 'str-f-1', imageUri: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400', title: 'Urban Edge', description: 'Oversized hoodie with bike shorts and chunky sneakers' },
      { id: 'str-f-2', imageUri: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400', title: 'Street Chic', description: 'Cargo pants with crop top and platform sneakers' },
      { id: 'str-f-3', imageUri: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=400', title: 'Athleisure Mix', description: 'Track pants with vintage band tee and dad sneakers' },
      { id: 'str-f-4', imageUri: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400', title: 'Bold Statement', description: 'Oversized denim jacket with graphic tee and baggy jeans' },
    ],
    male: [
      { id: 'str-m-1', imageUri: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400', title: 'Hypebeast', description: 'Oversized tee with joggers and limited edition sneakers' },
      { id: 'str-m-2', imageUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', title: 'Urban Cool', description: 'Hoodie layered under bomber with distressed jeans' },
      { id: 'str-m-3', imageUri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', title: 'Skater Style', description: 'Graphic hoodie with cargo pants and Vans' },
      { id: 'str-m-4', imageUri: 'https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?w=400', title: 'Tech Wear', description: 'Utility vest with black basics and chunky boots' },
    ],
  },
  boho: {
    female: [
      { id: 'boh-f-1', imageUri: 'https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400', title: 'Free Spirit', description: 'Flowy maxi dress with layered jewelry and sandals' },
      { id: 'boh-f-2', imageUri: 'https://images.unsplash.com/photo-1509087859087-a384654eca4d?w=400', title: 'Earthy Elegance', description: 'Crochet top with wide-leg pants and leather bag' },
      { id: 'boh-f-3', imageUri: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=400', title: 'Festival Ready', description: 'Tiered skirt with embroidered blouse and fringe bag' },
      { id: 'boh-f-4', imageUri: 'https://images.unsplash.com/photo-1523264766585-fb8c0bc0c4a7?w=400', title: 'Vintage Boho', description: 'Floral midi dress with denim jacket and ankle boots' },
    ],
    male: [
      { id: 'boh-m-1', imageUri: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400', title: 'Relaxed Artisan', description: 'Linen shirt with loose trousers and leather sandals' },
      { id: 'boh-m-2', imageUri: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400', title: 'Earth Tones', description: 'Natural fiber sweater with chinos and suede boots' },
      { id: 'boh-m-3', imageUri: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400', title: 'Festival Casual', description: 'Printed shirt with rolled-up jeans and espadrilles' },
      { id: 'boh-m-4', imageUri: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=400', title: 'Coastal Boho', description: 'Open linen shirt with shorts and woven accessories' },
    ],
  },
  sporty: {
    female: [
      { id: 'spo-f-1', imageUri: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400', title: 'Gym to Street', description: 'High-waisted leggings with crop top and trainers' },
      { id: 'spo-f-2', imageUri: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400', title: 'Active Chic', description: 'Tennis skirt with fitted top and sneakers' },
      { id: 'spo-f-3', imageUri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400', title: 'Yoga Ready', description: 'Matching set with lightweight jacket and trainers' },
      { id: 'spo-f-4', imageUri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', title: 'Running Style', description: 'Performance leggings with sports bra and windbreaker' },
    ],
    male: [
      { id: 'spo-m-1', imageUri: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', title: 'Training Ready', description: 'Performance shorts with fitted tank and running shoes' },
      { id: 'spo-m-2', imageUri: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400', title: 'Athleisure King', description: 'Track pants with hoodie and designer sneakers' },
      { id: 'spo-m-3', imageUri: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400', title: 'Gym Essential', description: 'Compression wear with performance tee and trainers' },
      { id: 'spo-m-4', imageUri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', title: 'Active Lifestyle', description: 'Joggers with performance polo and clean sneakers' },
    ],
  },
  business: {
    female: [
      { id: 'bus-f-1', imageUri: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400', title: 'Corporate Chic', description: 'Tailored dress with structured blazer and heels' },
      { id: 'bus-f-2', imageUri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400', title: 'Boardroom Ready', description: 'Suit separates with silk blouse and pumps' },
      { id: 'bus-f-3', imageUri: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400', title: 'Power Dressing', description: 'Wide-leg trousers with tucked blouse and statement belt' },
      { id: 'bus-f-4', imageUri: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400', title: 'Modern Professional', description: 'Midi skirt with knit top and pointed toe flats' },
    ],
    male: [
      { id: 'bus-m-1', imageUri: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400', title: 'Executive Style', description: 'Charcoal suit with light blue shirt and leather shoes' },
      { id: 'bus-m-2', imageUri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', title: 'Business Casual', description: 'Chinos with button-down and loafers' },
      { id: 'bus-m-3', imageUri: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400', title: 'Sharp Professional', description: 'Navy blazer with grey trousers and oxford shoes' },
      { id: 'bus-m-4', imageUri: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400', title: 'Meeting Ready', description: 'Three-piece suit with pocket square and cufflinks' },
    ],
  },
  edgy: {
    female: [
      { id: 'edg-f-1', imageUri: 'https://images.unsplash.com/photo-1509096942067-6ad8f1f0d0e9?w=400', title: 'Rock Chic', description: 'Leather jacket with band tee and ripped jeans' },
      { id: 'edg-f-2', imageUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', title: 'Dark Romance', description: 'All black with lace details and combat boots' },
      { id: 'edg-f-3', imageUri: 'https://images.unsplash.com/photo-1534126416832-a88fdf2911c2?w=400', title: 'Punk Princess', description: 'Plaid skirt with fishnet tights and platform boots' },
      { id: 'edg-f-4', imageUri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400', title: 'Modern Goth', description: 'Oversized blazer with leather pants and statement jewelry' },
    ],
    male: [
      { id: 'edg-m-1', imageUri: 'https://images.unsplash.com/photo-1541855492-581f618f69a0?w=400', title: 'Rocker Style', description: 'Leather jacket with slim jeans and boots' },
      { id: 'edg-m-2', imageUri: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=400', title: 'Dark Minimal', description: 'All black with layered textures and silver accents' },
      { id: 'edg-m-3', imageUri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', title: 'Punk Revival', description: 'Studded jacket with ripped jeans and combat boots' },
      { id: 'edg-m-4', imageUri: 'https://images.unsplash.com/photo-1553267751-1c148a7280a1?w=400', title: 'Urban Edge', description: 'Distressed denim with graphic tee and chunky boots' },
    ],
  },
  terrace: {
    female: [
      { id: 'ter-f-1', imageUri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400', title: 'Match Day Ready', description: 'Relaxed jeans with cozy knit jumper and clean trainers' },
      { id: 'ter-f-2', imageUri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400', title: 'Casual Supporter', description: 'Straight-leg jeans with quarter zip and white sneakers' },
      { id: 'ter-f-3', imageUri: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400', title: 'Stadium Style', description: 'Fitted jacket with comfortable jeans and trainers' },
      { id: 'ter-f-4', imageUri: 'https://images.unsplash.com/photo-1485968579169-a6f4c5cb8365?w=400', title: 'Football Casual', description: 'Polo shirt with straight-leg jeans and white trainers' },
    ],
    male: [
      { id: 'ter-m-1', imageUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', title: 'Stone Island Look', description: 'Stone Island jumper with straight-leg jeans and white trainers' },
      { id: 'ter-m-2', imageUri: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400', title: 'C.P. Company Style', description: 'C.P. Company goggle jacket with quality jeans and clean trainers' },
      { id: 'ter-m-3', imageUri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', title: 'Lyle & Scott Classic', description: 'Lyle & Scott polo with straight-leg jeans and white trainers' },
      { id: 'ter-m-4', imageUri: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400', title: 'Match Day Essential', description: 'Designer jumper with selvedge denim and premium white trainers' },
    ],
  },
  cosy: {
    female: [
      { id: 'cos-f-1', imageUri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400', title: 'Ugg & Joggers', description: 'Ugg Classic Mini boots with oversized baggy sweatpants and cosy knit jumper' },
      { id: 'cos-f-2', imageUri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400', title: 'Weekend Comfort', description: 'Ugg Tasman slippers with boyfriend jeans and oversized hoodie' },
      { id: 'cos-f-3', imageUri: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400', title: 'Cosy Chic', description: 'Ugg Ultra Mini boots with baggy joggers and teddy fleece jacket' },
      { id: 'cos-f-4', imageUri: 'https://images.unsplash.com/photo-1485968579169-a6f4c5cb8365?w=400', title: 'Autumn Essential', description: 'Classic Ugg boots with boyfriend jeans and oversized cardigan' },
    ],
    male: [
      { id: 'cos-m-1', imageUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', title: 'Relaxed Weekend', description: 'Comfortable joggers with oversized hoodie and clean trainers' },
      { id: 'cos-m-2', imageUri: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400', title: 'Home Comfort', description: 'Fleece-lined joggers with cosy knit jumper and slippers' },
      { id: 'cos-m-3', imageUri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', title: 'Casual Comfort', description: 'Baggy sweatpants with teddy fleece jacket and slides' },
      { id: 'cos-m-4', imageUri: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400', title: 'Lounge Ready', description: 'Oversized joggers with fleece hoodie and comfortable slippers' },
    ],
  },
};

const OUTFIT_GENERATION_PROMPTS: Record<string, string[]> = {
  casual: [
    'A stylish casual outfit featuring relaxed-fit jeans paired with a cozy oversized sweater in neutral tones',
    'Effortless weekend look with high-waisted mom jeans, vintage-inspired graphic tee, and clean white sneakers',
    'Minimalist casual ensemble with wide-leg trousers, fitted turtleneck, and leather accessories',
  ],
  formal: [
    'Elegant evening look with tailored suit in deep navy, silk pocket square, and polished oxford shoes',
    'Power dressing outfit featuring structured blazer, matching trousers, and statement heels',
    'Sophisticated cocktail attire with midi dress, delicate jewelry, and pointed-toe pumps',
  ],
  streetwear: [
    'Urban streetwear look with oversized hoodie, baggy cargo pants, and limited-edition sneakers',
    'Hypebeast style featuring designer logo tee, distressed jeans, and chunky platform sneakers',
    'Tech-wear inspired outfit with utility vest, slim joggers, and futuristic sneakers',
  ],
  boho: [
    'Free-spirited boho look with flowing maxi dress, layered necklaces, and leather sandals',
    'Earthy bohemian style featuring crochet top, wide-leg linen pants, and woven accessories',
    'Festival-ready outfit with embroidered blouse, tiered skirt, and fringe crossbody bag',
  ],
  sporty: [
    'Gym-to-street athleisure with high-waisted leggings, sports bra, and oversized bomber jacket',
    'Performance-inspired look with matching set, lightweight windbreaker, and designer trainers',
    'Active lifestyle outfit featuring joggers, fitted tank, and premium running shoes',
  ],
  business: [
    'Executive style with tailored charcoal suit, crisp white shirt, and leather briefcase',
    'Modern business casual featuring navy blazer, chinos, and loafers without socks',
    'Corporate chic look with pencil skirt, silk blouse, and structured handbag',
  ],
  edgy: [
    'Rock-inspired outfit with leather jacket, band tee, ripped black jeans, and combat boots',
    'Dark romantic style featuring all-black ensemble with lace details and statement jewelry',
    'Punk revival look with studded jacket, slim trousers, and platform boots',
  ],
  terrace: [
    'Classic football casual look with Stone Island jumper, straight-leg jeans, and crisp white trainers',
    'Match day style featuring C.P. Company soft shell jacket with quality denim and clean sneakers',
    'Terrace-inspired outfit with Lyle & Scott polo, straight-leg jeans, and white trainers',
    'Premium casual look with designer jumper, selvedge denim, and box-fresh white trainers',
  ],
  cosy: [
    'Ultimate comfort look with Ugg Classic Mini boots, oversized baggy sweatpants, and cosy knit jumper',
    'Relaxed autumn style featuring Ugg Tasman slippers with boyfriend jeans and teddy fleece jacket',
    'Weekend comfort outfit with Ugg boots, baggy joggers, and oversized hoodie in neutral tones',
    'Effortless cosy chic with Ugg Ultra Mini boots, wide-leg sweatpants, and chunky knit cardigan',
  ],
};

export interface SimilarOutfit {
  id: string;
  imageUri: string;
  title: string;
  description?: string;
  style: string;
  isSaved?: boolean;
}

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
  generatedOutfitImage?: string;
  generatedOutfitDescription?: string;
  similarOutfits?: SimilarOutfit[];
  trendInsights?: {
    hotItems: TrendingItem[];
    recommendedInfluencers: FashionInfluencer[];
    colorTrends: ColorTrend[];
    styleMovement?: StyleMovement;
    culturalNotes: string[];
    publications: { name: string; focus: string }[];
  };
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
    'Jamaica': 'Latin America', 'Dominican Republic': 'Latin America', 'Trinidad and Tobago': 'Latin America',
    'Barbados': 'Latin America', 'Bahamas': 'Latin America', 'Saint Lucia': 'Latin America',
    'Australia': 'Australia', 'New Zealand': 'Australia',
  };
  return regionMap[country] || 'North America';
}

const REGIONAL_TERMINOLOGY: Record<string, Record<string, string>> = {
  'UK': {
    'sneakers': 'trainers',
    'pants': 'trousers',
    'sweater': 'jumper',
    'vest': 'waistcoat',
    'undershirt': 'vest',
    'fanny pack': 'bum bag',
    'turtleneck': 'polo neck',
    'suspenders': 'braces',
    'thongs': 'flip-flops',
  },
  'Australia': {
    'sneakers': 'trainers',
    'flip-flops': 'thongs',
    'swimsuit': 'cossie',
    'sweater': 'jumper',
  },
  'North America': {
    'trainers': 'sneakers',
    'trousers': 'pants',
    'jumper': 'sweater',
    'waistcoat': 'vest',
    'polo neck': 'turtleneck',
    'braces': 'suspenders',
    'bum bag': 'fanny pack',
  },
};

export function localizeClothingTerm(term: string, country: string): string {
  const region = getRegionFromCountry(country);
  const regionTerms = REGIONAL_TERMINOLOGY[region];
  if (!regionTerms) return term;
  
  const lowerTerm = term.toLowerCase();
  for (const [from, to] of Object.entries(regionTerms)) {
    if (lowerTerm.includes(from)) {
      return term.replace(new RegExp(from, 'gi'), to);
    }
  }
  return term;
}

export function localizeAdviceText(text: string, country: string): string {
  const region = getRegionFromCountry(country);
  const regionTerms = REGIONAL_TERMINOLOGY[region];
  if (!regionTerms) return text;
  
  let localizedText = text;
  for (const [from, to] of Object.entries(regionTerms)) {
    const regex = new RegExp(`\\b${from}\\b`, 'gi');
    localizedText = localizedText.replace(regex, to);
  }
  return localizedText;
}

function generateInfluencerInsight(region: string, userGender?: string): string {
  const regionData = REGIONAL_INFLUENCER_STYLES[region];
  if (!regionData) return "";
  
  const genderFilter = userGender === 'man' ? 'male' : 'female';
  const genderedInfluencers = regionData.influencers.filter(i => i.gender === genderFilter);
  const influencer = getRandomItem(genderedInfluencers.length > 0 ? genderedInfluencers : regionData.influencers);
  
  const genderSpecificTips = regionData.styleTips.filter(tip => {
    if (genderFilter === 'male') {
      return tip.toLowerCase().includes('men') || tip.toLowerCase().includes('his') || 
             !tip.toLowerCase().includes('women') && !tip.toLowerCase().includes('her ') && !tip.toLowerCase().includes('she ');
    }
    return tip.toLowerCase().includes('women') || tip.toLowerCase().includes('her ') ||
           !tip.toLowerCase().includes('men') && !tip.toLowerCase().includes('his ');
  });
  
  const styleTip = getRandomItem(genderSpecificTips.length > 0 ? genderSpecificTips : regionData.styleTips);
  
  return styleTip;
}

function generateTrendingTip(description: string, userGender?: string): string {
  const descLower = description.toLowerCase();
  const isMale = userGender === 'man';
  
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
  
  if (descLower.includes('scarf') || descLower.includes('gloves') || descLower.includes('beanie') || 
      descLower.includes('mittens') || descLower.includes('hat') || descLower.includes('beret')) {
    const winterTips = STYLE_ADVICE_TEMPLATES.winterAccessories.filter(tip => {
      const tipLower = tip.toLowerCase();
      if (isMale) return tipLower.includes('men') || (!tipLower.includes('women') && !tipLower.includes('beret'));
      return tipLower.includes('women') || !tipLower.includes('men');
    });
    return getRandomItem(winterTips.length > 0 ? winterTips : STYLE_ADVICE_TEMPLATES.winterAccessories);
  }
  
  if (descLower.includes('oversized') || descLower.includes('baggy') || descLower.includes('relaxed') || 
      descLower.includes('loose') || descLower.includes('boxy') || descLower.includes('slouchy') ||
      descLower.includes('wide leg') || descLower.includes('boyfriend')) {
    const oversizedTips = STYLE_ADVICE_TEMPLATES.oversizedTrend.filter(tip => {
      const tipLower = tip.toLowerCase();
      if (isMale) return tipLower.includes('men') || (!tipLower.includes('women') && !tipLower.includes('boyfriend'));
      return tipLower.includes('women') || !tipLower.includes('men');
    });
    return getRandomItem(oversizedTips.length > 0 ? oversizedTips : STYLE_ADVICE_TEMPLATES.oversizedTrend);
  }
  
  const tips = STYLE_ADVICE_TEMPLATES.trendingNow.filter(tip => {
    const tipLower = tip.toLowerCase();
    if (isMale) {
      return !tipLower.includes('dress') && !tipLower.includes('skirt') && !tipLower.includes('heels');
    }
    return true;
  });
  
  return getRandomItem(tips.length > 0 ? tips : STYLE_ADVICE_TEMPLATES.trendingNow);
}

async function generateAdvice(
  description: string,
  userCountry?: string,
  userGender?: string,
  subscriptionTier: SubscriptionTier | string = 'free',
  userGoals: DripnGoal[] = [],
  extendedPrefs?: Partial<ExtendedPreferences>
): Promise<AIAdviceResult> {
  const tier = normalizeSubscriptionTier(subscriptionTier);
  const isPaid = isPaidTier(tier);
  const trendLimits = getTrendPreviewLimits(tier);
  const descLower = description.toLowerCase();

  let category: 'general' | 'casual' | 'formal' = 'general';
  if (descLower.includes('casual') || descLower.includes('jeans') || descLower.includes('sneaker')) {
    category = 'casual';
  } else if (descLower.includes('formal') || descLower.includes('business') || descLower.includes('dress') || descLower.includes('suit')) {
    category = 'formal';
  }

  const goalFeatures = ContentPersonalizationService.getActiveGoalFeatures(userGoals);
  const feedConfig = ContentPersonalizationService.getPersonalizedFeedConfig(userGoals, extendedPrefs, userGender as any);

  const mainAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES[category]);
  const colorAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.colorAdvice);
  const proportionAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.proportions);
  const seasonalAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.seasonal[getCurrentSeason()]);
  const sizeInclusiveAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.sizeInclusive);
  
  const region = userCountry ? getRegionFromCountry(userCountry) : 'North America';
  const influencerInsight = generateInfluencerInsight(region, userGender);
  const trendingTip = generateTrendingTip(description, userGender);

  const suggestions = [seasonalAdvice];
  if (isPaid) {
    suggestions.push(sizeInclusiveAdvice);
  }

  if (userGoals.length > 0) {
    if (goalFeatures.showDeals) {
      suggestions.push("Budget tip: Check our Bargains section for today's best deals on similar pieces!");
    }
    if (goalFeatures.showProfessionalSection && (descLower.includes('work') || descLower.includes('office') || descLower.includes('meeting'))) {
      suggestions.push("Professional tip: This look projects confidence and competence - perfect for making an impression.");
    }
    if (goalFeatures.showWardrobeTools) {
      suggestions.push("Wardrobe building tip: This is a versatile piece that pairs with multiple items in your closet.");
    }
    if (goalFeatures.showOccasionPlanner && (descLower.includes('party') || descLower.includes('event') || descLower.includes('date') || descLower.includes('wedding'))) {
      suggestions.push("Event styling tip: This outfit is perfectly dressed for the occasion - you'll stand out beautifully!");
    }
    if (goalFeatures.showCommunity) {
      suggestions.push("Community tip: Share this look to connect with others who love this style!");
    }
    if (goalFeatures.showStyleTips) {
      suggestions.push("Style elevation tip: Small details like fit and accessories can transform this from good to stunning.");
    }
  }

  const hashtags = getRandomItem(HASHTAG_SUGGESTIONS).split(' ');

  const numProducts = tier === 'stylist_unlimited' ? 3 : isPaid ? 2 : 1;
  const genderProducts = userGender === 'man' ? PRODUCT_SUGGESTIONS_MALE : PRODUCT_SUGGESTIONS_FEMALE;
  const shuffledProducts = [...genderProducts].sort(() => Math.random() - 0.5);
  const productRecommendations = shuffledProducts.slice(0, numProducts);

  const localizedMainAdvice = userCountry ? localizeAdviceText(mainAdvice, userCountry) : mainAdvice;
  const localizedColorAdvice = userCountry && colorAdvice ? localizeAdviceText(colorAdvice, userCountry) : colorAdvice;
  const localizedTrendingTip = userCountry && trendingTip ? localizeAdviceText(trendingTip, userCountry) : trendingTip;
  
  const localizedProducts = productRecommendations.map(cat => ({
    category: cat.category,
    items: userCountry ? cat.items.map(item => localizeClothingTerm(item, userCountry)) : cat.items,
  }));

  let trendInsights: AIAdviceResult['trendInsights'] = undefined;
  
  if (trendLimits && userCountry) {
    try {
      const genderParam: 'male' | 'female' = userGender === 'man' ? 'male' : 'female';
      
      const [hotItems, influencers, colorTrends, styleMovements, publications, culturalNotes] = await Promise.all([
        TrendInsightsService.getTrendingItemsForRegion(userCountry, genderParam),
        TrendInsightsService.getInfluencersForRegion(userCountry, genderParam),
        TrendInsightsService.getColorPaletteForRegion(userCountry),
        TrendInsightsService.getStyleMovementsForRegion(userCountry),
        TrendInsightsService.getPublicationsForRegion(userCountry, genderParam),
        TrendInsightsService.getCulturalNotesForRegion(userCountry),
      ]);

      trendInsights = {
        hotItems: hotItems.slice(0, trendLimits.itemLimit),
        recommendedInfluencers: influencers.slice(0, trendLimits.influencerLimit),
        colorTrends: Number.isFinite(trendLimits.colorTrendLimit)
          ? colorTrends.slice(0, trendLimits.colorTrendLimit)
          : colorTrends,
        styleMovement: trendLimits.includeStyleMovement ? styleMovements[0] : undefined,
        culturalNotes: Number.isFinite(trendLimits.culturalNotesLimit)
          ? culturalNotes.slice(0, trendLimits.culturalNotesLimit)
          : culturalNotes,
        publications: publications.map(p => ({ name: p.name, focus: p.focus })),
      };

      if (hotItems.length > 0) {
        const topHotItem = hotItems[0];
        const hotItemTip = `Hot trend alert: ${topHotItem.name} is trending in your region! ${topHotItem.description}. Check out ${topHotItem.brands.slice(0, 2).join(' and ')}.`;
        suggestions.push(hotItemTip);
      }

      if (trendLimits.includeInfluencerSpotlight && influencers.length > 0) {
        const topInfluencer = influencers[0];
        const influencerTip = `Follow ${topInfluencer.name} (${topInfluencer.handle}) for ${topInfluencer.specialty.slice(0, 2).join(' and ')} inspiration.`;
        suggestions.push(influencerTip);
      }

      if (trendLimits.includeColorForecastTip && colorTrends.length > 0) {
        const trendingColor = colorTrends[0];
        const colorTip = `2025/2026 Colour Forecast: ${trendingColor.name} is the colour of the moment for ${trendingColor.usage.slice(0, 2).join(' and ')}.`;
        suggestions.push(colorTip);
      }

      if (trendLimits.includeEarlyAccessTip) {
        suggestions.push(`Stylist Unlimited early access: Get tomorrow's trends today — insights are weeks ahead of mainstream coverage.`);
      }
    } catch (error) {
      console.warn('Failed to fetch trend insights:', error);
    }
  }

  const genderParam: 'male' | 'female' = userGender === 'man' ? 'male' : 'female';
  const styleCategory = detectStyleCategory(description);
  const similarOutfits = getSimilarOutfits(styleCategory, genderParam, 4);
  const generatedOutfitDescription = generateOutfitDescription(styleCategory, genderParam);

  return {
    mainAdvice: localizedMainAdvice,
    colorAdvice: isPaid ? localizedColorAdvice : undefined,
    proportionAdvice: tier === 'stylist_unlimited' ? proportionAdvice : undefined,
    suggestions,
    hashtags,
    productRecommendations: localizedProducts,
    confidence: 0.85 + Math.random() * 0.1,
    influencerInsight: isPaid ? influencerInsight : undefined,
    trendingTip: localizedTrendingTip,
    trendInsights,
    generatedOutfitDescription: isPaid ? generatedOutfitDescription : undefined,
    similarOutfits: similarOutfits,
  };
}

function detectStyleCategory(description: string): string {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('formal') || descLower.includes('suit') || descLower.includes('evening') || descLower.includes('cocktail')) {
    return 'formal';
  }
  if (descLower.includes('street') || descLower.includes('urban') || descLower.includes('sneaker') || descLower.includes('hoodie')) {
    return 'streetwear';
  }
  if (descLower.includes('boho') || descLower.includes('bohemian') || descLower.includes('flowy') || descLower.includes('maxi')) {
    return 'boho';
  }
  if (descLower.includes('sport') || descLower.includes('gym') || descLower.includes('athletic') || descLower.includes('legging')) {
    return 'sporty';
  }
  if (descLower.includes('business') || descLower.includes('office') || descLower.includes('professional') || descLower.includes('work')) {
    return 'business';
  }
  if (descLower.includes('edgy') || descLower.includes('leather') || descLower.includes('punk') || descLower.includes('rock')) {
    return 'edgy';
  }
  if (descLower.includes('football') || descLower.includes('match day') || descLower.includes('matchday') || 
      descLower.includes('terrace') || descLower.includes('stone island') || descLower.includes('c.p. company') || 
      descLower.includes('cp company') || descLower.includes('lyle & scott') || descLower.includes('lyle and scott') ||
      descLower.includes('stadium') || descLower.includes('soccer') || descLower.includes('premier league')) {
    return 'terrace';
  }
  if (descLower.includes('ugg') || descLower.includes('cosy') || descLower.includes('cozy') || 
      descLower.includes('comfort') || descLower.includes('slippers') || descLower.includes('baggy sweatpants') ||
      descLower.includes('boyfriend jeans') || descLower.includes('loungewear') || descLower.includes('fleece') ||
      descLower.includes('joggers') || descLower.includes('relaxed') || descLower.includes('oversized sweats')) {
    return 'cosy';
  }
  
  return 'casual';
}

function getSimilarOutfits(styleCategory: string, gender: 'male' | 'female', count: number = 4): SimilarOutfit[] {
  const categoryOutfits = CURATED_OUTFIT_LIBRARY[styleCategory];
  if (!categoryOutfits) {
    return getSimilarOutfits('casual', gender, count);
  }
  
  const genderOutfits = categoryOutfits[gender];
  if (!genderOutfits || genderOutfits.length === 0) {
    return [];
  }
  
  const shuffled = [...genderOutfits].sort(() => Math.random() - 0.5);
  
  return shuffled.slice(0, count).map(outfit => ({
    id: outfit.id,
    imageUri: outfit.imageUri,
    title: outfit.title,
    description: outfit.description,
    style: styleCategory,
    isSaved: false,
  }));
}

function generateOutfitDescription(styleCategory: string, gender: 'male' | 'female'): string {
  const prompts = OUTFIT_GENERATION_PROMPTS[styleCategory];
  if (!prompts || prompts.length === 0) {
    return OUTFIT_GENERATION_PROMPTS.casual[0];
  }
  
  const basePrompt = getRandomItem(prompts);
  const genderModifier = gender === 'male' ? 'masculine' : 'feminine';
  
  return `${basePrompt}, with a ${genderModifier} silhouette and contemporary styling details`;
}

export function getOutfitInspirationByStyle(style: string, gender: 'male' | 'female', count: number = 4): SimilarOutfit[] {
  return getSimilarOutfits(style, gender, count);
}

export async function getAIFashionAdvice(
  imageUri: string,
  description: string,
  subscriptionTier: SubscriptionTier | string = 'free',
  userCountry?: string,
  userGender?: string,
  userGoals: DripnGoal[] = [],
  extendedPrefs?: Partial<ExtendedPreferences>
): Promise<AIAdviceResult> {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  return generateAdvice(description, userCountry, userGender, subscriptionTier, userGoals, extendedPrefs);
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

export function getInfluencerStyleGuide(country: string, userGender?: string): {
  influencers: { name: string; handle: string; signature: string }[];
  styleTips: string[];
  trendingPieces: string[];
} {
  const region = getRegionFromCountry(country);
  const regionData = REGIONAL_INFLUENCER_STYLES[region] || REGIONAL_INFLUENCER_STYLES['North America'];
  const genderFilter = userGender === 'man' ? 'male' : 'female';
  
  const genderedInfluencers = regionData.influencers.filter(i => i.gender === genderFilter);
  const trendingPieces = userGender === 'man' && regionData.mensTrendingPieces 
    ? regionData.mensTrendingPieces 
    : regionData.trendingPieces;
  const styleTips = userGender === 'man' && regionData.mensStyleTips 
    ? regionData.mensStyleTips 
    : regionData.styleTips;
  
  return {
    influencers: genderedInfluencers.length > 0 ? genderedInfluencers : regionData.influencers,
    styleTips,
    trendingPieces,
  };
}

export function getStyleOfTheDayContent(country: string, userGender?: string): {
  title: string;
  tip: string;
  influencerCredit: string;
  trendingColors: string[];
  mustHavePieces: string[];
} {
  const region = getRegionFromCountry(country);
  const regionData = REGIONAL_INFLUENCER_STYLES[region] || REGIONAL_INFLUENCER_STYLES['North America'];
  const genderFilter = userGender === 'man' ? 'male' : 'female';
  
  const genderedInfluencers = regionData.influencers.filter(i => i.gender === genderFilter);
  const influencer = getRandomItem(genderedInfluencers.length > 0 ? genderedInfluencers : regionData.influencers);
  const mustHavePieces = userGender === 'man' && regionData.mensTrendingPieces 
    ? regionData.mensTrendingPieces 
    : regionData.trendingPieces;
  const styleTips = userGender === 'man' && regionData.mensStyleTips 
    ? regionData.mensStyleTips 
    : regionData.styleTips;
  
  return {
    title: `Today's Style Inspiration from ${region}`,
    tip: getRandomItem(styleTips),
    influencerCredit: `Inspired by ${influencer.name} (${influencer.handle})`,
    trendingColors: TRENDING_STYLES_2025_2026.colors.hot.slice(0, 4),
    mustHavePieces,
  };
}

export async function getTrendInsightsForUser(
  country: string,
  gender: 'male' | 'female',
  subscriptionTier: SubscriptionTier | string
): Promise<{
  hotItems: TrendingItem[];
  influencers: FashionInfluencer[];
  colorTrends: ColorTrend[];
  styleMovements: StyleMovement[];
  culturalNotes: string[];
  publications: { name: string; focus: string; gender: string }[];
  globalTrendingBrands: string[];
  colorForecast2025: ColorTrend[];
} | null> {
  const trendLimits = getTrendPreviewLimits(subscriptionTier);
  if (!trendLimits) {
    return null;
  }

  try {
    const [hotItems, influencers, colorTrends, styleMovements, culturalNotes, publications] = await Promise.all([
      TrendInsightsService.getTrendingItemsForRegion(country, gender),
      TrendInsightsService.getInfluencersForRegion(country, gender),
      TrendInsightsService.getColorPaletteForRegion(country),
      TrendInsightsService.getStyleMovementsForRegion(country),
      TrendInsightsService.getCulturalNotesForRegion(country),
      TrendInsightsService.getPublicationsForRegion(country, gender),
    ]);

    const forecast = TrendInsightsService.get2025ColorTrends();

    return {
      hotItems: hotItems.slice(0, trendLimits.itemLimit),
      influencers: influencers.slice(0, trendLimits.influencerLimit),
      colorTrends: Number.isFinite(trendLimits.colorTrendLimit)
        ? colorTrends.slice(0, trendLimits.colorTrendLimit)
        : colorTrends,
      styleMovements: trendLimits.includeStyleMovement ? styleMovements : styleMovements.slice(0, 1),
      culturalNotes: Number.isFinite(trendLimits.culturalNotesLimit)
        ? culturalNotes.slice(0, trendLimits.culturalNotesLimit)
        : culturalNotes,
      publications,
      globalTrendingBrands: TrendInsightsService.getGlobalTrendingBrands(gender),
      colorForecast2025: Number.isFinite(trendLimits.colorForecastLimit)
        ? forecast.slice(0, trendLimits.colorForecastLimit)
        : forecast,
    };
  } catch (error) {
    console.warn('Failed to fetch trend insights:', error);
    return null;
  }
}

export { REGIONAL_INFLUENCER_STYLES, TRENDING_STYLES_2025_2026, TrendInsightsService, ContentPersonalizationService };
