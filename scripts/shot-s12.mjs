// Screenshots for S12 (planet 1): the base with its clerk, the cards, a page of each location, the boss with its variant line and Spor comment.
// Usage: SHOT_PORT=4192 SHOT_OUT=dist-s12 SHOT_DIR=shots-s12 npx vite build --outDir dist-s12 && node scripts/shot-s12.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4192);
const OUT = process.env.SHOT_OUT ?? 'dist-s12';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s12';
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
const PLAN = { kind: 'campaign', planet: 0, priority: 'normalny', lawId: 'wymagana-aktualizacja' };
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const view of [{ tag: 'p', width: 390, height: 844 }, { tag: 'l', width: 844, height: 390 }]) {
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

    // ---- the base with the clerk, and his sheet ----
    await g(() => { const m = window.__game.meta(); window.__game.setMeta({ ...m, heroId: 'konsultant' }); });
    await g((s) => window.__game.startBase(s), 3);
    await wait(900);
    await g(() => document.querySelector('.card-skip')?.click());
    await wait(300);
    await shot('base-clerk');
    await g(() => window.__game.station('urzednik'));
    await wait(500);
    await shot('clerk-sheet');
    await g(() => document.querySelector('.ps-close')?.click());
    await wait(300);

    // ---- the cards: opening, chapter, rewritten ----
    for (const kind of ['opening', 'chapter', 'rewritten']) {
      await g((k) => window.__game.showCard(k), kind);
      await wait(400);
      await shot(`card-${kind}`);
      await g(() => document.querySelector('.card-skip')?.click());
      await wait(200);
    }

    // ---- a page of each location, then the boss ----
    for (const seed of [11, 12]) {
      await g(([s, plan]) => window.__game.start(s, { pageCount: 5, plan }), [seed, PLAN]);
      await wait(900);
      const pages = await g(() => window.__game.state().pages.map((p) => p.location));
      for (let i = 0; i < pages.length - 1; i++) {
        if (i > 0) await g((n) => window.__game.turnTo(n), i);
        await wait(400);
        await g(() => {
          const h = window.__game;
          h.enemies.clear();
          const s = h.state();
          s.player.suspended = true;
          const props = s.page.obstacles.filter((q) => q.kind === 'prop' && q.colliders.length);
          const score = (q) => props.filter((r) => Math.hypot(r.x - q.x, r.y - q.y) < 260).length;
          const best = props.sort((a, b) => score(b) - score(a))[0];
          if (best) h.placePlayer(best.x, best.y + 130);
        });
        await wait(700);
        if (pages[i] && seed === 11) await shot(`page-${pages[i]}-${i}`);
      }
      if (seed === 11) {
        await g((n) => window.__game.turnTo(n), pages.length - 1);
        await g(() => { window.__game.state().player.suspended = false; });
        await wait(1200);
        await g(() => { for (const b of document.querySelectorAll('button')) if (b.textContent?.includes('Zainstaluj')) b.click(); });
        await wait(300);
        await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; h.placePlayer(h.state().player.x, h.state().player.y); });
        await wait(2200);
        await shot('boss-variant');
        await g(() => { const h = window.__game; const b = h.state().enemies.find((e) => e.boss); if (b) h.placePlayer(b.x, b.y + 190); });
        await wait(700);
        await shot('boss-name');
        await g(() => document.querySelector('.spor-reply')?.focus());
        await wait(300);
        await shot('boss-spor');
      }
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
