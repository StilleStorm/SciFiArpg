// S8: item galleries (a figure per slot and tier, all 40 bases, absurd marks, ground plates) into SHOT_DIR.
// Usage: SHOT_PORT=4182 SHOT_OUT=dist-b2 SHOT_DIR=shots-b2 npx vite build --outDir dist-b2 && node scripts/shot-s8.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4173);
const OUT = process.env.SHOT_OUT ?? 'dist';
const SHOTS = process.env.SHOT_DIR ?? 'shots';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview server did not start at ${url}`);
}

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const wait = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => window.__game.start(7));
  await wait(800);
  for (const mode of ['tiers', 'bases', 'affixes', 'ground']) {
    await page.evaluate((m) => window.__game.itemGallery(m), mode);
    await wait(300);
    await shot(`s8-${mode}`);
    if (mode === 'tiers' || mode === 'bases') {
      // the rest of the sheet below the fold: the middle and the end
      for (const [part, frac] of [['mid', 0.4], ['end', 1]]) {
        await page.evaluate((f) => {
          const g = document.getElementById('item-gallery');
          if (g) g.scrollTop = (g.scrollHeight - g.clientHeight) * f;
        }, frac);
        await wait(150);
        await shot(`s8-${mode}-${part}`);
      }
    }
  }
  await page.evaluate(() => window.__game.setTheme('night'));
  await wait(300);
  await shot('s8-ground-night');
  await page.evaluate(() => window.__game.itemGallery('tiers'));
  await wait(200);
  await shot('s8-tiers-night');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log(`S8 item shots written to ${SHOTS}/`);
}
process.exit(problems.length ? 1 : 0);
