// Recovery (PLAN 8): the Potwierdzenie note on the HUD in every layout, tap use, auto-use, the vacuum.
// Usage: SHOT_PORT=4176 SHOT_OUT=dist-recovery SHOT_DIR=shots-recovery vite build --outDir dist-recovery && node scripts/shot-recovery.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4176);
const OUT = process.env.SHOT_OUT ?? 'dist-recovery';
const SHOTS = process.env.SHOT_DIR ?? 'shots-recovery';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`preview server did not start at ${url}`);
}

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });

  /** One layout: viewport, file prefix, steering and handedness. */
  async function leg(prefix, viewport, { steering = null, lefty = false, full = true } = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      Math.random = () => 0.4242;
      Date.now = () => 1.75e12;
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror (${prefix}): ${e.message}`));
    page.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (${prefix}): ${m.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => document.fonts.ready);
    if (steering) await page.evaluate((st) => window.__game.setSteering(st), steering);
    if (lefty) await page.evaluate(() => window.__game.setLeftHanded(true));
    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
    await sleep(1500);
    await page.evaluate(() => {
      const s = window.__game.state();
      s.enemies.length = 0;
      s.hero.pendingLevels = 0;
      window.__game.hero.levelUp(); // the update line hangs on the HUD
      window.__game.setHeldPotwierdzenia(5);
    });
    await sleep(400);
    const boxes = await page.evaluate(() => {
      const r = (n) => {
        const b = n.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, name: n.className };
      };
      const visible = (n) => n.getClientRects().length > 0;
      return { potw: r(document.querySelector('.potw-btn')), others: [...document.querySelectorAll('.hud, .upd, .pad, .foot, .joy, .pause-btn, .tunnel-btn')].filter(visible).map(r), view: { w: window.innerWidth, h: window.innerHeight } };
    });
    const b = boxes.potw;
    check(`${prefix}: the Potwierdzenie note is 44 x 44 or more`, b.w >= 44 && b.h >= 44, `${b.w.toFixed(0)} x ${b.h.toFixed(0)}`);
    check(`${prefix}: it is on the screen`, b.x >= 0 && b.y >= 0 && b.x + b.w <= boxes.view.w && b.y + b.h <= boxes.view.h);
    const hits = boxes.others.filter((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
    check(`${prefix}: it touches no HUD, pad, update line, footnote, Pauza or Tunel`, hits.length === 0, hits.map((o) => `${o.name}@${o.x.toFixed(0)},${o.y.toFixed(0)},${o.w.toFixed(0)}x${o.h.toFixed(0)}`).join(', ') + ` potw ${b.x.toFixed(0)},${b.y.toFixed(0)}`);
    const stack = await page.evaluate(() => ({ slips: document.querySelectorAll('.potw-btn .slip').length, count: document.querySelector('.potw-btn .count')?.textContent ?? '' }));
    check(`${prefix}: five held read as two drawn slips and a typed count`, stack.slips === 2 && stack.count.includes('5'), `${stack.slips} slips, "${stack.count}"`);
    await page.screenshot({ path: `${SHOTS}/${prefix}-held.png` });
    await page.screenshot({ path: `${SHOTS}/${prefix}-note.png`, clip: { x: Math.max(0, b.x - 70), y: Math.max(0, b.y - 20), width: 190, height: 90 } });

    if (full) {
      await page.evaluate(() => { window.__game.state().hero.pendingLevels = 0; });
      await page.evaluate(() => { const g = window.__game; const s = g.state(); g.dropPotwierdzenie(120); g.dropPotwierdzenie(-130); s.player.hp = s.player.hpMax; s.player.potwierdzenia = 5; });
      await sleep(300);
      await page.screenshot({ path: `${SHOTS}/${prefix}-ground.png` });
      await page.evaluate(() => { window.__game.state().pickups.length = 0; });
      // a tap uses one (racja is hurt first), auto-use fires on a heavy blow, a slip on the ground is pulled in and heals
      await page.evaluate(() => { window.__game.state().hero.pendingLevels = 0; window.__game.hurtPlayer(60); });
      const hp0 = await page.evaluate(() => window.__game.state().player.hp);
      await page.locator('.potw-btn').click();
      await sleep(200);
      const after = await page.evaluate(() => ({ hp: window.__game.state().player.hp, held: window.__game.heldPotwierdzenia(), max: window.__game.state().player.hpMax }));
      check(`${prefix}: tapping the note uses one slip and heals 25%`, after.held === 4 && Math.abs(after.hp - hp0 - Math.round(after.max * 0.25)) < 0.6, JSON.stringify({ hp0, ...after }));
      await page.evaluate(() => { const s = window.__game.state(); s.player.hp = Math.round(s.player.hpMax * 0.3); window.__game.hurtPlayer(Math.round(s.player.hpMax * 0.2)); });
      const auto = await page.evaluate(() => ({ held: window.__game.heldPotwierdzenia(), notes: window.__game.notes().map((n) => n.text).filter((x) => x.includes('urzędu')).length }));
      check(`${prefix}: a heavy blow uses a slip by itself and the Asystent notes it`, auto.held === 3 && auto.notes === 1, JSON.stringify(auto));
      await page.evaluate(() => { window.__game.setHeldPotwierdzenia(0); const s = window.__game.state(); s.player.hp = 10; window.__game.dropPotwierdzenie(70); });
      await sleep(900);
      const taken = await page.evaluate(() => ({ hp: window.__game.state().player.hp, slips: window.__game.state().pickups.filter((k) => k.potwierdzenie).length }));
      check(`${prefix}: a slip within 90 units is pulled in and heals`, taken.slips === 0 && taken.hp > 10, JSON.stringify(taken));
    }
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 });
  await leg('port-joy', { width: 390, height: 844 }, { steering: 'joystick', full: false });
  await leg('land', { width: 844, height: 390 });
  await leg('land-lefty', { width: 844, height: 390 }, { lefty: true, full: false });
  await leg('port-lefty', { width: 390, height: 844 }, { steering: 'joystick', lefty: true, full: false });
  await leg('land-small', { width: 667, height: 375 }, { full: false });
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 1500));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'RECOVERY SHOTS PASSED' : `RECOVERY SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
