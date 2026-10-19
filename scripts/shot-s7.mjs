// S7: the ticket form with priority, the travel list after the case, the opening page and the chapter cards. Drives the real buttons.
// Usage: SHOT_PORT=4187 SHOT_OUT=dist-s7 SHOT_DIR=shots-s7 vite build --outDir dist-s7 && node scripts/shot-s6.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4187);
const OUT = process.env.SHOT_OUT ?? 'dist-s7';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s7';
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

    // ---- cover -> creation -> base: the opening page is up over the base ----
    await sleep(1800);
    await page.locator('.start', { hasText: 'Rozpocznij' }).click();
    await page.locator('.profile .choose').waitFor({ state: 'visible' });
    await page.locator('.profile .choose').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    await sleep(900);
    check(`${prefix}: the opening page shows on the first base`, (await page.locator('.card-layer[data-card=opening]').count()) === 1);
    await shot('card-opening');
    await noHScroll('opening card');
    // the base below is not blocked: a station opens through the card layer; then the card tap removes it
    await page.locator('.card-paper').click({ position: { x: 20, y: 60 } });
    check(`${prefix}: one tap removes the card`, (await page.locator('.card-layer').count()) === 0);
    check(`${prefix}: the base still answers after the tap`, await page.evaluate(() => window.__game.station('biurko')));
    await sleep(400);
    await page.evaluate(() => window.__game.go('baza'));
    // ---- the ticket form with the priority ----
    await page.evaluate(() => window.__game.setLevel(10));
    await page.evaluate(() => window.__game.go('ticket'));
    await sleep(600);
    check(`${prefix}: four priorities, Krytyczny locked at level 10`, (await page.locator('.tk-prio').count()) === 4 && (await page.locator('.tk-prio:disabled').count()) === 1);
    await shot('ticket');
    await noHScroll('ticket');
    await page.locator('.tk-prio[data-priority=wysoki]').click();
    await sleep(200);
    check(`${prefix}: Wysoki is chosen`, (await page.locator('.tk-prio.on').getAttribute('data-priority')) === 'wysoki');
    await shot('ticket-wysoki');
    await page.locator('.start', { hasText: 'Akceptuję regulamin' }).click();
    await page.waitForFunction(() => window.__game.state()?.base?.accepted === true);
    check(`${prefix}: accepting carries the priority`, (await page.evaluate(() => window.__game.priority())) === 'wysoki');
    // ---- after the case: the travel list ----
    await page.evaluate(() => {
      const g = window.__game;
      g.setCampaignView({ planetIndex: 3, closed: [0, 1, 2], caseClosed: true, finale: false });
      g.go('baza');
    });
    await sleep(500);
    await page.evaluate(() => window.__game.go('ticket'));
    await sleep(600);
    check(`${prefix}: three closed planets and the extra ticket are listed`, (await page.locator('.tk-travel-row').count()) === 4);
    await page.locator('.tk-travel').scrollIntoViewIfNeeded();
    await shot('ticket-travel');
    await noHScroll('travel list');
    await page.evaluate(() => window.__game.go('baza'));
    await sleep(300);
    // ---- the chapter card and the rewritten one ----
    await page.evaluate(() => window.__game.setCampaignView({ planetIndex: 1, closed: [0], caseClosed: false, finale: false }));
    await page.evaluate(() => window.__game.showCard('chapter'));
    await sleep(300);
    await shot('card-chapter');
    await noHScroll('chapter card');
    await page.locator('.card-skip').click();
    check(`${prefix}: Pomiń removes the card`, (await page.locator('.card-layer').count()) === 0);
    await page.evaluate(() => window.__game.showCard('rewritten'));
    await sleep(300);
    await shot('card-rewritten');
    await page.locator('.card-paper').click({ position: { x: 20, y: 60 } });
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
for (const p of problems) console.log(`PROBLEM ${p}`);
if (failed > 0 || problems.length > 0) {
  console.log(`shot-s7: ${failed} failed, ${problems.length} problems`);
  process.exit(1);
}
console.log('shot-s7: all green');
