// Screenshots for S26 (planet 8): the wyzyna pages with their props (terraces, summit), the gated jaskinia page with its named elite
// before and after the lift, and the Hipoteza with the seven-fingered arm. Landscape (l-) and portrait (p-).
// Usage: SHOT_PORT=4189 SHOT_OUT=dist-p8 SHOT_DIR=shots-p8 npx vite build --outDir dist-p8 && node scripts/shot-p8.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4189);
const OUT = process.env.SHOT_OUT ?? 'dist-p8';
const SHOTS = process.env.SHOT_DIR ?? 'shots-p8';
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
const PLAN = { kind: 'campaign', planet: 7, priority: 'normalny', lawId: 'grawitacja' };
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
    await g((plan) => window.__game.start(41, { pageCount: 6, plan }), PLAN);
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

    // page 4: the gated jaskinia page (generic obstacles until planet 7's drawings land), the elite and the Rachmistrz
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
    await g(() => {
      const h = window.__game;
      const elite = h.enemies.list().find((x) => x.named);
      if (elite) h.enemies.hit(elite.id, 'mechaniczny', 99999);
      h.advance(0.2);
    });
    await wait(3400);
    await shot('gate-after');
    await dismiss();

    // page 5: the first wyzyna page, from the middle and near the tower or pylon
    await turn(4);
    await dismiss();
    await quiet();
    await at(600, 800);
    await wait(900);
    await shot('wyzyna-middle');
    await g(() => {
      const h = window.__game;
      const props = h.state().page.obstacles.filter((q) => q.kind === 'prop' && ['wieza-triang', 'pylon-kolejki', 'schody-urwane', 'drzwi-ramowe'].includes(q.variant));
      const best = props[0];
      if (best) h.placePlayer(best.x, best.y + 150);
    });
    await wait(900);
    await shot('wyzyna-props');
    // page 6: the summit, the boss
    await turn(5);
    await dismiss();
    await g(() => { window.__game.state().player.suspended = false; });
    await wait(1200);
    await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; });
    await wait(2200);
    await shot('boss-variant');
    // the first Spor answered right, the escort cleared, the hero beside the boss: the arm in view
    await g(() => {
      const h = window.__game;
      const info = h.spor.info();
      if (info?.open && info.correct !== null) h.spor.answer(info.correct);
      const s = h.state();
      s.enemies = s.enemies.filter((e) => e.boss);
      const b = s.enemies[0];
      if (b) h.placePlayer(b.x - 90, b.y + 60);
    });
    await wait(2500);
    await shot('boss-arm');
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
