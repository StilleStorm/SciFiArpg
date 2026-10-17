// Draws the PWA icons: an ink circle with a typed "Z" on cream paper, screenshotted from an SVG
// with the bundled Chromium. Run: npm run icons (outputs are committed under public/).
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PAPER = '#f3ecd8';
const INK = '#1b1711';
const FONT = readFileSync('public/fonts/Michroma-Regular.ttf').toString('base64');

const svg = (size) => `<!doctype html><html><head><style>
  @font-face { font-family: 'Michroma'; src: url(data:font/ttf;base64,${FONT}); }
  html, body { margin: 0; background: ${PAPER}; }
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${PAPER}"/>
  <path d="M256 66C362 64 448 150 446 258C444 366 360 450 254 448C148 446 64 362 66 256C68 152 150 68 256 66Z" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M262 82C352 90 430 160 432 252" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <text x="256" y="322" text-anchor="middle" font-family="Michroma" font-size="230" fill="${INK}">Z</text>
</svg></body></html>`;

const browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(svg(size));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `public/icon-${size}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('icons written to public/');
