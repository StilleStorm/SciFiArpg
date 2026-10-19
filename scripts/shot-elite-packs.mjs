// Screenshots for S9: an elite pack, the ten affixes, a named elite with its footnote.
// Usage: SHOT_PORT=4188 SHOT_OUT=dist-elite-packs SHOT_DIR=shots-elite-packs npx vite build --outDir dist-elite-packs && node scripts/shot-elite-packs.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4188);
const OUT = process.env.SHOT_OUT ?? 'dist-elite-packs';
const SHOTS = process.env.SHOT_DIR ?? 'shots-elite-packs';
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
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
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
  const g = (fn, arg) => page.evaluate(fn, arg);

  // a quiet page: the player is shadowbanned so nobody walks about while the picture is taken
  async function stage(seed, x = 600, y = 1000) {
    await g((s) => window.__game.start(s, { lawId: 'parzystosc', pageCount: 5 }), seed);
    await wait(900);
    await g(([x, y]) => {
      window.__game.placePlayer(x, y);
      window.__game.enemies.clear();
      window.__game.state().player.suspended = true;
    }, [x, y]);
    await wait(700);
  }

  // ---- a pack: leader and its minions ----
  await stage(5);
  await g(() => window.__game.enemies.spawnPack('urzadzenia', 'zweryfikowany'));
  await wait(1300);
  await shot('pack');

  // ---- the six new affixes, one each ----
  await stage(5);
  for (const a of ['pilny', 'odnawialny', 'powielony', 'poufny', 'nadgorliwy', 'wielokrotny']) await g((a) => window.__game.enemies.spawnFamily('urzadzenia', 1, { elite: a }), a);
  await g(() => {
    const s = window.__game.state();
    s.enemies.forEach((e, i) => {
      e.x = s.player.x - 100 + (i % 3) * 100;
      e.y = s.player.y - 90 - Math.floor(i / 3) * 130;
      e.home = { x: e.x, y: e.y };
    });
  });
  await wait(1100);
  await shot('affixes');

  // ---- a named elite and the Asystent's entry ----
  await stage(5);
  await g(() => window.__game.enemies.spawnNamed('urzadzenia'));
  await wait(6500);
  await shot('named');
  await wait(3200);
  await shot('named-later');
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('done');
