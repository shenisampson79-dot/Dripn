const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'web-build', 'index.html');
const appPath = path.join(__dirname, '..', 'web-build', 'app.html');
const aboutPath = path.join(__dirname, '..', 'web-build', 'about.html');

if (!fs.existsSync(indexPath)) {
  console.error('web-build/index.html not found — run build:web first');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<meta http-equiv="refresh"[^>]*>\s*/gi, '');
html = html.replace(/<script>window\.location\.replace\(['"]\/['"]\);<\/script>\s*/gi, '');

if (!html.includes('id="root"')) {
  html = html.replace(/<body([^>]*)>/i, '<body$1>\n    <div id="root"></div>');
}

if (!html.includes('#root')) {
  const styles = `    <style>
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      #root {
        display: flex;
        flex: 1;
      }
    </style>
`;
  html = html.replace('</head>', `${styles}  </head>`);
}

fs.writeFileSync(indexPath, html);
console.log('Patched Expo SPA HTML for Vercel');

if (!fs.existsSync(aboutPath)) {
  console.error('web-build/about.html not found — marketing homepage cannot replace index.html');
  process.exit(1);
}

fs.copyFileSync(indexPath, appPath);
fs.copyFileSync(aboutPath, indexPath);
console.log('web-build/app.html = patched Expo SPA; web-build/index.html = marketing homepage');
