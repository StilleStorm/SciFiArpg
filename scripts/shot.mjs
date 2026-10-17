// Renders key screens into shots/ with the bundled Chromium. Usage: npm run build && npm run shot
// (the npm script builds first). Test hook used: window.__game, see docs/ARCHITECTURE.md.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4173);
// Several agents may run this at once: give each its own port, build dir and shots dir.
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

  await wait(2200);
  await shot('title');

  await page.evaluate(() => window.__game.start(7));
  await wait(1500);
  await shot('run');

  // a hit, a critical-looking second hit, then the kill; capture while the strike is on the page
  await page.evaluate(() => window.__game.hitEnemy());
  await wait(120);
  await page.evaluate(() => window.__game.hitEnemy());
  await wait(200);
  await page.evaluate(() => window.__game.killEnemy());
  await wait(420);
  await shot('strike');

  // tap-to-move: a real pointer tap, then capture the x mark and the walking figure
  await wait(900);
  await page.touchscreen.tap(300, 330);
  await wait(250);
  await shot('tap');

  // the paper ends: walk into the left edge for the margin note and the hatched border
  await page.evaluate(() => window.__game.placePlayer(70, 900));
  await wait(1800);
  await page.touchscreen.tap(4, 420);
  await wait(900);
  await shot('edge');

  await page.evaluate(() => window.__game.setTheme('night'));
  await wait(400);
  await shot('run-night');
  await page.evaluate(() => window.__game.setTheme('day'));

  await page.evaluate(() => window.__game.hurtPlayer(25));
  await wait(300);
  await shot('hurt');

  await page.evaluate(() => window.__game.hurtPlayer(9999));
  await wait(1600);
  await shot('death');

  const snap = await page.evaluate(() => window.__game.screen());
  if (snap !== 'death') problems.push(`expected death screen, got ${snap}`);
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log('shots written to shots/');
}
process.exit(problems.length ? 1 : 0);
