// The fourth and fifth skill (DESIGN 10.1) in pictures: the loadout sheet (one skill not installed, one on pad 2), the update
// form's step "Przypisz do przycisku", the pads with a fourth skill's word on pad 1, and a strip of the ten new pad glyphs.
// Usage: SHOT_PORT=4198 SHOT_OUT=dist-loadout SHOT_DIR=shots-loadout vite build --outDir dist-loadout && node scripts/shot-loadout.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4198);
const OUT = process.env.SHOT_OUT ?? 'dist-loadout';
const SHOTS = process.env.SHOT_DIR ?? 'shots-loadout';
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

  const startRun = async (page, hero) => {
    await page.evaluate((h) => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: h }), hero);
    await sleep(1400);
    await page.evaluate(() => {
      const s = window.__game.state();
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
      window.__game.enemies.clear();
    });
  };

  /** One orientation: pads with a 4th skill, the update step, the loadout sheet. */
  async function leg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page, 'pralka');
    const words = () => page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
    await shot('pads-before');

    // the update form's second step: the new skill is installed, the form asks which pad
    await page.evaluate(() => window.__game.hero.openAssign(3));
    await page.locator('.sheet.assigning:not(.hidden) .assign-pad').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(400);
    await shot('update-assign');
    const asked = await page.evaluate(() => ({ title: document.querySelector('.sheet.assigning h2')?.textContent, buttons: [...document.querySelectorAll('.sheet.assigning .assign-pad')].map((b) => b.textContent) }));
    check(`${prefix}: the assign step names three pads with the words they carry`, asked.buttons.length === 3 && /Przypisz/.test(asked.title ?? ''), JSON.stringify(asked));
    await page.locator('.assign-pad[data-pad="1"]').click();
    await sleep(500);
    const w = await words();
    check(`${prefix}: pad 1 now shows the fourth skill's word`, w[0] === 'Bęben', JSON.stringify(w));
    await shot('pads-after');

    // the loadout: skill 4 on pad 2, skill 5 not installed
    await page.evaluate(() => window.__game.hero.assignPad(2, 3));
    await sleep(200);
    await page.locator('.pause-btn').click();
    await sleep(400);
    await shot('pause-sheet');
    await page.locator('[data-pause=skills]').click();
    await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(300);
    await shot('loadout');
    const lo = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.loadout-sheet .lo-row')];
      const scroll = document.querySelector('.loadout-sheet .ps-scroll');
      return {
        rows: rows.length,
        off: rows.filter((r) => r.classList.contains('off')).length,
        on: [...document.querySelectorAll('.loadout-sheet .lo-pad.on')].map((b) => `${b.closest('.lo-row').dataset.skill}:${b.dataset.pad}`),
        scrolls: scroll ? scroll.scrollHeight > scroll.clientHeight + 2 : null,
        fonts: [...new Set([...document.querySelectorAll('.loadout-sheet *')].map((n) => getComputedStyle(n).fontFamily.split(',')[0].trim()))],
        radius: [...document.querySelectorAll('.loadout-sheet *')].filter((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) > 0).length,
      };
    });
    check(`${prefix}: the loadout lists five rows, one greyed, skill 4 on pad 2`, lo.rows === 5 && lo.off === 1 && lo.on.includes('3:2'), JSON.stringify(lo));
    check(`${prefix}: no rounded corners in the loadout`, lo.radius === 0, String(lo.radius));
    // tap skill 1 onto pad 2 (swaps with skill 4: it goes to pad ... off the pads when skill 1 was on pad 1)
    await page.locator('.lo-row[data-skill="0"] .lo-pad[data-pad="2"]').click();
    await sleep(250);
    await shot('loadout-after-tap');
    const after = await page.evaluate(() => window.__game.hero.info().pads);
    check(`${prefix}: tapping a pad number moves the skill`, after[1] === 0, after.join());
    await page.locator('.lo-back').click();
    await sleep(300);
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 });
  await leg('land', { width: 844, height: 390 });

  // the not-yet-installed look on a hero with a long skill name, and the loadout in the base
  {
    const { ctx, page } = await open('base', { width: 390, height: 844 });
    await page.evaluate(() => window.__game.startBase());
    await sleep(1200);
    await page.evaluate(() => window.__game.hero.installSkill(4));
    await page.locator('.pause-btn').click();
    await sleep(400);
    await page.locator('[data-pause=skills]').click();
    await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}/base-loadout.png` });
    const st = await page.evaluate(() => ({ phase: window.__game.state().phase, rows: document.querySelectorAll('.loadout-sheet .lo-row').length, off: document.querySelectorAll('.loadout-sheet .lo-row.off').length }));
    check('base: the loadout opens from the pause sheet there too', st.phase === 'base' && st.rows === 5 && st.off === 1, JSON.stringify(st));
    await ctx.close();
  }

  // the ten new glyphs: for each hero the 4th and 5th skill on pads 1 and 2, the pad strip photographed large
  for (const hero of ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik']) {
    const { ctx, page } = await open(`glyphs-${hero}`, { width: 390, height: 844 }, 3);
    await startRun(page, hero);
    await page.evaluate(() => {
      const g = window.__game;
      g.hero.installSkill(3);
      g.hero.installSkill(4);
      g.hero.assignPad(1, 3);
      g.hero.assignPad(2, 4);
    });
    await sleep(300);
    const w = await page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
    check(`glyphs: ${hero}: the pads carry the 4th and 5th skill`, w[0] !== '' && w[1] !== '' && w[0] !== w[1], w.join(' / '));
    const box = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.pad.s1, .pad.s2, .pad.s3')].map((n) => n.getBoundingClientRect());
      const x0 = Math.min(...r.map((b) => b.left));
      const y0 = Math.min(...r.map((b) => b.top));
      return { x: Math.max(0, x0 - 12), y: Math.max(0, y0 - 12), width: Math.max(...r.map((b) => b.right)) - x0 + 24, height: Math.max(...r.map((b) => b.bottom)) - y0 + 24 };
    });
    await page.screenshot({ path: `${SHOTS}/glyphs-${hero}.png`, clip: box });
    await ctx.close();
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'LOADOUT SHOTS PASSED' : `LOADOUT SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
