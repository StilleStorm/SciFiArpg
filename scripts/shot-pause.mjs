// Pause, the pause sheet, settings opened from it, and the resume line on the base (DESIGN 2, 4.1), in both orientations,
// plus the checks that go with them: the pause note is 44 x 44 and collides with nothing, pausing holds the clock and keeps the
// same state object, Zakończ goes to the base with a bookmark, and resuming lands on the same page with full racja.
// Usage: SHOT_PORT=4187 SHOT_OUT=dist-pause SHOT_DIR=shots-pause vite build --outDir dist-pause && node scripts/shot-pause.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4187);
const OUT = process.env.SHOT_OUT ?? 'dist-pause';
const SHOTS = process.env.SHOT_DIR ?? 'shots-pause';
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

  /** One orientation: the viewport, the file prefix and the pause note's expected neighbours. */
  async function leg(prefix, viewport, steering) {
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
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    if (steering) await page.evaluate((st) => window.__game.setSteering(st), steering);

    // ---- a run in progress with a few things happening ----
    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
    await sleep(1600);
    await page.evaluate(() => {
      const g = window.__game;
      g.giveItem('rzadki');
      g.giveItem('nietypowy');
      g.hero.levelUp(); // the typed "aktualizacja dostepna" line hangs on the HUD: the pause note must not touch it
    });
    await sleep(500);
    await shot('run');

    // ---- the pause note: 44 x 44 and clear of everything else ----
    const boxes = await page.evaluate(() => {
      const r = (n) => {
        const b = n.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, name: n.className };
      };
      const visible = (n) => n.getClientRects().length > 0;
      return {
        pause: r(document.querySelector('.pause-btn')),
        others: [...document.querySelectorAll('.hud, .upd, .pad, .foot, .joy')].filter(visible).map(r),
        view: { w: window.innerWidth, h: window.innerHeight },
      };
    });
    const p = boxes.pause;
    check(`${prefix}: the pause note is at least 44 x 44`, p.w >= 44 && p.h >= 44, `${p.w.toFixed(0)} x ${p.h.toFixed(0)}`);
    check(`${prefix}: the pause note is on the screen`, p.x >= 0 && p.y >= 0 && p.x + p.w <= boxes.view.w && p.y + p.h <= boxes.view.h);
    const hits = boxes.others.filter((o) => p.x < o.x + o.w && o.x < p.x + p.w && p.y < o.y + o.h && o.y < p.y + p.h);
    check(`${prefix}: the pause note touches no HUD, pad, update line or footnote`, hits.length === 0, hits.map((o) => o.name).join(', '));

    // the queued update would open its form as soon as the page is calm; it has served its purpose
    await page.evaluate(() => {
      const s = window.__game.state();
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
    });

    // ---- pause: the clock holds, the same state object continues ----
    await page.evaluate(() => {
      window.__keep = window.__game.state();
    });
    const t0 = await page.evaluate(() => window.__game.state().time);
    await page.locator('.pause-btn').click();
    await sleep(500);
    const paused = await page.evaluate(() => ({ status: window.__game.state().status, time: window.__game.state().time, sheet: !!document.querySelector('.pause-sheet') }));
    check(`${prefix}: tapping Pauza holds the run and opens the sheet`, paused.status === 'paused' && paused.sheet, JSON.stringify(paused));
    await sleep(700);
    const t1 = await page.evaluate(() => window.__game.state().time);
    check(`${prefix}: the clock does not move while paused`, t1 === paused.time && t1 >= t0, `${t0.toFixed(2)} -> ${t1.toFixed(2)}`);
    await shot('pause-sheet');

    // ---- settings in place, and back to the sheet ----
    await page.locator('[data-pause=settings]').click();
    await sleep(400);
    const inSettings = await page.evaluate(() => ({ screen: window.__game.screen(), sheetHidden: document.querySelector('.pause-sheet')?.classList.contains('hidden') ?? null, form: !!document.querySelector('.screen:not(.hidden) .set-grid') }));
    check(`${prefix}: Ustawienia opens the settings over the run, not the base`, inSettings.screen === 'run' && inSettings.form && inSettings.sheetHidden === true, JSON.stringify(inSettings));
    await shot('pause-settings');
    await page.locator('.screen:not(.hidden) .form-btn').click();
    await sleep(300);
    const back = await page.evaluate(() => ({ screen: window.__game.screen(), sheetHidden: document.querySelector('.pause-sheet')?.classList.contains('hidden') ?? null }));
    check(`${prefix}: Wróć returns to the pause sheet`, back.screen === 'run' && back.sheetHidden === false, JSON.stringify(back));

    // ---- Wznów: exactly the same state ----
    await page.locator('[data-pause=resume]').click();
    await sleep(500);
    const resumed = await page.evaluate(() => ({ same: window.__keep === window.__game.state(), status: window.__game.state().status, time: window.__game.state().time, sheet: !!document.querySelector('.pause-sheet') }));
    check(`${prefix}: Wznów continues the same state object`, resumed.same && resumed.status === 'running' && !resumed.sheet && resumed.time > t1, JSON.stringify(resumed));

    // ---- Zakończ: to the base, the ticket bookmarked ----
    await page.evaluate(() => window.__game.turnTo(2));
    await sleep(1500);
    await page.evaluate(() => {
      const g = window.__game;
      g.enemies.clear();
      g.hurtPlayer(10);
    });
    const before = await page.evaluate(() => {
      const s = window.__game.state();
      return { page: s.pageIndex, number: s.ticket.number, hpMax: s.player.hpMax, level: s.player.level };
    });
    await page.locator('.pause-btn').click();
    await sleep(400);
    await shot('pause-sheet-page3');
    await page.locator('[data-pause=end]').click();
    await sleep(900);
    const base = await page.evaluate(() => ({
      screen: window.__game.screen(),
      bookmark: window.__game.meta().bookmark ?? null,
      character: window.__game.character(),
      line: document.querySelector('.resume-btn')?.textContent ?? null,
      sheet: !!document.querySelector('.pause-sheet'),
    }));
    check(`${prefix}: Zakończ goes to the base with a bookmark and the character saved`, base.screen === 'baza' && base.bookmark?.pageIndex === before.page && base.character !== null && !base.sheet, JSON.stringify(base.bookmark));
    check(`${prefix}: the base offers "Wznów zgłoszenie nr ..." at the top`, typeof base.line === 'string' && base.line.includes(String(before.number)), base.line ?? 'none');
    await shot('baza-resume');

    // ---- resume: same page index, racja full, the reassignment footnote ----
    await page.locator('.resume-btn').click();
    await sleep(1800);
    const after = await page.evaluate(() => {
      const s = window.__game.state();
      return { screen: window.__game.screen(), page: s.pageIndex, hp: s.player.hp, hpMax: s.player.hpMax, time: s.time, level: s.player.level, enemies: s.enemies.length, pickups: s.pickups.length, bookmark: window.__game.meta().bookmark ?? null, note: document.querySelector('.foot')?.textContent ?? '' };
    });
    check(`${prefix}: resuming lands on the same page index`, after.screen === 'run' && after.page === before.page, `page ${after.page}`);
    check(`${prefix}: racja is full, enemies are back, the floor is clean`, after.hp === after.hpMax && after.enemies > 0 && after.pickups === 0, `hp ${after.hp}/${after.hpMax}, enemies ${after.enemies}`);
    check(`${prefix}: the level survived the round trip`, after.level === before.level, `level ${after.level}`);
    check(`${prefix}: a footnote says the ticket was reassigned`, after.note.includes('innemu konsultantowi'), after.note.slice(0, 80));
    check(`${prefix}: the bookmark is rewritten for the resumed page`, after.bookmark?.pageIndex === before.page);
    await shot('resumed');

    // ---- a ticket that ends tears the bookmark up ----
    await page.evaluate(() => window.__game.hero.die('zgloszenie'));
    await sleep(8500);
    const ended = await page.evaluate(() => ({ screen: window.__game.screen(), bookmark: window.__game.meta().bookmark ?? null }));
    check(`${prefix}: after the ticket ends there is no bookmark`, ended.screen === 'baza' && ended.bookmark === null, JSON.stringify(ended));
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 }, null);
  await leg('port-joy', { width: 390, height: 844 }, 'joystick');
  await leg('land', { width: 844, height: 390 }, null);
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'PAUSE SHOTS PASSED' : `PAUSE SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
