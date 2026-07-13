const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'locales');
const feedback = {
  'feedback.screenTitle': 'Send Feedback',
  'feedback.intro':
    'Help us improve Dripn! Your feedback is invaluable for making the app better for everyone.',
  'feedback.whatType': 'What type of feedback?',
  'feedback.whichArea': 'Which area of the app?',
  'feedback.type.bug.label': 'Bug Report',
  'feedback.type.bug.description': "Something isn't working",
  'feedback.type.feature.label': 'Feature Request',
  'feedback.type.feature.description': 'Suggest an improvement',
  'feedback.type.general.label': 'General Feedback',
  'feedback.type.general.description': 'Share your thoughts',
  'feedback.type.rating.label': 'Rate Experience',
  'feedback.type.rating.description': 'Rate your overall experience',
  'feedback.category.stylist': 'AI Stylist',
  'feedback.category.wardrobe': 'Wardrobe',
  'feedback.category.lookbook': 'Lookbook & outfits',
  'feedback.category.scanner': 'Camera & uploads',
  'feedback.category.billing': 'Billing & subscription',
  'feedback.category.account': 'Account & login',
  'feedback.category.blog': 'Fashion Blog',
  'feedback.category.other': 'Other',
  // legacy keys kept for older clients
  'feedback.category.chat': 'AI Stylist',
  'feedback.category.login': 'Account & login',
  'feedback.ratingPrompt': 'How would you rate your experience?',
  'feedback.rating.excellent': 'Excellent!',
  'feedback.rating.great': 'Great!',
  'feedback.rating.good': 'Good',
  'feedback.rating.fair': 'Fair',
  'feedback.rating.poor': 'Poor',
  'feedback.titleLabel': 'Title',
  'feedback.titlePlaceholder': 'Brief summary of your feedback',
  'feedback.descriptionLabel': 'Description',
  'feedback.descriptionPlaceholder':
    'Please describe in detail. What happened, what you expected, and any steps to reproduce...',
  'feedback.submit': 'Submit Feedback',
  'feedback.footer':
    'Your feedback helps us improve Dripn. Our team reviews every submission.',
  'feedback.requiredTitle': 'Required',
  'feedback.requiredType': 'Please select a feedback type.',
  'feedback.requiredCategory': 'Please select an area.',
  'feedback.requiredTitleField': 'Please enter a title for your feedback.',
  'feedback.requiredDescription': 'Please describe your feedback in detail.',
  'feedback.requiredRating': 'Please select a rating.',
  'feedback.thankYouTitle': 'Thank You!',
  'feedback.thankYouMessage':
    "Thanks — we've got your feedback.",
  'feedback.submissionFailedTitle': 'Submission Failed',
  'feedback.submissionFailedMessage':
    "We couldn't submit your feedback. Please try again later.",
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const p = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(feedback)) {
    data[k] = v;
  }
  const sorted = Object.keys(data)
    .sort()
    .reduce((o, k) => {
      o[k] = data[k];
      return o;
    }, {});
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
  console.log('patched', file);
}
