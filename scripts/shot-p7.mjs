// Screenshots for S26 (planet 7): jaskinia pages 1-3, rownina pages 4-6 and the boss page with Hipoteza. Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4188 SHOT_OUT=dist-p7 SHOT_DIR=shots-p7 npx vite build --outDir dist-p7 && node scripts/shot-p7.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4188);
const OUT = process.env.SHOT_OUT ?? 'dist-p7';
const SHOTS = process.env.SHOT_DIR ?? 'shots-p7';
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
const PLAN = { kind: 'campaign', planet: 6, priority: 'normalny', lawId: 'nie-przeszkadzac' };
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

        await wait(1200);
    await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
    await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await wait(400);
    // planets 7-9 are past CAMPAIGN_LAST until S27: the run starts by hook, no chapter card or base
    // ---- the run: jaskinia x3, rownina x3 (page 6 the boss page) ----
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
    const props = (names) => g((want) => window.__game.state().page.obstacles.filter((q) => q.kind === 'prop' && want.includes(q.variant)).length, names);
    const stand = (names, k = 0) => g(([want, n]) => {
      const h = window.__game;
      const list = h.state().page.obstacles.filter((q) => q.kind === 'prop' && q.colliders.length && want.includes(q.variant));
      const q = list[n % Math.max(1, list.length)];
      if (q) h.placePlayer(q.x, q.y + 170);
    }, [names, k]);
    await quiet();
    await wait(700);
    await shot('jaskinia-0');
    await stand(['malowidlo', 'stalaktyt', 'kolumna', 'kosci', 'krysztaly', 'lampa', 'lina', 'drabina-skalna'], 0);
    await wait(800);
    await shot('jaskinia-0-props');
    for (const k of [1, 2]) {
      await turn(k);
      await quiet();
      await stand(['malowidlo', 'stalaktyt', 'kolumna', 'kosci', 'krysztaly', 'lampa', 'lina', 'drabina-skalna'], k);
      await wait(900);
      await shot(`jaskinia-${k}`);
    }
    for (const k of [3, 4]) {
      await turn(k);
      await quiet();
      await stand(['slupki', 'brama', 'drogowskaz', 'stog', 'studnia', 'strach', 'slupy', 'drzewo'], k);
      await wait(900);
      await shot(`rownina-${k}`);
    }
    await g(() => { window.__game.placePlayer(600, 760); });
    await wait(700);
    await shot('rownina-wide');
    await turn(5);
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1200);
    await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; });
    await wait(1800);
    await shot('boss');
    await context.close();
  }
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
}
