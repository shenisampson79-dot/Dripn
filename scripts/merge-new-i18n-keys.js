#!/usr/bin/env node
/**
 * Merge new i18n keys into en-flat.json and all locales/*.json.
 * - Adds missing keys from NEW_KEYS (English source of truth)
 * - Fixes truncated key aliases
 * - Locales get English interim values for missing keys (generate-all-locales can translate)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_FLAT = path.join(__dirname, 'en-flat.json');
const KEYS_FILE = path.join(__dirname, 'i18n-keys.txt');
const LOCALES_DIR = path.join(ROOT, 'locales');

const NEW_KEYS = {
  // Truncation fixes (full keys)
  'coldOpen.egNothingFeelsRightImBoredOfMyClothes': "e.g., Nothing feels right, I'm bored of my clothes...",
  'coldOpen.egNothingFeelsRightI': "e.g., Nothing feels right, I'm bored of my clothes...",
  'common.pleaseTryAgainRubyDidntGetYourMessage': "Please try again — Ruby didn't get your message.",
  'common.pleaseTryAgainRubyDidn': "Please try again — Ruby didn't get your message.",
  'common.youreNowSubscribedToDripnFashionUpdates': "You're now subscribed to Dripn fashion updates.",
  'common.youveBeenUnsubscribedFromTheNewsletter': "You've been unsubscribed from the newsletter.",
  'common.couldNotUpdateNewsletterSubscriptionPlea': 'Could not update newsletter subscription. Please try again.',
  'common.addAnEmailAddressToYourDripnAccountToRec': 'Add an email address to your Dripn account to receive the weekly newsletter.',
  'common.connectToTheInternetToSubscribeToTheWeek': 'Connect to the internet to subscribe to the weekly newsletter.',
  'common.pleaseAddAnEmailToYourAccountFirst': 'Please add an email to your account first.',
  'common.subscribed': 'Subscribed',
  'common.unsubscribed': 'Unsubscribed',

  // navTitles
  'navTitles.todaysDecision': "Today's Decision",
  'navTitles.fashionBlog': 'Fashion Blog',
  'navTitles.styleShuffle': 'Style Shuffle',
  'navTitles.stylistChat': 'Stylist Chat',
  'navTitles.visualSearch': 'Visual Search',
  'navTitles.smartNotifications': 'Smart Notifications',
  'navTitles.eventsNearYou': 'Events Near You',
  'navTitles.streetStyleScanner': 'Street Style Scanner',
  'navTitles.virtualTryOn': 'Virtual Try-On',
  'navTitles.styleSoulmates': 'Style Soulmates',
  'navTitles.offers': 'Offers',
  'navTitles.sustainability': 'Sustainability',
  'navTitles.fashionTherapy': 'Fashion Therapy',
  'navTitles.presenceAnalysis': 'Presence Analysis',
  'navTitles.wardrobeTwin': 'Wardrobe Twin',
  'navTitles.styleDiplomat': 'Style Diplomat',
  'navTitles.styleStories': 'Style Stories',
  'navTitles.fashionIntelligence': 'Fashion Intelligence',
  'navTitles.myWardrobe': 'My Wardrobe',
  'navTitles.addItem': 'Add Item',
  'navTitles.quickAddItems': 'Quick Add Items',
  'navTitles.outfitCalendar': 'Outfit Calendar',
  'navTitles.outfitBuilder': 'Outfit Builder',
  'navTitles.costPerWear': 'Cost-per-Wear',
  'navTitles.styleDna': 'Style DNA',
  'navTitles.colorAnalysis': 'Color Analysis',
  'navTitles.bodyScanner': 'Body Scanner',
  'navTitles.weatherOutfits': 'Weather Outfits',
  'navTitles.myLookbook': 'My Lookbook',
  'navTitles.modularWardrobe': 'Modular Wardrobe',
  'navTitles.dfyCalendar': 'DFY Calendar',
  'navTitles.community': 'Community',
  'navTitles.communityVote': 'Community Vote',
  'navTitles.profile': 'Profile',
  'navTitles.friendsActivity': 'Friends Activity',
  'navTitles.friendRequests': 'Friend Requests',
  'navTitles.discoverPeople': 'Discover People',
  'navTitles.messages': 'Messages',
  'navTitles.chat': 'Chat',
  'navTitles.stylingGuide': 'Styling Guide',
  'navTitles.wardrobeFilter': 'Wardrobe Filter',
  'navTitles.post': 'Post',
  'navTitles.subscription': 'Subscription',
  'navTitles.chooseYourSetup': 'Choose Your Setup',
  'navTitles.stylistSetup': 'Stylist Setup',
  'navTitles.uploadWardrobe': 'Upload Wardrobe',
  'navTitles.yourStylePlan': 'Your Style Plan',
  'navTitles.termsOfService': 'Terms of Service',
  'navTitles.privacyPolicy': 'Privacy Policy',
  'navTitles.bargains': 'Bargains',
  'navTitles.events': 'Events',
  'navTitles.stylist': 'Stylist',
  'navTitles.dreamOutfitGenerator': 'Dream Outfit Generator',
  'navTitles.blog': 'Blog',
  'navTitles.styleRules': 'Style Rules',
  'navTitles.colourInsights': 'Colour Insights',
  'navTitles.vipMembers': 'VIP Members',
  'navTitles.accessStatus': 'Access Status',
  'navTitles.doneForYouStyle': 'Done-For-You Style',
  'navTitles.analytics': 'Analytics',
  'navTitles.socialStyleSync': 'Social Style Sync',

  // coldOpen
  'coldOpen.title': 'What are you getting dressed for?',
  'coldOpen.subtitle': "Pick the occasion that's on your mind right now",
  'coldOpen.work': 'Work',
  'coldOpen.workDesc': 'Office, meetings, professional',
  'coldOpen.holiday': 'Holiday',
  'coldOpen.holidayDesc': 'Vacation, travel, relaxed',
  'coldOpen.event': 'Event',
  'coldOpen.eventDesc': 'Party, wedding, special occasion',
  'coldOpen.casual': 'Casual',
  'coldOpen.casualDesc': 'Everyday, weekend, errands',
  'coldOpen.justBrowsing': 'Just Browsing',
  'coldOpen.justBrowsingDesc': 'Exploring options, no rush',
  'coldOpen.struggleToggle': 'Having a specific struggle? Tell me more (optional)',
  'coldOpen.struggleLabel': "What's making it hard?",
  'coldOpen.skip': 'Skip',
  'coldOpen.continue': 'Continue',

  // discover
  'discover.title': 'Discover',
  'discover.subtitle': 'Explore fashion inspiration',
  'discover.reorderHint': 'Tap arrows to reorder categories',
  'discover.open': 'Open',
  'discover.goToSection': 'Go to Section',
  'discover.styleOfDay': 'Style of Day',
  'discover.styleOfDayDesc': 'Your personalized daily outfit recommendation tailored to your style and region.',
  'discover.trends': 'Trends',
  'discover.trendsDesc': "What's hot right now in fashion with real-time trend analysis and weekly highlights.",
  'discover.styleIcons': 'Style Icons',
  'discover.styleIconsDesc': 'Get inspired by celebrities and top fashion influencers with AI-powered lookalike outfits.',
  'discover.styleTherapy': 'Style Therapy',
  'discover.styleTherapyDesc': 'Mood-based styling, body positivity affirmations, and wellness-focused outfit recommendations.',
  'discover.ecoStyle': 'Eco Style',
  'discover.ecoStyleDesc': 'Discover sustainable fashion brands and eco-friendly styling tips.',
  'discover.fashionReads': 'Fashion Reads',
  'discover.fashionReadsDesc': 'Expert fashion articles, styling tips, magazine looks, and in-depth guides.',
  'discover.offers': 'Offers',
  'discover.offersDesc': 'Exclusive daily deals and discounts from trusted fashion retailers.',
  'discover.events': 'Events',
  'discover.eventsDesc': 'Discover fashion events near you with outfit suggestions.',
  'discover.styleDiplomat': 'Style Diplomat',
  'discover.styleDiplomatDesc': 'Cultural dress codes and fashion etiquette for 5 countries. Perfect for travelers.',
  'discover.influencers': 'Influencers',
  'discover.magazines': 'Magazines',
  'discover.celebrity': 'Celebrity',
  'discover.highlights': 'Highlights',
  'discover.blog': 'Blog',
  'discover.people': 'People',
  'discover.joinChallenge': 'Join Challenge',
  'discover.shareChallenge': 'Share Challenge',
  'discover.joinNow': 'Join Now',

  // fashionBlog
  'fashionBlog.title': 'Fashion Blog',
  'fashionBlog.subtitle': 'AI-researched weekly style insights and styling tips',
  'fashionBlog.getWeeklyUpdates': 'Get Weekly Updates',
  'fashionBlog.newsletterJoin': 'Join the Dripn newsletter for weekly fashion insights delivered to your inbox.',
  'fashionBlog.subscribe': 'Subscribe',
  'fashionBlog.subscribedWeekly': 'Subscribed · weekly issues below',
  'fashionBlog.alreadySubscribed': 'Already Subscribed',
  'fashionBlog.subscribedExclaim': 'Subscribed!',
  'fashionBlog.proTip': 'Pro Tip:',
  'fashionBlog.researchedFrom': 'Researched from:',
  'fashionBlog.report': 'Report',
  'fashionBlog.showLess': 'Show less',
  'fashionBlog.readMore': 'Read more',
  'fashionBlog.noArticlesYet': 'No Articles Yet',
  'fashionBlog.checkBackSoon': 'Check back soon for new style insights.',
  'fashionBlog.loadingArticles': 'Loading articles...',
  'fashionBlog.reportTypo': 'Typo or Error',
  'fashionBlog.reportOffensive': 'Offensive Content',
  'fashionBlog.reportInaccurate': 'Inaccurate Information',

  // weeklyPlanner
  'weeklyPlanner.createOutfitsForWeek': 'Create outfits for the week',
  'weeklyPlanner.aiWillCreate': 'AI will create {n} looks from your {count} wardrobe items',
  'weeklyPlanner.numberOfDays': 'Number of days',
  'weeklyPlanner.days': '{n} days',
  'weeklyPlanner.focusOccasionOptional': 'Focus occasion (optional)',
  'weeklyPlanner.creatingOutfits': 'Creating outfits...',
  'weeklyPlanner.creatingOutfitOf': 'Creating outfit {x} of {y}...',
  'weeklyPlanner.generateOutfits': 'Generate {n} outfits',

  // cancelFlow
  'cancelFlow.waitDontLose': "Wait — don't lose your style progress",
  'cancelFlow.waitBody': "You'll lose access to your saved outfits, stylist conversations, and personalized recommendations.",
  'cancelFlow.keepSubscription': 'Keep Subscription',
  'cancelFlow.continue': 'Continue',
  'cancelFlow.mainReason': "What's the main reason?",
  'cancelFlow.feedbackHelps': 'Your feedback helps us improve Dripn.',
  'cancelFlow.youllLoseAccess': "You'll lose access to",
  'cancelFlow.savedOutfitsAndChats': 'Saved outfits and stylist conversations',
  'cancelFlow.cancelling': 'Cancelling...',
  'cancelFlow.confirmCancel': 'Confirm Cancel',
  'cancelFlow.planUpdated': 'Plan updated',
  'cancelFlow.subscriptionCancelled': 'Subscription cancelled',
  'cancelFlow.couldNotChangePlan': 'Could not change plan.',
  'cancelFlow.failedToCancel': 'Failed to cancel subscription.',

  // secondOpinion
  'secondOpinion.viewSubscriptionOptions': 'View subscription options',
  'secondOpinion.maybeLater': 'Maybe later',
  'secondOpinion.startConfidenceCheck': 'Start confidence check',
  'secondOpinion.noThanksTrust': 'No thanks, I trust you',
  'secondOpinion.unlockCommunityVoting': 'Unlock community voting',
  'secondOpinion.wantSecondOpinion': 'Want a quick second opinion?',

  // voiceComment
  'voiceComment.limitReached': 'Voice Comment Limit Reached',
  'voiceComment.recordingError': 'Recording Error',
  'voiceComment.notAvailable': 'Not Available',
  'voiceComment.availableInExpoGo': 'Voice recording is available in Expo Go',
  'voiceComment.enableMic': 'Enable microphone access',
  'voiceComment.holdToRecord': 'Hold to record voice comment',

  // shoppable
  'shoppable.sizes': 'Sizes:',
  'shoppable.shopNow': 'Shop Now',
  'shoppable.affiliateDisclosure': 'Dripn may earn a commission when you shop through this link.',
  'shoppable.cannotOpenLink': 'Cannot open link',
  'shoppable.errorOpeningProduct': 'Error opening product',

  // surpriseMe
  'surpriseMe.stepOf': 'Step {current} of {total}',
  'surpriseMe.ruby.1': 'Opening your wardrobe, love',
  'surpriseMe.ruby.1d': 'Pulling up everything you own',
  'surpriseMe.ruby.2': 'Browsing your pieces',
  'surpriseMe.ruby.2d': 'Shirts, trousers, shoes — the lot',
  'surpriseMe.ruby.3': 'Reading the room',
  'surpriseMe.ruby.3d': 'Weather, occasion, and your notes',
  'surpriseMe.ruby.4': 'Building your look',
  'surpriseMe.ruby.4d': 'Layering pieces that work together',
  'surpriseMe.ruby.5': 'Almost ready',
  'surpriseMe.ruby.5d': 'Scoring the outfit and writing your notes',
  'surpriseMe.max.1': 'Digging into your wardrobe',
  'surpriseMe.max.1d': 'Finding what actually works',
  'surpriseMe.max.2': 'Shortlisting pieces',
  'surpriseMe.max.2d': 'No filler — only strong options',
  'surpriseMe.max.3': 'Factoring in your day',
  'surpriseMe.max.3d': 'Context, weather, dress code',
  'surpriseMe.max.4': 'Assembling the outfit',
  'surpriseMe.max.4d': 'Top to toe, styled properly',
  'surpriseMe.max.5': 'Final rating',
  'surpriseMe.max.5d': 'Honest score coming up',
  'surpriseMe.ace.1': 'Scanning your closet data',
  'surpriseMe.ace.1d': 'Inventory check in progress',
  'surpriseMe.ace.2': 'Optimising combinations',
  'surpriseMe.ace.2d': 'Efficiency over fluff',
  'surpriseMe.ace.3': 'Checking conditions',
  'surpriseMe.ace.3d': 'Weather and constraints locked',
  'surpriseMe.ace.4': 'Building the system look',
  'surpriseMe.ace.4d': 'Modular pieces, max versatility',
  'surpriseMe.ace.5': 'Crunching the score',
  'surpriseMe.ace.5d': 'Data-backed recommendation ready',
  'surpriseMe.ivy.1': 'Reviewing your wardrobe story',
  'surpriseMe.ivy.1d': 'Every piece has potential',
  'surpriseMe.ivy.2': 'Finding intentional pairings',
  'surpriseMe.ivy.2d': "Thoughtful, not trendy for trend's sake",
  'surpriseMe.ivy.3': 'Considering your context',
  'surpriseMe.ivy.3d': "Where you're going, how you want to feel",
  'surpriseMe.ivy.4': 'Composing the outfit',
  'surpriseMe.ivy.4d': 'Balanced, wearable, you',
  'surpriseMe.ivy.5': 'Finishing touches',
  'surpriseMe.ivy.5d': 'Notes and confidence score',
  'surpriseMe.default.1': '{name} is opening your wardrobe',
  'surpriseMe.default.1d': 'Pulling up your pieces',
  'surpriseMe.default.2': 'Browsing options',
  'surpriseMe.default.2d': 'Finding strong combinations',
  'surpriseMe.default.3': 'Reading the brief',
  'surpriseMe.default.3d': 'Weather, occasion, preferences',
  'surpriseMe.default.4': 'Building your look',
  'surpriseMe.default.4d': 'Putting it all together',
  'surpriseMe.default.5': 'Almost ready',
  'surpriseMe.default.5d': 'Finalising your outfit',
};

function main() {
  const enFlat = JSON.parse(fs.readFileSync(EN_FLAT, 'utf8'));
  let added = 0;
  for (const [key, value] of Object.entries(NEW_KEYS)) {
    if (enFlat[key] !== value) {
      enFlat[key] = value;
      added++;
    }
  }
  fs.writeFileSync(EN_FLAT, JSON.stringify(enFlat, null, 2) + '\n');
  console.log(`en-flat.json: upserted ${added} keys (total ${Object.keys(enFlat).length})`);

  // Update i18n-keys.txt
  const existingKeys = fs.existsSync(KEYS_FILE)
    ? fs.readFileSync(KEYS_FILE, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  const keySet = new Set([...existingKeys, ...Object.keys(NEW_KEYS), ...Object.keys(enFlat)]);
  const sorted = [...keySet].sort();
  fs.writeFileSync(KEYS_FILE, sorted.join('\n') + '\n');
  console.log(`i18n-keys.txt: ${sorted.length} keys`);

  // Merge into all locales (English interim for missing)
  const langs = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of langs) {
    const p = path.join(LOCALES_DIR, file);
    const locale = JSON.parse(fs.readFileSync(p, 'utf8'));
    let missing = 0;
    for (const [key, value] of Object.entries(NEW_KEYS)) {
      if (!locale[key]) {
        locale[key] = value;
        missing++;
      }
    }
    // Also ensure truncated aliases point to full English if missing
    if (!locale['coldOpen.egNothingFeelsRightImBoredOfMyClothes'] && locale['coldOpen.egNothingFeelsRightI']) {
      locale['coldOpen.egNothingFeelsRightImBoredOfMyClothes'] = locale['coldOpen.egNothingFeelsRightI'];
    }
    if (!locale['common.pleaseTryAgainRubyDidntGetYourMessage'] && locale['common.pleaseTryAgainRubyDidn']) {
      locale['common.pleaseTryAgainRubyDidntGetYourMessage'] = locale['common.pleaseTryAgainRubyDidn'];
    }
    fs.writeFileSync(p, JSON.stringify(locale, null, 2) + '\n');
    console.log(`  ${file}: added ${missing} missing keys (total ${Object.keys(locale).length})`);
  }
  console.log('Done. Run `npm run i18n:locales` to translate missing keys via Google.');
}

main();
