// Screenshots for S14 (planet 3): the base with its clerk, a przedmiescie page with the new props, a biuro page, the gated page with its elite
// before and after the lift, the boss with its variant line (the stapler arm) and its Spor. Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4194 SHOT_OUT=dist-s14 SHOT_DIR=shots-s14 npx vite build --outDir dist-s14 && node scripts/shot-s14.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4194);
const OUT = process.env.SHOT_OUT ?? 'dist-s14';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s14';
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
const PLAN = { kind: 'campaign', planet: 2, priority: 'normalny', lawId: 'grawitacja' };
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

    // a case file standing at planet 3 (planets 1 and 2 closed)
    await wait(1200);
    await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await wait(400);
    await g(() => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, character: { ...m.character, campaign: { current: 2, closed: [0, 1], finalTicket: false, caseClosed: false, extras: 0, cards: { opening: true, chapters: [] } } } });
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

    // ---- the run: przedmiescie, przedmiescie, serwerownia, the gated biuro page, the boss hall ----
    await g((plan) => window.__game.start(41, { pageCount: 5, plan }), PLAN);
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
    const near = (ids) => g((want) => {
      const h = window.__game;
      const props = h.state().page.obstacles.filter((q) => q.kind === 'prop' && q.colliders.length && want.includes(q.variant));
      const score = (q) => h.state().page.obstacles.filter((r) => r.kind === 'prop' && Math.hypot(r.x - q.x, r.y - q.y) < 280).length;
      const best = props.sort((a, b) => score(b) - score(a))[0];
      if (best) h.placePlayer(best.x, best.y + 150);
    }, ids);
    await quiet();
    // page 1: przedmiescie, near the new props if the page has any
    await near(['lodowka', 'drzwi', 'linijka']);
    await wait(900);
    await shot('page-przedmiescie-0');
    await turn(1);
    await quiet();
    await near(['lodowka', 'drzwi', 'linijka']);
    await wait(900);
    await shot('page-przedmiescie-1');
    // page 3: serwerownia (reused)
    await turn(2);
    await quiet();
    await wait(600);
    await shot('page-serwerownia-2');

    // page 4: the gated biuro page, the elite in view of the entry
    await turn(3);
    await g(() => { window.__game.state().player.suspended = true; });
    await wait(1000);
    await shot('gate-elite-entry');
    await g(() => {
      const h = window.__game;
      const s = h.state();
      const e = s.page.exit;
      const fx = e.corner[1] === 'l' ? 1 : -1;
      const fy = e.corner[0] === 't' ? 1 : -1;
      h.placePlayer(e.x + fx * 200, e.y + fy * 200);
      const elite = h.enemies.list().find((x) => x.named);
      const en = s.enemies.find((x) => x.id === elite?.id);
      if (en) {
        en.x = e.x + fx * 330;
        en.y = e.y + fy * 150;
        en.home = { x: en.x, y: en.y };
      }
    });
    await wait(1100);
    await shot('gate-before');
    // the partition rooms: the page from the middle
    await g(() => { window.__game.placePlayer(600, 800); });
    await wait(900);
    await shot('page-biuro-3');
    // slay the elite, watch the turnstile struck and the Portier seated
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      const fx = e.corner[1] === 'l' ? 1 : -1;
      const fy = e.corner[0] === 't' ? 1 : -1;
      h.placePlayer(e.x + fx * 200, e.y + fy * 200);
    });
    await wait(700);
    await g(() => {
      const h = window.__game;
      const elite = h.enemies.list().find((x) => x.named);
      if (elite) h.enemies.hit(elite.id, 'mechaniczny', 99999);
      h.advance(0.2);
    });
    await wait(500);
    await shot('gate-lifting');
    await wait(3000);
    await shot('gate-after');

    // the kill gave a level: take the first offered entry so the sheet does not cover the boss page
    if (await page.locator('.sheet:not(.hidden) .entry').first().isVisible().catch(() => false)) {
      await page.locator('.sheet:not(.hidden) .entry').first().click({ timeout: 2000 }).catch(() => undefined);
      await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 }).catch(() => undefined);
      await wait(300);
      await page.locator('.sheet.assigning:not(.hidden) .report.later').click({ timeout: 2000 }).catch(() => undefined);
      await wait(300);
    }
    // the boss page: an open-plan hall
    await turn(4);
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1200);
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
