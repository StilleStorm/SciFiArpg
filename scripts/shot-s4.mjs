// S4 in pictures: the Konfiguracja form (pads, ultimate slot, columns, categories, paragraphs) and the Karta uprawnień, both orientations.
// Usage: SHOT_PORT=4184 SHOT_OUT=dist-s4 SHOT_DIR=shots-s4 vite build --outDir dist-s4 && node scripts/shot-s4.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4184);
const OUT = process.env.SHOT_OUT ?? 'dist-s4';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s4';
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

  async function open(prefix, viewport, scale = 2) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
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
    return { ctx, page };
  }

  const startRun = async (page, hero, level) => {
    await page.evaluate((h) => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: h }), hero);
    await sleep(1400);
    await page.evaluate((lv) => {
      const s = window.__game.state();
      s.player.level = lv;
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
      window.__game.enemies.clear();
    }, level);
  };

  const sizes = (page, sel) =>
    page.evaluate((q) => [...document.querySelectorAll(q)].filter((n) => n.getClientRects().length > 0).map((n) => ({ w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height })), sel);
  const scrollEnd = (page, sel) => page.evaluate((q) => { const e = document.querySelector(q); e.scrollTop = e.scrollHeight; }, sel);

  async function formLeg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page, 'pralka', 15);
    await page.locator('.pause-btn').click();
    await sleep(400);
    check(`${prefix}: the pause line reads Konfiguracja`, (await page.locator('[data-pause=paragraphs]').textContent()) === 'Konfiguracja');
    await page.locator('[data-pause=paragraphs]').click();
    await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(500);
    await shot('konfiguracja');
    const m = await page.evaluate(() => ({
      rows: document.querySelectorAll('.kf-sheet .kf-row, .kf-sheet .kf-ultrow').length,
      slots: document.querySelectorAll('.kf-sheet .kf-slot').length,
      specs: document.querySelectorAll('.kf-sheet .kf-spec').length,
      cats: [...document.querySelectorAll('.kf-sheet .kf-type')].map((n) => n.textContent),
      radius: [...document.querySelectorAll('.kf-sheet *')].filter((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) > 0).length,
      cue: document.querySelector('.kf-cue')?.classList.contains('on') ?? false,
      scrolls: (() => { const e = document.querySelector('.kf-sheet .ps-scroll'); return e.scrollHeight > e.clientHeight + 6; })(),
    }));
    check(`${prefix}: thirteen rows (ten skills, the ultimate in the slot and Pralka's two others), four slots, three columns, a category on every row`, m.rows === 13 && m.slots === 4 && m.specs === 3 && m.cats.every((c) => /·/.test(c ?? '')), JSON.stringify(m));
    check(`${prefix}: no rounded corners`, m.radius === 0);
    check(`${prefix}: a form taller than the window shows the scroll cue`, !m.scrolls || m.cue, `scrolls=${m.scrolls} cue=${m.cue}`);
    for (const sel of ['.kf-pad', '.kf-spec', '.kf-box:not(:disabled)', '.kf-back']) {
      const z = await sizes(page, sel);
      // the back button sits below the fold: measured after the scroll
      if (sel === '.kf-back') continue;
      check(`${prefix}: every ${sel} is at least 44 px`, z.length > 0 && z.every((r) => r.w >= 44 && r.h >= 44), JSON.stringify(z.slice(0, 2)));
    }
    await scrollEnd(page, '.kf-sheet .ps-scroll');
    await sleep(250);
    await shot('konfiguracja-end');
    const end = await page.evaluate(() => {
      const b = document.querySelector('.kf-back').getBoundingClientRect();
      const f = document.querySelector('.kf-sheet .ps-scroll').getBoundingClientRect();
      return { fits: b.bottom <= f.bottom + 1 && b.top >= f.top, h: b.height, cueOn: document.querySelector('.kf-cue').classList.contains('on') };
    });
    check(`${prefix}: the last row is reachable and the cue is gone at the end`, end.fits && end.h >= 44 && !end.cueOn, JSON.stringify(end));
    await page.evaluate(() => { document.querySelector('.kf-sheet .ps-scroll').scrollTop = 0; });
    // odwirowanie (skill 3) onto pad 1: pad 1's skill goes to pad 3
    await page.locator('.kf-row[data-skill="2"] .kf-pad[data-pad="1"]').click();
    await sleep(300);
    const pads = await page.evaluate(() => [...window.__game.state().hero.pads]);
    check(`${prefix}: a pad button moves the skill and swaps the other`, pads.join() === '2,1,0', pads.join());
    const sel = await page.evaluate(() => ({ on: document.querySelector('.kf-spec.on')?.dataset.spec ?? null, line: document.querySelector('.kf-cap-line')?.textContent ?? '' }));
    check(`${prefix}: no column chosen, no capstone (the choice is the player's)`, sel.on === null && !/Przyznano/.test(sel.line), JSON.stringify(sel));
    await page.locator('.kf-spec[data-spec="osoba"]').click();
    await sleep(250);
    const on = await page.evaluate(() => ({ on: document.querySelector('.kf-spec.on')?.dataset.spec ?? null, line: document.querySelector('.kf-cap-line')?.textContent ?? '', cap: window.__game.loadoutInfo()?.capstone }));
    check(`${prefix}: choosing a column with two skills on the pads grants its capstone`, on.on === 'osoba' && /Przyznano/.test(on.line) && on.cap === 'osobowosc', JSON.stringify(on));
    await shot('konfiguracja-changed');
    await page.locator('.kf-row[data-skill="1"] .kf-box[data-n="2"]').click();
    await sleep(250);
    check(`${prefix}: a paragraph box still switches`, (await page.evaluate(() => window.__game.state().hero.para?.[1])) === 2);
    await scrollEnd(page, '.kf-sheet .ps-scroll');
    await page.locator('.kf-back').click();
    await sleep(300);
    check(`${prefix}: Wróć returns to the pause sheet`, await page.evaluate(() => document.querySelector('.pause-sheet:not(.hidden)') !== null));
    await ctx.close();
  }

  async function deskLeg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page, 'pralka', 15);
    await page.evaluate(() => window.__game.endTicket());
    await sleep(900);
    await page.evaluate(() => window.__game.startBase());
    await sleep(1200);
    await page.evaluate(() => window.__game.station('biurko'));
    await page.locator('[data-desk=konfiguracja]').waitFor({ state: 'visible', timeout: 3000 });
    await sleep(300);
    await shot('desk');
    await page.locator('[data-desk=konfiguracja]').click();
    await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('.kf-row[data-skill="1"] .kf-pad[data-pad="3"]').click();
    await sleep(300);
    await page.locator('.kf-back').scrollIntoViewIfNeeded();
    await page.locator('.kf-back').click();
    await sleep(500);
    const saved = await page.evaluate(() => window.__game.character()?.pads ?? null);
    check(`${prefix}: a change made at the desk is in the saved character`, Array.isArray(saved) && saved[2] === 1 && saved[1] === 2, JSON.stringify(saved));
    // the chart from the desk
    await page.locator('[data-desk=karta]').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('[data-desk=karta]').click();
    await page.locator('.kt-sheet .kt-col').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(600);
    await shot('karta');
    const k = await page.evaluate(() => ({
      cols: document.querySelectorAll('.kt-sheet .kt-col').length,
      caps: document.querySelectorAll('.kt-sheet .kt-cap').length,
      granted: document.querySelectorAll('.kt-sheet [data-state=granted]').length,
      gated: document.querySelectorAll('.kt-sheet [data-state=gated]').length,
      gateText: document.querySelectorAll('.kt-sheet .kt-gate').length,
      stamps: document.querySelectorAll('.kt-sheet .kt-stamp').length,
      radius: [...document.querySelectorAll('.kt-sheet *')].filter((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) > 0).length,
      hx: document.documentElement.scrollWidth > innerWidth + 1,
      scrolls: (() => { const e = document.querySelector('.kt-sheet .ps-scroll'); return e.scrollHeight > e.clientHeight + 6; })(),
      cue: document.querySelector('.kt-sheet .kf-cue')?.classList.contains('on') ?? false,
    }));
    check(`${prefix}: the chart has three columns, a capstone at each foot, stamps on held boxes and grey on gated ones`, k.cols === 3 && k.caps === 3 && k.granted > 3 && k.gated > 0 && k.gateText > 0 && k.stamps >= k.granted && k.radius === 0 && !k.hx, JSON.stringify(k));
    check(`${prefix}: the chart is scrollable and says so`, k.scrolls && k.cue, JSON.stringify({ s: k.scrolls, c: k.cue }));
    await scrollEnd(page, '.kt-sheet .ps-scroll');
    await sleep(300);
    await shot('karta-end');
    const back = await page.evaluate(() => { const b = document.querySelector('.kt-back').getBoundingClientRect(); return b.height >= 44 && b.bottom <= innerHeight; });
    check(`${prefix}: the chart's last row (Wróć) is reachable`, back);
    await page.locator('.kt-back').click();
    await sleep(300);
    check(`${prefix}: Wróć returns to the desk`, await page.evaluate(() => document.querySelector('.desk-sheet:not(.hidden)') !== null && document.querySelector('.kt-sheet') === null));
    await ctx.close();
  }

  async function profileLeg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    await page.evaluate(() => window.__game.go('profile'));
    await page.locator('.profile .karta-link').waitFor({ state: 'visible', timeout: 4000 });
    await sleep(900);
    await page.screenshot({ path: `${SHOTS}/${prefix}-profile.png` });
    const heroes = ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'];
    for (let i = 0; i < heroes.length; i++) {
      await page.locator('.profile .karta-link').click();
      await page.locator('.kt-sheet .kt-col').first().waitFor({ state: 'visible', timeout: 3000 });
      await sleep(500);
      const m = await page.evaluate(() => ({ hero: document.querySelector('.kt-sheet').dataset.hero, cols: document.querySelectorAll('.kt-sheet .kt-col').length, caps: document.querySelectorAll('.kt-sheet .kt-cap').length, nodes: document.querySelectorAll('.kt-sheet .kt-node').length, hx: document.documentElement.scrollWidth > innerWidth + 1 }));
      check(`${prefix}: chart of ${heroes[i]} opens from the profile`, m.hero === heroes[i] && m.cols === 3 && m.caps === 3 && m.nodes > 9 && !m.hx, JSON.stringify(m));
      if (i === 0 || i === 3) {
        await page.screenshot({ path: `${SHOTS}/${prefix}-karta-${heroes[i]}.png` });
        await scrollEnd(page, '.kt-sheet .ps-scroll');
        await sleep(250);
        await page.screenshot({ path: `${SHOTS}/${prefix}-karta-${heroes[i]}-end.png` });
      }
      await page.locator('.kt-back').scrollIntoViewIfNeeded();
      await page.locator('.kt-back').click();
      await sleep(250);
      await page.locator('.profile .arrow').last().click();
      await sleep(300);
    }
    await ctx.close();
  }

  await formLeg('port', { width: 390, height: 844 });
  await formLeg('land', { width: 844, height: 390 });
  await deskLeg('deskp', { width: 390, height: 844 });
  await deskLeg('deskl', { width: 844, height: 390 });
  await profileLeg('profp', { width: 390, height: 844 });
  await profileLeg('profl', { width: 844, height: 390 });
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'S4 SHOTS PASSED' : `S4 SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
