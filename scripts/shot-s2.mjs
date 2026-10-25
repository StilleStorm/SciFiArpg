// S2 in pictures: the update form with a paragraph entry, a pad with the paragraph tag, Konfiguracja from the pause sheet and the desk.
// Usage: SHOT_PORT=4182 SHOT_OUT=dist-s2 SHOT_DIR=shots-s2 vite build --outDir dist-s2 && node scripts/shot-s2.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4182);
const OUT = process.env.SHOT_OUT ?? 'dist-s2';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s2';
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

  async function leg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page, 'pralka');
    await page.evaluate(() => {
      window.__game.state().player.level = 7; // § 2 of skills 1..3 opens at 7 (skill level 1 + 6)
    });
    await page.evaluate(() => window.__game.hero.openUpdate());
    await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(500);
    await shot('update');
    const first = await page.evaluate(() => [...document.querySelectorAll('.sheet:not(.hidden) .entry')].map((e) => e.querySelector('.title')?.textContent));
    check(`${prefix}: the update form leads with a paragraph and offers three`, first.length === 3 && /paragraf 2/.test(first[0] ?? ''), JSON.stringify(first));
    await page.locator('.sheet:not(.hidden) .entry').first().click();
    await page.locator('.sheet:not(.hidden) .install').click();
    await page.locator('.sheet:not(.hidden)').waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
    await sleep(900);
    const tags = await page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .ptag`)?.textContent ?? ''));
    check(`${prefix}: pad 1 carries the tag after picking § 2`, tags[0] === '§2' && tags[1] === '' , JSON.stringify(tags));
    await shot('pads');
    const clip = await page.evaluate(() => {
      const r = document.querySelector('.pad.s1').getBoundingClientRect();
      return { x: Math.max(0, r.left - 30), y: Math.max(0, r.top - 30), width: r.width + 70, height: r.height + 70 };
    });
    await page.screenshot({ path: `${SHOTS}/${prefix}-pad-tag.png`, clip });
    // § 2 of skill 2 is open at this level as well: the sheet from the pause line switches to it
    await page.locator('.pause-btn').click();
    await sleep(400);
    await page.locator('[data-pause=paragraphs]').click();
    await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(500);
    await shot('konfiguracja');
    const kf = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.kf-sheet .kf-box')];
      return {
        rows: document.querySelectorAll('.kf-sheet .kf-row').length,
        boxes: boxes.length,
        active: boxes.filter((b) => b.classList.contains('active')).length,
        small: boxes.filter((b) => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44).length,
        radius: [...document.querySelectorAll('.kf-sheet *')].filter((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius) > 0).length,
      };
    });
    check(`${prefix}: Konfiguracja lists ten skills (Pralka, S19), boxes of at least 44 px, one stamp per installed skill`, kf.rows === 10 && kf.small === 0 && kf.active === 3 && kf.radius === 0, JSON.stringify(kf));
    await page.locator('.kf-row[data-skill="1"] .kf-box[data-n="2"]').click();
    await sleep(300);
    const act = await page.evaluate(() => window.__game.state().hero.para?.[1]);
    check(`${prefix}: tapping an open box switches the paragraph`, act === 2, String(act));
    await shot('konfiguracja-switched');
    await page.locator('.kf-back').click();
    await sleep(300);
    const back = await page.evaluate(() => document.querySelector('.pause-sheet:not(.hidden)') !== null);
    check(`${prefix}: Wróć returns to the pause sheet`, back);
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 });
  await leg('land', { width: 844, height: 390 });

  {
    const { ctx, page } = await open('desk', { width: 390, height: 844 });
    await page.evaluate(() => window.__game.startBase());
    await sleep(1200);
    await page.evaluate(() => window.__game.station('biurko'));
    await page.locator('[data-desk=konfiguracja]').waitFor({ state: 'visible', timeout: 3000 });
    await page.screenshot({ path: `${SHOTS}/desk-line.png` });
    await page.locator('[data-desk=konfiguracja]').click();
    await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(400);
    await page.screenshot({ path: `${SHOTS}/desk-konfiguracja.png` });
    await page.locator('.kf-back').click();
    await sleep(300);
    const ok = await page.evaluate(() => document.querySelector('.desk-sheet:not(.hidden)') !== null && document.querySelector('.kf-sheet') === null);
    check('desk: Wróć returns to the desk', ok);
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
console.log(failed.length === 0 ? 'S2 SHOTS PASSED' : `S2 SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
