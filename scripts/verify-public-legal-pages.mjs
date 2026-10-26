/**
 * Public legal/support/marketing page regression checks.
 * Run: npm run verify:public-legal-pages
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const marketingDir = path.join(root, 'marketing-website');
const assetsDir = path.join(root, 'assets', 'images');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const vercelIgnorePath = path.join(root, '.vercelignore');
const vercelIgnore = fs.existsSync(vercelIgnorePath)
  ? fs.readFileSync(vercelIgnorePath, 'utf8')
  : '';

const requiredSources = [
  path.join(marketingDir, 'styles.css'),
  path.join(marketingDir, 'privacy.html'),
  path.join(marketingDir, 'terms.html'),
  path.join(marketingDir, 'index.html'),
  path.join(assetsDir, 'dripn-logo-gold.png'),
  path.join(assetsDir, 'dripn-logo-icon.png'),
  path.join(assetsDir, 'dripn-logo-gold-cream.png'),
];

const failures = [];

function assert(name, cond, detail = '') {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

for (const source of requiredSources) {
  assert(`tracked source exists: ${path.relative(root, source)}`, fs.existsSync(source));
}

assert(
  'vercelignore allows marketing-website',
  !/(^|\n)\s*marketing-website\s*($|\n)/.test(vercelIgnore),
  'marketing-website must not be excluded from Vercel checkout',
);

const support = fs.readFileSync(path.join(publicDir, 'support.html'), 'utf8');
const privacy = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');
const terms = fs.readFileSync(path.join(publicDir, 'terms.html'), 'utf8');
const about = fs.readFileSync(path.join(publicDir, 'about.html'), 'utf8');

assert('support.html exists', fs.existsSync(path.join(publicDir, 'support.html')));
assert('privacy.html exists', fs.existsSync(path.join(publicDir, 'privacy.html')));
assert('terms.html exists', fs.existsSync(path.join(publicDir, 'terms.html')));
assert('about.html exists', fs.existsSync(path.join(publicDir, 'about.html')));
assert('styles.css exists', fs.existsSync(path.join(publicDir, 'styles.css')));

assert('support title', /Dripn Support \| Help & Contact/.test(support));
assert('support heading', /<h1>Dripn Support<\/h1>/.test(support));
assert('support mailto', /href="mailto:support@dripnapp.com"/.test(support));
assert('support legal entity', /Dripn App Ltd/.test(support));
assert('support privacy link', /href="\/privacy"/.test(support));
assert('support terms link', /href="\/terms"/.test(support));
assert('support no placeholder', !/\[(SUPPORT EMAIL|EXACT LEGAL COMPANY NAME|PLACEHOLDER)\]/i.test(support));

assert('privacy legal entity', /Dripn App Ltd/.test(privacy));
assert('privacy support email', /support@dripnapp.com/.test(privacy));
assert('privacy has policy body', /Information We Collect/.test(privacy));
assert('privacy support link', /href="\/support"/.test(privacy));

assert('terms legal entity', /Dripn App Ltd/.test(terms));
assert('terms support email', /support@dripnapp.com/.test(terms));
assert('terms has body', /Acceptance of Terms/.test(terms));
assert('terms support link', /href="\/support"/.test(terms));

assert('about four stylists', /four AI stylists|Ruby, Max, Ace and Ivy/i.test(about));
assert('about no ivy-only headline', !/Meet Ivy, your AI personal stylist/i.test(about));
assert('about no investor copy', !/Investment Opportunity|investors@dripnapp\.com/i.test(about));
assert('about no stale pricing', !/£4\.99|£9\.99|£9,999/i.test(about));
assert('about no gpt stack copy', !/GPT-4 Vision|DALL-E 3|text-embedding-3-large/i.test(about));
assert('about legal entity', /Dripn App Ltd/.test(about));
assert('about support link', /href="\/support"/.test(about));
assert('about privacy link', /href="\/privacy"/.test(about));
assert('about terms link', /href="\/terms"/.test(about));
assert('about no expo login wall', !/Please enable JavaScript to use Dripn/i.test(about));
assert('about logo assets', /\/images\/dripn-logo-gold\.png/.test(about));

const rewriteDestinations = (vercel.rewrites || []).map((r) => r.destination);
assert('vercel /about rewrite', rewriteDestinations.includes('/about.html'));
assert('vercel /support rewrite', rewriteDestinations.includes('/support.html'));
assert('vercel /privacy rewrite', rewriteDestinations.includes('/privacy.html'));
assert('vercel /terms rewrite', rewriteDestinations.includes('/terms.html'));
assert('vercel /reset-password rewrite', rewriteDestinations.includes('/reset-password.html'));
const rootRewrite = (vercel.rewrites || []).find((r) => r.source === '/');
assert('vercel does not rewrite / over static marketing index', !rootRewrite);
const appRewrite = (vercel.rewrites || []).find((r) => r.source === '/app');
assert('vercel /app rewrite to SPA', appRewrite && appRewrite.destination === '/app.html');
const appSlashRewrite = (vercel.rewrites || []).find((r) => r.source === '/app/');
assert('vercel /app/ rewrite to SPA', appSlashRewrite && appSlashRewrite.destination === '/app.html');
const catchAll = (vercel.rewrites || []).find((r) => r.source === '/(.*)');
assert('vercel SPA catch-all uses app.html', catchAll && catchAll.destination === '/app.html');
const appIdx = (vercel.rewrites || []).findIndex((r) => r.source === '/app');
const catchIdx = (vercel.rewrites || []).findIndex((r) => r.source === '/(.*)');
assert('vercel /app rewrite precedes SPA catch-all', appIdx >= 0 && catchIdx > appIdx);
assert('vercel /api rewrite preserved', rewriteDestinations.includes('https://dripn-server.onrender.com/api/:path*'));
assert('vercel /invite rewrite preserved', rewriteDestinations.includes('https://dripn-server.onrender.com/invite'));
const redirect = fs.readFileSync(path.join(root, 'components', 'SubscriptionSuccessRedirect.tsx'), 'utf8');
assert('web checkout replaceState stays on /app', /replaceState\(\{\}, "", "\/app"\)/.test(redirect));
assert('web checkout does not replaceState to /', !/replaceState\(\{\}, "", "\/"\)/.test(redirect));
assert('about App Store URL', /https:\/\/apps\.apple\.com\/gb\/app\/dripn-ai-outfit-style\/id6762082932/.test(about));
assert('about Google Play URL', /https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.dripn\.app/.test(about));
assert('about Open Web App', /href="\/app"/.test(about));
assert('about download anchor', /id="download"/.test(about));
assert('about checkout success bridge', /subscription-success/.test(about));
assert('about no waitlist copy', !/coming soon|waitlist/i.test(about));
assert('about store badges copied', fs.existsSync(path.join(publicDir, 'images', 'badge-app-store.svg')));
assert('about play badge copied', fs.existsSync(path.join(publicDir, 'images', 'badge-google-play.png')));

const resetPassword = fs.readFileSync(path.join(publicDir, 'reset-password.html'), 'utf8');
assert('reset-password.html exists', fs.existsSync(path.join(publicDir, 'reset-password.html')));
assert('reset page title', /Reset your password \| Dripn/.test(resetPassword));
assert('reset page reads token', /params\.get\('token'\)/.test(resetPassword));
assert('reset page posts to API', /\/api\/auth\/reset-password/.test(resetPassword));
assert('reset page no deep link', !/dripn:\/\//.test(resetPassword));

if (failures.length) {
  console.error('verify-public-legal-pages FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('verify-public-legal-pages: ok');
