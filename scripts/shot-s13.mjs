// Screenshots for S13 (planet 2): the chapter card, the base with its clerk, a magazyn page, the gated page before and after the lift,
// a serwerownia page, the boss with its variant line. Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4193 SHOT_OUT=dist-s13 SHOT_DIR=shots-s13 npx vite build --outDir dist-s13 && node scripts/shot-s13.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4193);
const OUT = process.env.SHOT_OUT ?? 'dist-s13';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s13';
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
const PLAN = { kind: 'campaign', planet: 1, priority: 'normalny', lawId: 'grawitacja' };
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const view of [{ tag: 'l', width: 844, height: 390 }, { tag: 'p', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => document.fonts.ready);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${view.tag}-${name}.png` });
    const wait = (ms) => page.waitForTimeout(ms);
    const g = (fn, arg) => page.evaluate(fn, arg);

    // a case file standing at planet 2 (planet 1 closed)
    await wait(1200);
    await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await wait(400);
    await g(() => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, character: { ...m.character, campaign: { current: 1, closed: [0], finalTicket: false, caseClosed: false, extras: 0, cards: { opening: true, chapters: [] } } } });
      window.__game.startBase(5);
    });
    await wait(1100);
    await shot('card-chapter');
    await g(() => document.querySelector('.card-skip')?.click());
    await wait(500);
    await shot('base-clerk');
    await g(() => window.__game.station('urzednik'));
    await wait(500);
    await shot('clerk-sheet');
    await g(() => document.querySelector('.ps-close')?.click());
    await wait(300);
    await g(() => window.__game.showCard('rewritten'));
    await wait(500);
    await shot('card-rewritten');
    await g(() => document.querySelector('.card-skip')?.click());
    await wait(200);

    // ---- the run: a magazyn page, the gated page, a serwerownia page, the boss ----
    await g((plan) => window.__game.start(41, { pageCount: 4, plan }), PLAN);
    await wait(900);
    for (let k = 0; k < 4 && (await g(() => window.__game.state()?.modal ?? null)); k++) {
      await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
      await wait(400);
    }
    const turn = async (n) => {
      await g((k) => { window.__game.state().enemies.length = 0; window.__game.turnTo(k); }, n);
      await page.waitForFunction((k) => window.__game.state()?.pageIndex === k && !window.__game.state().turning, n, { timeout: 6000 }).catch(() => undefined);
      await wait(500);
    };
    const quiet = () => g(() => { const h = window.__game; h.enemies.clear(); h.state().player.suspended = true; });
    await quiet();
    // page 1: the magazyn with the most props near one spot
    await g(() => {
      const h = window.__game;
      const s = h.state();
      const props = s.page.obstacles.filter((q) => q.kind === 'prop' && q.colliders.length);
      const score = (q) => props.filter((r) => Math.hypot(r.x - q.x, r.y - q.y) < 260).length;
      const best = props.sort((a, b) => score(b) - score(a))[0];
      if (best) h.placePlayer(best.x, best.y + 130);
    });
    await wait(900);
    await shot('page-magazyn-0');

    // page 2: the parcel gate
    await turn(1);
    await quiet();
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      h.placePlayer(e.x + (e.corner[1] === 'l' ? 175 : -175), e.y + (e.corner[0] === 't' ? 175 : -175));
    });
    await wait(1000);
    await shot('gate-before');
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      h.placePlayer(e.x + (e.corner[1] === 'l' ? 175 : -175), e.y + (e.corner[0] === 't' ? 175 : -175));
    });
    await wait(900);
    await shot('gate-figure');
    // find the key folder, show it, open it
    await g(() => {
      const h = window.__game;
      const key = h.content.list().find((c) => c.key);
      if (key) h.placePlayer(key.x - 100, key.y);
    });
    await wait(900);
    await shot('gate-key');
    await g(() => {
      const h = window.__game;
      const key = h.content.list().find((c) => c.key);
      if (key) h.content.open(key.id);
      h.advance(0.1);
      const e = h.state().page.exit;
      h.placePlayer(e.x + (e.corner[1] === 'l' ? 175 : -175), e.y + (e.corner[0] === 't' ? 175 : -175));
    });
    await wait(500);
    await shot('gate-lifting');
    await wait(2800);
    await shot('gate-after');

    // page 3: serwerownia
    await turn(2);
    await quiet();
    await g(() => {
      const h = window.__game;
      const racks = h.state().page.obstacles.filter((q) => q.variant === 'rack');
      const mid = racks.sort((a, b) => Math.abs(a.y - 800) - Math.abs(b.y - 800))[0];
      h.placePlayer(mid ? mid.x + 150 : 600, mid ? mid.y + 40 : 800);
    });
    await wait(900);
    await shot('page-serwerownia-2');
    await g(() => { window.__game.placePlayer(600, 760); });
    await wait(900);
    await shot('page-serwerownia-mid');

    // the boss page
    await turn(3);
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1200);
    await g(() => { for (const b of document.querySelectorAll('button')) if (b.textContent?.includes('Zainstaluj')) b.click(); });
    await wait(300);
    await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; h.placePlayer(h.state().player.x, h.state().player.y); });
    await wait(2200);
    await shot('boss-variant');
    await g(() => { const h = window.__game; const b = h.state().enemies.find((e) => e.boss); if (b) h.placePlayer(b.x, b.y + 190); });
    await wait(700);
    await shot('boss-spor');
    await context.close();
  }
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('shots in', SHOTS);
