// Screenshots for S24 (planet 6): the base with its clerk, a centrum page, the serwerownia, the gated archiwum page (band, Archiwista, key teczka) before and
// after the lift, archiwum pages, the Ankieta with its survey row, miasto storefront props (planet 4/5). Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4186 SHOT_OUT=dist-p6 SHOT_DIR=shots-p6 npx vite build --outDir dist-p6 && node scripts/shot-s24p6.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4186);
const OUT = process.env.SHOT_OUT ?? 'dist-p6';
const SHOTS = process.env.SHOT_DIR ?? 'shots-p6';
// SHOT_TAG prefixes every file name (shots-m5/ holds planets 5 and 6 side by side: SHOT_TAG=p5- / p6-)
const TAG = process.env.SHOT_TAG ?? '';
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
const PLAN = { kind: 'campaign', planet: 5, priority: 'normalny', lawId: 'weryfikacja-dwuetapowa' };
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
    const wait = (ms) => page.waitForTimeout(ms);
    // a kill can level the hero up and lay AKTUALIZACJA over the page: install the first entry (and put the pad off) before any picture
    const settle = async () => {
      for (let k = 0; k < 6; k++) {
        const sheet = page.locator('.sheet:not(.hidden):has(.install)');
        if (!(await sheet.first().isVisible().catch(() => false))) return;
        const later = page.locator('.sheet.assigning:not(.hidden) .report.later');
        if (await later.isVisible().catch(() => false)) {
          await later.click({ timeout: 2000 }).catch(() => undefined);
          await wait(400);
          continue;
        }
        await sheet.locator('.entry:not(.locked)').first().click({ timeout: 2000 }).catch(() => undefined);
        await sheet.locator('.install').click({ timeout: 2000 }).catch(() => undefined);
        await wait(1200);
      }
      problems.push('the update sheet stayed open');
    };
    const shot = async (name) => {
      await settle();
      await page.screenshot({ path: `${SHOTS}/${view.tag}-${TAG}${name}.png` });
    };
    const g = (fn, arg) => page.evaluate(fn, arg);

    // a case file standing at planet 6 (planets 1 to 5 closed)
    await wait(1200);
    await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await wait(400);
    await g(() => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, character: { ...m.character, campaign: { current: 5, closed: [0, 1, 2, 3, 4], finalTicket: false, caseClosed: false, extras: 0, cards: { opening: true, chapters: [] } } } });
      window.__game.startBase(6);
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

    // ---- the run: centrum x2, serwerownia, archiwum x3 (page 4 gated, page 6 the reading room) ----
    await g((plan) => window.__game.start(43, { pageCount: 6, plan }), PLAN);
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
    await wait(700);
    await shot('page-centrum-0');
    await turn(2);
    await quiet();
    await wait(700);
    await shot('page-serwerownia');
    await turn(3);
    await g(() => { window.__game.state().player.suspended = true; });
    await wait(1000);
    await shot('page-archiwum-3');
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      const fx = e.corner[1] === 'l' ? 1 : -1;
      const fy = e.corner[0] === 't' ? 1 : -1;
      h.placePlayer(e.x + fx * 240, e.y + fy * 240);
    });
    await wait(1100);
    await shot('gate-before');
    // the Archiwista on its own: the page cleared, the hero a step nearer the band so the figure stands clear of the pads
    await quiet();
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      const fx = e.corner[1] === 'l' ? 1 : -1;
      const fy = e.corner[0] === 't' ? 1 : -1;
      h.placePlayer(e.x + fx * 200, e.y + fy * 175);
    });
    await wait(1100);
    await shot('archiwista');
    await g(() => { const h = window.__game; const key = h.content.list().find((c) => c.key); if (key) h.content.open(key.id); h.advance(0.2); });
    await wait(500);
    await shot('gate-lifting');
    await wait(2800);
    await shot('gate-after');
    for (const k of [4]) {
      await turn(k);
      await quiet();
      await near(['regal', 'szuflady', 'katalog', 'czytelnia', 'pudla', 'tomy']);
      await wait(900);
      await shot(`page-archiwum-${k}`);
    }
    await g(() => { window.__game.placePlayer(600, 760); });
    await wait(700);
    await shot('page-archiwum-wide');
    // the boss page: the reading room, the Ankieta and its row of five
    await turn(5);
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1200);
    await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; });
    await wait(1800);
    await shot('boss');
    await g(() => { const h = window.__game; const i = h.spor.info(); if (i?.open && i.correct !== null) h.spor.answer(i.correct); });
    await wait(600);
    await g(() => { const h = window.__game; const b = h.state().enemies.find((e) => e.boss); if (b) { b.speed = 0; h.placePlayer(b.x + 40, b.y + 260); h.advance(4.3); } });
    await wait(900);
    await shot('boss-grid');
    // the row of five on screen: wait for a row, then stand the hero just under its middle square
    await g(() => {
      const h = window.__game;
      const b = h.state().enemies.find((e) => e.boss);
      for (let k = 0; k < 120 && b && !b.rt?.survey?.on; k++) {
        h.state().player.hp = h.state().player.hpMax; // the boss and its reminders keep hitting while the row is awaited
        h.advance(0.1);
      }
      const sv = b?.rt?.survey;
      if (sv?.on) h.placePlayer(sv.cx, sv.cy + 120);
      h.advance(0.05);
      h.state().player.hp = h.state().player.hpMax;
    });
    await wait(700);
    await shot('boss-row');
    // standing on the five-star square: the stand-on progress traced round it
    await g(() => {
      const h = window.__game;
      const b = h.state().enemies.find((e) => e.boss);
      const sv = b?.rt?.survey;
      if (sv?.on) h.placePlayer(sv.cx + 104, sv.cy);
      h.advance(0.9);
    });
    await wait(500);
    await shot('boss-grid-stand');
    // planet 4/5's miasto with the storefront props
    await g((plan) => window.__game.start(10, { pageCount: 6, plan }), { ...PLAN, planet: 4, lawId: 'oplata-serwisowa' });
    await wait(900);
    for (let k = 0; k < 4 && (await g(() => window.__game.state()?.modal ?? null)); k++) {
      await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
      await wait(400);
    }
    await turn(2);
    for (const [name, ids] of [['a', ['vitryna', 'baner']], ['b', ['furgon', 'kartony-plaskie', 'manekin']]]) {
      await quiet();
      await near(ids);
      await wait(900);
      await shot(`page-miasto-${name}`);
    }
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
