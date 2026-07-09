/**
 * Parse saved git HEAD legal screen files to build legal-english-map.json
 */
const fs = require('fs');
const path = require('path');

function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return [...content.matchAll(/t\(['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]\)/g)].map((m) => m[1]);
}

function readHeadFile(headPath) {
  const buf = fs.readFileSync(headPath);
  // PowerShell redirect may write UTF-16 LE
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le').replace(/^\uFEFF/, '');
  }
  return buf.toString('utf8').replace(/^\uFEFF/, '');
}

function extractHeadTexts(headPath) {
  const content = readHeadFile(headPath);
  const texts = [];
  const re = /<ThemedText[^>]*>\s*([\s\S]*?)\s*<\/ThemedText>/g;
  let m;
  while ((m = re.exec(content))) {
    const t = m[1].trim();
    if (t && !t.includes('{')) texts.push(t);
  }
  return texts;
}

function pairLegal(currentPath, headPath) {
  const keys = extractKeys(currentPath);
  const texts = extractHeadTexts(headPath);
  const map = {};
  const NAV_TITLES = {
    'terms.screenTitle': 'Terms of Service',
    'privacy.screenTitle': 'Privacy Policy',
  };
  let textIndex = 0;
  for (const key of keys) {
    if (NAV_TITLES[key]) {
      map[key] = NAV_TITLES[key];
      continue;
    }
    if (texts[textIndex]) {
      map[key] = texts[textIndex];
      textIndex++;
    }
  }
  return map;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const terms = pairLegal(
    path.join(root, 'screens/TermsOfServiceScreen.tsx'),
    path.join(__dirname, '_terms-head.txt')
  );
  const privacy = pairLegal(
    path.join(root, 'screens/PrivacyPolicyScreen.tsx'),
    path.join(__dirname, '_privacy-head.txt')
  );
  const combined = { ...terms, ...privacy };
  fs.writeFileSync(path.join(__dirname, 'legal-english-map.json'), JSON.stringify(combined, null, 2));
  console.log('Legal English pairs:', Object.keys(combined).length);
  // Sample validation
  console.log('terms.title:', combined['terms.title']);
  console.log('privacy.title:', combined['privacy.title']);
}

main();
