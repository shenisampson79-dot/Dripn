/**
 * Copies Dripn public legal/support pages into public/ for Expo web export.
 * Run automatically before build:web.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const imagesDir = path.join(publicDir, 'images');
const marketingDir = path.join(root, 'marketing-website');
const assetsDir = path.join(root, 'assets', 'images');

const SUPPORT_EMAIL = 'support@dripnapp.com';
const LEGAL_ENTITY = 'Dripn App Ltd';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) {
    console.warn(`[prepare-public-legal-pages] missing: ${from}`);
    return;
  }
  fs.copyFileSync(from, to);
}

function pageShell({ title, description, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="stylesheet" href="/styles.css">
  <link rel="icon" type="image/png" href="/images/favicon.png">
</head>
<body>
  <nav>
    <div class="nav-content">
      <a href="/about" class="logo">
        <img src="/images/dripn-logo-gold.png" alt="Dripn Logo">
      </a>
      <div class="nav-links">
        <a href="/support">Support</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </div>
  </nav>

  <section class="legal-page">
    <div class="container">
      <div class="legal-content">
        ${bodyHtml}
      </div>
    </div>
  </section>

  <footer class="public-legal-footer">
    <div class="container">
      <p class="legal-entity-line">${LEGAL_ENTITY} operates Dripn.</p>
      <div class="footer-links public-footer-links">
        <a href="/about">Home</a>
        <a href="/support">Support</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="mailto:${SUPPORT_EMAIL}">Contact</a>
      </div>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} Dripn. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}

function transformMarketingLegal(html) {
  return html
    .replace(/href="index\.html"/g, 'href="/"')
    .replace(/href="privacy\.html"/g, 'href="/privacy"')
    .replace(/href="terms\.html"/g, 'href="/terms"')
    .replace(/href="support\.html"/g, 'href="/support"')
    .replace(/src="\.\.\/assets\/images\//g, 'src="/images/')
    .replace(/href="styles\.css"/g, 'href="/styles.css"')
    .replace(/<nav>[\s\S]*?<\/nav>\s*/i, '')
    .replace(/<footer>[\s\S]*?<\/footer>\s*/i, '')
    .replace(/<div id="cookie-banner"[\s\S]*?<\/script>\s*/i, '');
}

function extractLegalBody(marketingFile) {
  const raw = fs.readFileSync(marketingFile, 'utf8');
  const match = raw.match(/<div class="legal-content">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i);
  if (!match) throw new Error(`Could not extract legal body from ${marketingFile}`);
  let body = match[1].trim();
  body += `
        <p class="legal-entity-line">Dripn is operated by ${LEGAL_ENTITY}.</p>
        <p>Need help? Visit <a href="/support">Dripn Support</a> or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`;
  return body;
}

function writeSupportPage() {
  const bodyHtml = `
        <h1>Dripn Support</h1>
        <p class="support-intro">Need help with Dripn? We&rsquo;re here to help.</p>

        <h2>Contact Support</h2>
        <p>For help with your account, wardrobe, styling results, subscriptions, billing or a technical issue, contact us at:</p>
        <div class="contact-info">
          <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        </div>
        <p>We aim to respond within 2 business days.</p>

        <h2>Common Help Topics</h2>

        <h3>Account &amp; Sign-In</h3>
        <p>Help with accessing your account or signing in.</p>

        <h3>Wardrobe</h3>
        <p>Help adding, editing or managing wardrobe items.</p>

        <h3>AI Styling</h3>
        <p>Questions about Ivy, outfit recommendations, Quick Sanity Check and other styling features.</p>

        <h3>Subscriptions &amp; Billing</h3>
        <p>Help with subscriptions, purchases or billing questions.</p>

        <h3>Technical Issues</h3>
        <p>Report crashes, loading problems or unexpected behaviour.</p>

        <h3>Privacy &amp; Data</h3>
        <p>Questions about your personal data or privacy. See our <a href="/privacy">Privacy Policy</a>.</p>

        <h2>When Contacting Support</h2>
        <p>Please include:</p>
        <ul>
          <li>a brief description of the issue</li>
          <li>device/platform</li>
          <li>app version, if known</li>
          <li>screenshots where useful</li>
        </ul>
        <p><strong>Please never send us your password or payment card details.</strong></p>

        <p class="legal-entity-line">Dripn is operated by ${LEGAL_ENTITY}.</p>
        <p><a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Service</a></p>`;

  fs.writeFileSync(
    path.join(publicDir, 'support.html'),
    pageShell({
      title: 'Dripn Support | Help & Contact',
      description: 'Get help with Dripn, including account access, wardrobe, AI styling, subscriptions, billing, privacy and technical issues.',
      bodyHtml,
    }),
    'utf8',
  );
}

