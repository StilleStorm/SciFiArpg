// S10: the clerk on the base page and his sheet, the notice board with side tickets, the Karta osobowa from the desk and the HUD. Drives the real buttons.
// Usage: SHOT_PORT=4188 SHOT_OUT=dist-s10 SHOT_DIR=shots-s10 vite build --outDir dist-s10 && node scripts/shot-s10-quests.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4188);
const OUT = process.env.SHOT_OUT ?? 'dist-s10';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s10';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

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

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));
const problems = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const [prefix, viewport] of [['port', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      Math.random = () => 0.4242;
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
    const noHScroll = async (label) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${prefix}: ${label}: no horizontal scroll`, w <= 0, String(w));
    };
    const screenName = () => page.evaluate(() => window.__game.screen());

    // ---- cover -> creation -> base (the opening page is tapped away) ----
    await sleep(1800);
    await page.locator('.start', { hasText: 'Rozpocznij' }).click();
    await page.locator('.profile .choose').waitFor({ state: 'visible' });
    await page.locator('.profile .choose').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    await sleep(900);
    if ((await page.locator('.card-layer').count()) > 0) await page.locator('.card-paper').click({ position: { x: 20, y: 60 } });
    await sleep(900);
    await shot('base-clerk');
    await noHScroll('base');
    check(`${prefix}: the clerk is drawn on the base page`, (await page.locator('[data-station=urzednik]').count()) === 1);
    // ---- the clerk's sheet ----
    check(`${prefix}: a tap on the clerk opens his sheet`, await page.evaluate(() => window.__game.station('urzednik')));
    await page.locator('.npc-sheet').waitFor({ state: 'visible' });
    await sleep(300);
    check(`${prefix}: three lines on the sheet`, (await page.locator('.npc-line').count()) === 3);
    await shot('clerk-sheet');
    await noHScroll('clerk sheet');
    await page.locator('[data-npc=back]').click();
    await sleep(200);
    check(`${prefix}: Wróć closes the clerk's sheet and the base answers`, (await page.locator('.npc-sheet').count()) === 0);
    // ---- the board: take two tickets ----
    await page.evaluate(() => window.__game.station('tablica'));
    await page.locator('.board-sheet').waitFor({ state: 'visible' });
    await sleep(300);
    check(`${prefix}: the board offers two tickets`, (await page.locator('.bq-card [data-bq=accept]').count()) === 2);
    await shot('board-offers');
    await noHScroll('board');
    await page.locator('.bq-card [data-bq=accept]').first().click();
    await sleep(150);
    await page.locator('.bq-card [data-bq=accept]').first().click();
    await sleep(250);
    check(`${prefix}: two tickets taken`, (await page.locator('.bq-card.taken').count()) === 2);
    const first = await page.evaluate(() => window.__game.quests.active()[0]?.id ?? '');
    await shot('board-taken');
    await page.evaluate((id) => window.__game.quests.finish(id), first);
    // reopen: the card reads as ready
    await page.locator('.ps-close').click();
    await sleep(200);
    await page.evaluate(() => window.__game.station('tablica'));
    await page.locator('.board-sheet').waitFor({ state: 'visible' });
    await sleep(250);
    check(`${prefix}: a finished ticket offers the report`, (await page.locator('[data-bq=report]').count()) === 1);
    await page.locator('[data-bq=report]').click();
    await sleep(350);
    check(`${prefix}: the report stamps the card and pays`, (await page.locator('.bq-card.done .bq-stamp').count()) === 1 && (await page.evaluate(() => window.__game.quests.done())) === 1);
    await shot('board-reported');
    await noHScroll('board after the report');
    await page.locator('.ps-close').click();
    await sleep(250);
    // ---- the Karta osobowa from the desk, with something to print ----
    await page.evaluate(() => {
      const g = window.__game;
      g.setLevel(9);
      g.fillMeter(0.6);
      g.setHeldPotwierdzenia(3);
      const s = g.state();
      s.player.statuses.push({ kind: 'zgloszony', remaining: 6, source: null });
      s.player.permissions.push('urzadzenia');
      s.player.stats.resist.regulaminowy = 15;
      const ids = { pralka: 'pralnia', konsultant: 'infolinia', petlowiec: null, kartograf: 'pomiar', nalesnik: null };
      const spec = ids[s.player.heroId];
      if (spec) g.setSpecialization(spec);
    });
    await page.evaluate(() => window.__game.station('biurko'));
    await page.locator('.desk-sheet').waitFor({ state: 'visible' });
    await sleep(300);
    check(`${prefix}: the desk has the Karta osobowa line`, (await page.locator('[data-desk=osobowa]').count()) === 1);
    await page.locator('[data-desk=osobowa]').click();
    await page.locator('.os-sheet').waitFor({ state: 'visible' });
    await sleep(350);
    check(`${prefix}: the card has its sections`, (await page.locator('.os-sec').count()) === 7);
    await shot('osobowa-top');
    await noHScroll('Karta osobowa');
    await page.evaluate(() => {
      const sc = document.querySelector('.os-sheet .ps-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(200);
    await shot('osobowa-foot');
    await page.locator('[data-osobowa=back]').click();
    await sleep(200);
    check(`${prefix}: Wróć shows the desk again`, (await page.locator('.desk-sheet:not(.hidden)').count()) === 1 && (await page.locator('.os-sheet').count()) === 0);
    await page.locator('.desk-sheet .ps-close').click();
    await sleep(250);
    // ---- the HUD's Reputacja line opens the card and holds the game ----
    await page.locator('.hud .field.rep').click();
    await page.locator('.os-sheet').waitFor({ state: 'visible' });
    await sleep(250);
    check(`${prefix}: the HUD line opens the card with the game held`, (await page.evaluate(() => window.__game.state().status)) === 'paused');
    await page.locator('[data-osobowa=back]').click();
    await sleep(250);
    check(`${prefix}: Wróć lets the game go`, (await page.evaluate(() => window.__game.state().status)) === 'running' && (await page.locator('.ps').count()) === 0);
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
for (const p of problems) console.log(`PROBLEM ${p}`);
if (failed > 0 || problems.length > 0) {
  console.log(`shot-s10-quests: ${failed} failed, ${problems.length} problems`);
  process.exit(1);
}
console.log('shot-s10-quests: all green');
