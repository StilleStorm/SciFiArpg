// Screenshots for S27 (planet 9): the archiwum and biuro pages with the observatory props, the gated archiwum page, and the Wizualizacja with its
// observation post (phase 1) and its two posts (phase 2). Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4191 SHOT_OUT=dist-p9 SHOT_DIR=shots-p9 npx vite build --outDir dist-p9 && node scripts/shot-p9.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4189);
const OUT = process.env.SHOT_OUT ?? 'dist-p9';
const SHOTS = process.env.SHOT_DIR ?? 'shots-p9';
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
const PLAN = { kind: 'campaign', planet: 8, priority: 'normalny', lawId: 'czas-wsteczny' };
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

    await wait(1200);
    await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await wait(400);
    await g((plan) => window.__game.start(49, { pageCount: 6, plan }), PLAN);
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
    // the kill gave a level: take the first offered entry so the update sheet does not cover the page
    const dismiss = async () => {
      for (let k = 0; k < 6; k++) {
        if (await page.locator('.sheet:not(.hidden) .entry').first().isVisible().catch(() => false)) {
          await page.locator('.sheet:not(.hidden) .entry').first().click({ timeout: 2000 }).catch(() => undefined);
          await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 }).catch(() => undefined);
          await wait(300);
          await page.locator('.sheet.assigning:not(.hidden) .report.later').click({ timeout: 2000 }).catch(() => undefined);
        }
        await wait(300);
      }
    };
    const quiet = () => g(() => { const h = window.__game; h.enemies.clear(); h.state().player.suspended = true; });
    const at = (x, y) => g(([px, py]) => window.__game.placePlayer(px, py), [x, y]);

    const props = (ids) => g((want) => {
      const h = window.__game;
      const list = h.state().page.obstacles.filter((q) => q.kind === 'prop' && want.includes(q.variant));
      const best = list[0];
      if (best) h.placePlayer(best.x, best.y + 160);
      return list.map((q) => q.variant);
    }, ids);

    // archiwum pages 1-3: the observatory props
    for (const [n, ids] of [[0, ['plyty-szklane', 'tuby-map', 'stol-swietlny']], [1, ['dziennik-obserwacji', 'skrzynia-soczewek', 'przyrzad-pod-plachta', 'stol-swietlny']], [2, ['dziennik-obserwacji', 'skrzynia-soczewek', 'przyrzad-pod-plachta', 'plyty-szklane']]]) {
      await turn(n);
      await dismiss();
      await quiet();
      await at(600, 800);
      await wait(700);
      await shot(`archiwum-${n + 1}-middle`);
      const seen = await props(ids);
      await wait(800);
      console.log(`${view.tag} archiwum ${n + 1}:`, seen.join(','));
      await shot(`archiwum-${n + 1}-props`);
    }
    // page 3's gate
    await g(() => {
      const h = window.__game;
      const e = h.state().page.exit;
      const fx = e.corner[1] === 'l' ? 1 : -1;
      const fy = e.corner[0] === 't' ? 1 : -1;
      h.placePlayer(e.x + fx * 200, e.y + fy * 200);
    });
    await wait(900);
    await shot('gate');
    // biuro pages 4-6
    for (const [n, ids] of [[3, ['teleskop', 'zegar-bez-cyfr', 'tablica-rysunkowa']], [4, ['rama-pusta', 'teleskop', 'tablica-rysunkowa', 'zegar-bez-cyfr']]]) {
      await turn(n);
      await dismiss();
      await quiet();
      await at(600, 800);
      await wait(700);
      await shot(`biuro-${n + 1}-middle`);
      const seen = await props(ids);
      await wait(800);
      console.log(`${view.tag} biuro ${n + 1}:`, seen.join(','));
      await shot(`biuro-${n + 1}-props`);
    }
    // page 6: the boss hall. Phase 1: the Wizualizacja and its first post; the first Spor answered right, the escort cleared
    await turn(5);
    await dismiss();
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1000);
    await g(() => {
      const h = window.__game;
      const s = h.state();
      s.player.hp = s.player.hpMax;
      const info = h.spor.info();
      if (info?.open && info.correct !== null) h.spor.answer(info.correct);
      s.enemies = s.enemies.filter((e) => e.boss);
      const b = s.enemies[0];
      if (b) {
        b.rt.speedMul = 0;
        b.attackTimer = 1e6;
        s.player.attackTimer = 1e6;
        h.placePlayer(b.x + 20, b.y + 170);
        b.rt.obs.wait = 0.1;
      }
    });
    await wait(500);
    await g(() => { const h = window.__game; for (let i = 0; i < 6; i++) { h.state().player.hp = h.state().player.hpMax; h.advance(0.1); } });
    await wait(900);
    await shot('boss-post');
    // standing in the post: the progress ring
    await g(() => {
      const h = window.__game;
      const s = h.state();
      const q = s.enemies[0]?.rt.obs.posts[0];
      if (q) h.placePlayer(q.x, q.y);
      for (let i = 0; i < 8; i++) { s.player.hp = s.player.hpMax; h.advance(0.1); }
    });
    await wait(500);
    await shot('boss-post-stand');
    // phase 2: two posts round the player, one dotted
    await g(() => {
      const h = window.__game;
      const s = h.state();
      const b = s.enemies[0];
      if (!b) return;
      const info = h.spor.info();
      h.placePlayer(b.x + 20, b.y + 170);
      b.rt.obs.posts = [];
      b.hp = b.hpMax / 2 - 5;
      for (let i = 0; i < 80 && b.rt.obs.posts.length !== 2; i++) { s.player.hp = s.player.hpMax; h.advance(0.1); }
    });
    await wait(900);
    await g(() => { const h = window.__game; const info = h.spor.info(); if (info?.open && info.correct !== null) h.spor.answer(info.correct); });
    await wait(1800);
    await shot('boss-phase2');
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
