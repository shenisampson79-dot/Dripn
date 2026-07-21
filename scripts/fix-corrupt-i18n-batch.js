const fs = require('fs');
const path = require('path');

const recovered = {
  "dfy.styleMeProperly.title": "Want me to do this for you?",
  "dfy.styleMeProperly.subtitle": "I'll set things up so your stylist works properly.",
  "dfy.styleMeProperly.footerReassurance": "One-time setup · No subscription required",
  "dfy.styleMeProperly.doItMyself": "I'll do it myself",

  "upgrade.limitHit.title": "Daily limit reached",
  "upgrade.limitHit.message": "Upgrade to Personal Stylist for unlimited stylist decisions and wardrobe-aware advice.",
  "upgrade.limitHit.cta": "Upgrade Now",

  "upgrade.path.coreBenefitsTitle": "With Core you get:",
  "upgrade.path.benefitPhotography": "Individual item photography & analysis",
  "upgrade.path.benefitSwap": "Swap any piece in your outfits",
  "upgrade.path.benefitRemix": "Unlimited outfit remixes for 30 days",
  "upgrade.path.benefitDigitization": "Full wardrobe digitization (up to 30 items)",
  "upgrade.path.upgradeButton": "Upgrade to Core - £39.99",
  "upgrade.path.notNow": "Not right now",
  "upgrade.path.requiresCore": "{feature} requires Core",
  "upgrade.path.stylistDefault": "Your Stylist",

  "settings.signOutConfirm": "Are you sure you want to sign out?",
  "settings.deleteAccountConfirm": "Are you sure you want to delete your account? This action cannot be undone.",
  "settings.deleteAccountDelete": "Delete",
  "settings.deleteAccountFinalTitle": "Confirm Deletion",
  "settings.deleteAccountFinalMessage": "This will permanently delete all your data, posts, and comments. Are you absolutely sure?",
  "settings.deleteAccountConfirmButton": "Yes, Delete My Account",
  "settings.deleteAccountDeletedTitle": "Account Deleted",
  "settings.deleteAccountFailed": "Failed to delete your account. Please try again later.",

  "dfy.comparison.signInRequiredTitle": "Sign in required",
  "dfy.comparison.signInRequiredApple": "Please sign in to purchase with the App Store.",
  "dfy.comparison.signInRequiredRestore": "Please sign in to restore purchases.",
  "dfy.comparison.emailRequired": "Please enter your email",
  "dfy.comparison.emailInvalid": "Please enter a valid email",
  "dfy.comparison.paymentSuccessTitle": "Payment Successful!",
  "dfy.comparison.paymentSuccessLiteMessage": "Your Travel Capsule setup is confirmed. Want ongoing styling advice from your personal AI stylist?",
  "dfy.comparison.paymentSuccessCoreMessage": "Your Full Wardrobe Setup is confirmed. Let's get started!",
  "dfy.comparison.getPersonalStylist": "Get Personal Stylist",
  "dfy.comparison.continueSetup": "Continue Setup",
  "dfy.comparison.purchaseVerifyFailed": "DFY purchase could not be verified. Please try Restore Purchases or contact support.",
  "dfy.comparison.purchaseCancelledTitle": "Purchase Cancelled",
  "dfy.comparison.purchaseCancelledMessage": "You can complete your purchase at any time.",
  "dfy.comparison.paymentErrorTitle": "Payment Error",
  "dfy.comparison.applePurchaseFailed": "Failed to complete App Store purchase. Please try again.",
  "dfy.comparison.noDfyPurchaseTitle": "No DFY purchase found",
  "dfy.comparison.noDfyPurchaseMessage": "No DFY setup purchase was found for this Apple ID.",
  "dfy.comparison.restoredTitle": "Restored",
  "dfy.comparison.restoredMessage": "Your DFY setup purchase has been restored.",
  "dfy.comparison.restoreFailedTitle": "Restore Failed",
  "dfy.comparison.restoreFailedMessage": "Could not restore purchases.",
  "dfy.comparison.paymentNotCompletedTitle": "Payment Not Completed",
  "dfy.comparison.paymentNotCompletedMessage": "Your payment could not be verified. Please try again or contact support if you were charged.",
  "dfy.comparison.checkoutCancelledTitle": "Checkout Cancelled",
  "dfy.comparison.checkoutCancelledMessage": "You can complete your purchase at any time.",
  "dfy.comparison.checkoutStartFailed": "Failed to start checkout. Please try again.",
  "dfy.comparison.titlePaidAddOn": "Choose your setup",
  "dfy.comparison.titleDefault": "How would you like me to style you?",
  "dfy.comparison.subtitlePaidAddOn": "Pick the path that fits — your styling starts right after checkout.",
  "dfy.comparison.subtitleDefault": "One solves now. The other solves every time after.",
  "dfy.comparison.fullSetupLabel": "Full Setup",
  "dfy.comparison.comparisonNoteFull": "dresses you every day after.",
  "dfy.comparison.occasionReadyLabel": "Travel Capsule",
  "dfy.comparison.comparisonNoteOccasion": "gets you ready for right now.",
  "dfy.comparison.startQuickSetup": "Start Quick Setup",
  "dfy.comparison.startFullSetup": "Start Full Setup",
  "dfy.comparison.restorePurchases": "Restore Purchases",
  "dfy.comparison.enterEmail": "Enter your email",
  "dfy.comparison.emailReceiptNote": "We'll send your purchase receipt and styling access to this email.",
  "dfy.comparison.emailPlaceholder": "your@email.com",
  "dfy.comparison.continueToCheckout": "Continue to Checkout",

  "dfy.start.headerDefault": "Done-For-You Setup",
  "dfy.start.heroUnlock": "Unlock your stylist setup",
  "dfy.start.heroIncluded": "Included with {plan}",
  "dfy.start.cantStartTitle": "Can't start yet",
  "dfy.start.tryAgain": "Please try again.",
  "dfy.start.recommended": "Recommended",
  "dfy.start.startPath": "Start {path}",
  "dfy.start.oneTime": "one-time",
  "dfy.start.lookReadyPurchase": "Look ready — purchase",
  "dfy.start.dressBetterPurchase": "Dress better — purchase",
  "dfy.start.purchaseAnother": "Purchase another setup",
  "dfy.start.purchaseAnotherDesc": "You've used your included setup — run another whenever you want to look and feel your best.",
  "dfy.start.fullSetupIncludedNote": "Full Setup is included with Stylist Unlimited, or buy it here anytime.",
  "dfy.start.noBenefitSubtitle": "Personal Stylist comes with Travel Capsule. Stylist Unlimited includes a full wardrobe setup — quick win or the whole closet.",
  "dfy.start.activeWindow": "Active styling window",
  "dfy.start.choosePlanUnlock": "Choose a plan to unlock",
  "dfy.start.personalStylist": "Personal Stylist",
  "dfy.start.personalStylistIncludes": "Includes Travel Capsule",
  "dfy.start.stylistUnlimited": "Stylist Unlimited",
  "dfy.start.stylistUnlimitedIncludes": "Includes Full Wardrobe Setup · Quick or Full path",
  "dfy.start.includedSetup": "Your included setup",
  "dfy.start.oneSetupNote": "Your plan includes one setup. Ready for the full wardrobe experience? Stylist Unlimited has you.",
  "dfy.start.compareStylistUnlimited": "Compare Stylist Unlimited",
  "dfy.start.chooseIncludedPath": "Choose your included path",
  "dfy.start.chooseIncludedPathDesc": "Your plan includes one setup — pick Travel Capsule or Full Setup to begin.",
  "dfy.start.quickVsFullNote": "Travel Capsule is a fast win when you're short on time. Full Setup is for when you want your whole closet digitised.",

  "dfy.expiry.planCompleteLite": "Your style plan is complete",
  "dfy.expiry.windowEnded": "Your styling window has ended",
  "dfy.expiry.daysRemaining": "{count} days remaining",
  "dfy.expiry.expiredSubtitleLite": "I solved this moment. If you want me long-term, I need context.",
  "dfy.expiry.expiredSubtitleCore": "Your wardrobe is saved. Keep your stylist thinking.",
  "dfy.expiry.warningCapsule": "I've been reusing the same pieces because I only styled a capsule.",
  "dfy.expiry.accessEndsNote": "Here's what will happen when your access ends",
  "dfy.expiry.whatStayed": "What stayed",
  "dfy.expiry.whatStays": "What stays",
  "dfy.expiry.whatStopped": "What stopped",
  "dfy.expiry.whatStops": "What stops",
  "dfy.expiry.buildWardrobeTitle": "Build my wardrobe",
  "dfy.expiry.buildWardrobeDesc": "I can get much better if I learn everything you own - once.",
  "dfy.expiry.buildIt": "Build it",
  "dfy.expiry.keepStylistActive": "Keep my stylist active",
  "dfy.expiry.keepStylistDesc": "Your wardrobe is saved. Subscription keeps your stylist thinking.",
  "dfy.expiry.subscribe": "Subscribe",

  "savedOutfits.nothingToSaveTitle": "Nothing to save",
  "savedOutfits.nothingToSaveMessage": "This outfit has no wardrobe items linked yet.",
  "savedOutfits.savedToFavoritesTitle": "Saved to favorites",
  "savedOutfits.outfitSavedTitle": "Outfit saved",
  "savedOutfits.savedToFavoritesMessage": "You can find this look in Profile → Saved Outfits.",
  "savedOutfits.outfitSavedMessage": "This outfit is in your Profile under Saved Outfits.",
  "savedOutfits.couldNotSaveTitle": "Could not save",
  "savedOutfits.couldNotSaveMessage": "Please try again in a moment.",
  "savedOutfits.loveThisOutfit": "Love this outfit",
  "savedOutfits.saveOutfit": "Save outfit",
  "savedOutfits.namePrompt": "Give this look a name so you can find it quickly in your saved outfits list.",
  "savedOutfits.descriptionOptional": "Description (optional)",
  "savedOutfits.descriptionPlaceholder": "Why you love it, when to wear it, styling notes...",
  "savedOutfits.titlePlaceholder": "e.g. Work Friday, Date night look...",
  "savedOutfits.scrollHint": "Scroll the list to browse all {count} outfits",
  "savedOutfits.outfitDetails": "Outfit details",
};

const dir = path.join(__dirname, '..', 'locales');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const p = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(recovered)) {
    if (data[k] !== v) {
      data[k] = v;
      n += 1;
    }
  }
  const sorted = Object.keys(data)
    .sort()
    .reduce((o, k) => {
      o[k] = data[k];
      return o;
    }, {});
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
  console.log(file, 'updated', n);
}
