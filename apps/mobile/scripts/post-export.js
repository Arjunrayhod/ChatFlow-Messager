/**
 * @file Post-export script to guarantee crisp PWA icons, manifest, and meta tags in dist/index.html.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const indexPath = path.join(distDir, 'index.html');
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(distDir)) {
  console.warn('[post-export] dist directory does not exist yet.');
  process.exit(0);
}

// 1. Copy any public assets into dist if missing
if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  for (const file of publicFiles) {
    const src = path.join(publicDir, file);
    const dest = path.join(distDir, file);
    if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
      fs.copyFileSync(src, dest);
      console.log(`[post-export] Copied ${file} to dist/`);
    }
  }
}

// 2. Inject PWA manifest and high-res icon tags into dist/index.html
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  const pwaTags = `
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#121b22" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ChatFlow" />
`;

  if (!html.includes('manifest.json')) {
    html = html.replace('</head>', `${pwaTags}  </head>`);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('[post-export] Successfully injected PWA meta & high-res icons into dist/index.html!');
  } else {
    console.log('[post-export] manifest.json already present in dist/index.html.');
  }
} else {
  console.warn('[post-export] dist/index.html not found.');
}