function appendPublicFooterStyles(css) {
  const extra = `
.public-legal-footer {
  padding: 40px 0 60px;
  text-align: center;
  border-top: 1px solid rgba(201, 168, 124, 0.2);
  background: var(--cream);
}

.public-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px 24px;
  margin: 16px 0;
}

.footer-copy,
.legal-entity-line {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 12px;
}

.support-intro {
  font-size: 18px;
  margin-bottom: 24px;
}

.legal-content a[href^="mailto:"] {
  font-weight: 600;
}
`;
  if (!css.includes('.public-legal-footer')) {
    return `${css}\n${extra}`;
  }
  return css;
}

ensureDir(publicDir);
ensureDir(imagesDir);

copyIfExists(path.join(marketingDir, 'styles.css'), path.join(publicDir, 'styles.css'));
copyIfExists(path.join(assetsDir, 'dripn-logo-gold.png'), path.join(imagesDir, 'dripn-logo-gold.png'));
copyIfExists(path.join(assetsDir, 'dripn-logo-icon.png'), path.join(imagesDir, 'favicon.png'));

copyIfExists(path.join(assetsDir, 'dripn-logo-gold-cream.png'), path.join(imagesDir, 'dripn-logo-gold-cream.png'));

let css = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
css = appendPublicFooterStyles(css);
fs.writeFileSync(path.join(publicDir, 'styles.css'), css, 'utf8');

const privacyBody = extractLegalBody(path.join(marketingDir, 'privacy.html'));
const termsBody = extractLegalBody(path.join(marketingDir, 'terms.html'));

fs.writeFileSync(
  path.join(publicDir, 'privacy.html'),
  pageShell({
    title: 'Privacy Policy - Dripn',
    description: 'Privacy Policy for Dripn - Learn how we collect, use, and protect your personal information.',
    bodyHtml: privacyBody,
  }),
  'utf8',
);

fs.writeFileSync(
  path.join(publicDir, 'terms.html'),
  pageShell({
    title: 'Terms of Service - Dripn',
    description: 'Terms of Service for Dripn - Read our terms and conditions for using the Dripn fashion advice app.',
    bodyHtml: termsBody,
  }),
  'utf8',
);

writeSupportPage();

function transformMarketingPage(html) {
  return html
    .replace(/href="index\.html"/g, 'href="/about"')
    .replace(/href="privacy\.html"/g, 'href="/privacy"')
    .replace(/href="terms\.html"/g, 'href="/terms"')
    .replace(/href="support\.html"/g, 'href="/support"')
    .replace(/href="styles\.css"/g, 'href="/styles.css"')
    .replace(/src="images\//g, 'src="/images/')
    .replace(/content="images\//g, 'content="/images/')
    .replace(/<a href="\/" class="logo">/g, '<a href="/about" class="logo">');
}

function writeMarketingAboutPage() {
  const raw = fs.readFileSync(path.join(marketingDir, 'index.html'), 'utf8');
  let html = transformMarketingPage(raw);
  if (!html.includes('Dripn App Ltd')) {
    html = html.replace(
      /<div class="footer-bottom">/,
      `      <p class="legal-entity-line" style="text-align:center;margin:24px 0 0;color:var(--text-secondary);font-size:14px;">Dripn is operated by ${LEGAL_ENTITY}.</p>\n      <div class="footer-bottom">`,
    );
  }
  fs.writeFileSync(path.join(publicDir, 'about.html'), html, 'utf8');
}

writeMarketingAboutPage();

console.log('[prepare-public-legal-pages] wrote about.html, support.html, privacy.html, terms.html, styles.css');
