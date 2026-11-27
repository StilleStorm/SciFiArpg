// Screenshots for the desktop keyboard and mouse (DESIGN 2, S29): pads with key numerals, a mouse-aimed preview held on a key,
// the settings sheet with the Celowanie line, and the 390 px phone frame unchanged. Real keyboard and mouse events.
// Usage: SHOT_PORT=4195 SHOT_OUT=dist-desktop SHOT_DIR=shots-desktop vite build --outDir dist-desktop && node scripts/shot-desktop.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4195);
const OUT = process.env.SHOT_OUT ?? 'dist-desktop';
const SHOTS = process.env.SHOT_DIR ?? 'shots-desktop';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const watch = (page, tag) => {
  page.on('pageerror', (e) => problems.push(`pageerror (${tag}): ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (${tag}): ${m.text()}`);
  });
};
const arena = (at) =>
  window.__game.state() &&
  (() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9;
    s.hero.pendingLevels = 0;
    g.placePlayer(600, 800);
    g.hero.spawn(at.length);
    s.enemies.forEach((e, i) => {
      e.x = s.player.x + at[i][0];
      e.y = s.player.y + at[i][1];
      e.home = { x: e.x, y: e.y };
      e.mode = 'wander';
      e.hp = e.hpMax = 1e6;
    });
  })();

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });

  // ---- desktop 1280 x 720 ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'light', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__game.start(11, { heroId: 'kartograf' }));
  await sleep(1300);
  await page.evaluate(arena, [[-100, -45], [-170, -85], [-90, 30], [90, -60], [0, -160]]);
  await sleep(900);
  const noKeys = await page.evaluate(() => document.documentElement.hasAttribute('data-keys'));
  if (noKeys) problems.push('numerals shown before any key was seen');

  // WASD: D moves the hero right, release stops
  const x0 = await page.evaluate(() => window.__game.state().player.x);
  await page.keyboard.down('KeyD');
  await sleep(500);
  const x1 = await page.evaluate(() => window.__game.state().player.x);
  await page.keyboard.up('KeyD');
  await sleep(150);
  const x2 = await page.evaluate(() => window.__game.state().player.x);
  await sleep(250);
  const x3 = await page.evaluate(() => window.__game.state().player.x);
  if (!(x1 > x0 + 20)) problems.push(`D did not steer right (${x0} -> ${x1})`);
  if (Math.abs(x3 - x2) > 0.5) problems.push(`hero kept moving after the key came up (${x2} -> ${x3})`);
  const seen = await page.evaluate(() => document.documentElement.hasAttribute('data-keys'));
  if (!seen) problems.push('numerals not shown after a key press');
  await page.evaluate(arena, [[-100, -45], [-170, -85], [-90, 30], [90, -60], [0, -160]]);
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/desktop-pads.png` });

  // a mouse-aimed preview held on key 1
  const hero = await page.evaluate(() => {
    const el = document.querySelector('#world [data-id="player"]') ?? document.querySelector('#world g');
    const r = el ? el.getBoundingClientRect() : { left: 640, top: 360, width: 0, height: 0 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.evaluate(() => window.__game.setSettings({ aim: 'mysz' }));
  await page.mouse.move(hero.x - 230, hero.y - 90);
  await page.keyboard.down('Digit1');
  await sleep(350);
  const during = await page.evaluate(() => ({ preview: document.querySelector('#aim-fx')?.style.opacity === '1' }));
  if (!during.preview) problems.push('no preview while key 1 is held in mysz');
  await page.screenshot({ path: `${SHOTS}/desktop-aim-key.png` });
  await page.keyboard.up('Digit1');
  await sleep(250);
  const cd = await page.evaluate(() => window.__game.hero.info().cd[0]);
  if (!(cd > 0)) problems.push(`key 1 release did not fire (cd ${cd})`);
  if (await page.evaluate(() => document.querySelector('#aim-fx')?.style.opacity !== '0')) problems.push('preview not erased after key up');

  // Esc pauses, Esc again resumes; settings show the Celowanie line
  await page.keyboard.press('Escape');
  await sleep(300);
  if ((await page.evaluate(() => window.__game.state().status)) !== 'paused') problems.push('Esc did not pause');
  await page.evaluate(() => window.__game.go('settings'));
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/desktop-settings.png` });
  const line = await page.evaluate(() => [...document.querySelectorAll('.set-group h3')].some((n) => n.textContent === 'Celowanie'));
  if (!line) problems.push('the Celowanie line is missing from Ustawienia');
  await page.keyboard.press('Escape'); // settings -> pause sheet
  await sleep(200);
  await page.keyboard.press('Escape'); // pause sheet -> run
  await sleep(300);
  if ((await page.evaluate(() => window.__game.state().status)) !== 'running') problems.push('Esc Esc did not resume');
  await ctx.close();

  // ---- phone 390 x 844, no keyboard: unchanged ----
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  const p2 = await phone.newPage();
  watch(p2, 'phone');
  await p2.goto(BASE, { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__game !== undefined);
  await p2.evaluate(() => document.fonts.ready);
  await p2.evaluate(() => window.__game.start(11, { heroId: 'kartograf' }));
  await sleep(1500);
  if (await p2.evaluate(() => getComputedStyle(document.querySelector('.pad.s1 .pad-key')).display) !== 'none') problems.push('phone shows key numerals');
  await p2.screenshot({ path: `${SHOTS}/phone-portrait.png` });
  const small = await p2.evaluate(() => [...document.querySelectorAll('.pad')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
  if (small) problems.push('a pad is smaller than 44 px');
  await phone.close();
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('shot-desktop: ok');
