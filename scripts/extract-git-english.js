#!/usr/bin/env node
/**
 * Recover original English from git HEAD versions of i18n-refactored screens.
 * Pairs removed string literals with t('key') additions in git diff.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const I18N_SCREENS = [
  'screens/WelcomeScreen.tsx',
  'screens/HelpScreen.tsx',
  'screens/SubscriptionScreen.tsx',
  'screens/TermsOfServiceScreen.tsx',
  'screens/PrivacyPolicyScreen.tsx',
  'screens/SubscriptionSuccessScreen.tsx',
  'screens/FeedbackScreen.tsx',
  'screens/SupportScreen.tsx',
];

function getHeadContent(filePath) {
  try {
    return execSync(`git show HEAD:${filePath.replace(/\\/g, '/')}`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });
  } catch {
    return null;
  }
}

function extractFromDiff(filePath) {
  const cwd = path.resolve(__dirname, '..');
  let diff;
  try {
    diff = execSync(`git diff HEAD -- "${filePath}"`, { cwd, encoding: 'utf8' });
  } catch {
    return {};
  }
  if (!diff) return {};

  const map = {};
  const lines = diff.split('\n');
  const pendingRemovals = [];

  for (const line of lines) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      const text = line.slice(1).trim();
      const literals = [];
      // Quoted strings
      for (const m of text.matchAll(/["']([^"']{2,})["']/g)) literals.push(m[1]);
      // JSX text content
      const jsxText = text.match(/^([A-Za-z0-9][^<{}=]*[.!?]?)$/);
      if (jsxText && jsxText[1].length > 2) literals.push(jsxText[1].trim());
      // title="..." description="..."
      for (const m of text.matchAll(/(?:title|description|placeholder|label)=["']([^"']+)["']/g))
        literals.push(m[1]);
      if (literals.length) pendingRemovals.push(...literals);
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const keys = [...line.matchAll(/t\(['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\)/g)].map((m) => m[1]);
      if (keys.length === 1 && pendingRemovals.length) {
        map[keys[0]] = pendingRemovals.pop();
      } else if (keys.length > 0) {
        pendingRemovals.length = 0;
      }
    }
  }
  return map;
}

function extractFaqFromHead(helpContent) {
  const map = {};
  const qRe = /question:\s*['"]([^'"]+)['"]/g;
  const aRe = /answer:\s*['"]([^'"]+)['"]/g;
  const questions = [...helpContent.matchAll(qRe)].map((m) => m[1]);
  const answers = [...helpContent.matchAll(aRe)].map((m) => m[1]);
  const faqIds = [
    'g1', 'g2', 'g3', 'g4',
    'a1', 'a2', 'a3', 'a4', 'a5',
    's1', 's2', 's3', 's4', 's5',
    'ai1', 'ai3', 'ai4',
    'p1', 'p2', 'p3', 'p4', 'p5',
    't1', 't2', 't3', 't4', 't5', 't6',
  ];
  faqIds.forEach((id, i) => {
    if (questions[i]) map[`help.faq.${id}.question`] = questions[i];
    if (answers[i]) map[`help.faq.${id}.answer`] = answers[i];
  });
  const catRe = /title:\s*['"]([^'"]+)['"]/g;
  const cats = [...helpContent.matchAll(catRe)].map((m) => m[1]);
  const catIds = ['general', 'account', 'subscription', 'aiFeatures', 'privacy', 'troubleshooting'];
  catIds.forEach((id, i) => {
    if (cats[i]) map[`help.category.${id}`] = cats[i];
  });
  return map;
}

function extractTermsPrivacyFromHead(content, prefix) {
  const map = {};
  // Extract all string literals in order from head file for terms/privacy screens
  const literals = [];
  for (const m of content.matchAll(/>\s*([^<>{}\n][^<>{}\n]*)\s*</g)) {
    const t = m[1].trim();
    if (t.length > 2 && !t.startsWith('{') && !/^\d+\./.test(t) === false) literals.push(t);
  }
  return map;
}

function main() {
  const all = {};
  for (const file of I18N_SCREENS) {
    Object.assign(all, extractFromDiff(file));
    const head = getHeadContent(file);
    if (file.includes('HelpScreen') && head) {
      Object.assign(all, extractFaqFromHead(head));
    }
  }

  // Manual fixes for known parser issues
  const MANUAL = {
    'welcome.tagline': 'style that moves with you',
    'welcome.featureStopGuessingTitle': 'Stop guessing what to wear',
    'welcome.featureStopGuessingDesc': 'Get the right outfit — instantly.',
    'welcome.featureTalkStylistTitle': 'Just talk to your stylist',
    'welcome.featureTalkStylistDesc': 'Natural voice chat. Like having someone there with you.',
    'welcome.featureLookGoodTitle': 'Look good every day',
    'welcome.featureLookGoodDesc': 'No stress. No second-guessing.',
    'welcome.featureWardrobeTitle': 'Make your wardrobe work',
    'welcome.featureWardrobeDesc': 'Everything organised. Everything usable.',
    'welcome.getStyled': 'Get Styled',
    'welcome.alreadyHaveAccount': 'Already have an account? ',
    'welcome.signIn': 'Sign In',
    'welcome.devLoginAsTestUser': 'Dev: Login as Test User',
    'help.heroTitleLine1': 'Need help?',
    'help.heroTitleLine2': "Don't worry —",
    'help.heroTitleItalic': "We've got you covered.",
    'help.heroSubtitle': 'Find answers below or chat with Julia, your friendly support companion who is always happy to help.',
    'help.screenTitle': 'Help & FAQ',
    'subscription.heroTitle': 'Look Better, Stress Less',
    'subscription.heroSubtitle': 'Your AI stylist for everyday confidence — or full life planning',
    'terms.screenTitle': 'Terms of Service',
    'terms.title': 'Terms of Service',
    'terms.effectiveDate': 'Effective Date: December 7, 2025',
    'terms.lastUpdated': 'Last Updated: January 22, 2026',
    'privacy.screenTitle': 'Privacy Policy',
    'privacy.title': 'Privacy Policy',
    'privacy.effectiveDate': 'Effective Date: December 7, 2025',
    'privacy.lastUpdated': 'Last Updated: January 22, 2026',
  };
  Object.assign(all, MANUAL);

  fs.writeFileSync(path.join(__dirname, 'git-english-map.json'), JSON.stringify(all, null, 2));
  console.log('Git English map:', Object.keys(all).length, 'keys');
}

main();
