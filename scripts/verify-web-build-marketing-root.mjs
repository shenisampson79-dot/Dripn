/**
 * Inspects the real web-build output after expo export + fix-web-index.
 * Run: node scripts/verify-web-build-marketing-root.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webBuild = path.join(root, 'web-build');
const indexPath = path.join(webBuild, 'index.html');
const appPath = path.join(webBuild, 'app.html');
const aboutPath = path.join(webBuild, 'about.html');

const failures = [];

function assert(name, cond, detail = '') {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

assert('web-build/index.html exists', fs.existsSync(indexPath));
assert('web-build/app.html exists', fs.existsSync(appPath));
assert('web-build/about.html exists', fs.existsSync(aboutPath));
assert('web-build/images/badge-app-store.svg exists', fs.existsSync(path.join(webBuild, 'images', 'badge-app-store.svg')));
assert('web-build/images/badge-google-play.png exists', fs.existsSync(path.join(webBuild, 'images', 'badge-google-play.png')));

if (fs.existsSync(indexPath) && fs.existsSync(appPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const appHtml = fs.readFileSync(appPath, 'utf8');
  const aboutHtml = fs.existsSync(aboutPath) ? fs.readFileSync(aboutPath, 'utf8') : '';

  assert('index is marketing homepage', /four AI stylists|Ruby, Max, Ace and Ivy/i.test(indexHtml));
  assert('index has store badges', /\/images\/badge-app-store\.svg/.test(indexHtml) && /\/images\/badge-google-play\.png/.test(indexHtml));
  assert('index badge paths are root-absolute', /src="\/images\//.test(indexHtml) && !/src="images\//.test(indexHtml));
  assert('index is not Expo SPA', !/id="root"/.test(indexHtml) && !/_expo\//.test(indexHtml));
  assert('index has Open Web App', /href="\/app"/.test(indexHtml));
  assert('index has checkout bridge', /subscription-success/.test(indexHtml));
  assert('index matches about.html', aboutHtml.length > 0 && indexHtml === aboutHtml);

  assert('app.html is Expo SPA', /id="root"/.test(appHtml) && /_expo\//.test(appHtml));
  assert('app.html is not marketing homepage', !/badge-app-store\.svg/.test(appHtml));
  assert('app.html stripped meta refresh', !/<meta http-equiv="refresh"/i.test(appHtml));
  assert('app.html stripped location.replace root', !/window\.location\.replace\(['"]\/['"]\)/.test(appHtml));
}

if (failures.length) {
  console.error('verify-web-build-marketing-root FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('verify-web-build-marketing-root: ok');
