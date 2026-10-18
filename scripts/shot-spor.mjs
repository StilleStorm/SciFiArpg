// Spor (DESIGN 5.4) in pictures: the boss's comment and the three reply buttons, a wrong reply struck in red, a right reply
// (comment struck through, ODPOWIEDZIANO stamped), in portrait and landscape; plus the comment of the two other bosses.
// Usage: SHOT_PORT=4199 SHOT_OUT=dist-spor SHOT_DIR=shots-spor vite build --outDir dist-spor && node scripts/shot-spor.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4199);
const OUT = process.env.SHOT_OUT ?? 'dist-spor';
const SHOTS = process.env.SHOT_DIR ?? 'shots-spor';
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

  /** A run on a quiet page with one boss of `family` about 190 units above the hero; the first comment is up. */
  async function bossRun(page, family) {
    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'pralka' }));
    await sleep(1400);
    await page.evaluate((f) => {
      const g = window.__game;
      const s = g.state();
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
      g.enemies.clear();
      g.enemies.spawnBoss(f);
    }, family);
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      if (await page.evaluate(() => window.__game.spor.info()?.open === true)) break;
    }
    // fight range: the hero stands next to the boss, as in a real fight (the camera follows him)
    await page.evaluate(() => {
      const b = window.__game.state().enemies.find((e) => e.boss);
      if (b) window.__game.placePlayer(b.x + 36, b.y + 44);
    });
    await sleep(900);
  }
  const topUp = (page) => page.evaluate(() => (window.__game.state().player.hp = window.__game.state().player.hpMax));
  const stillBoss = (page) =>
    page.evaluate(() => {
      // hold the boss still for the picture
      const b = window.__game.state().enemies.find((e) => e.boss);
      if (b) {
        b.speed = 0;
        b.rt.baseSpeed = 0;
        b.attackTimer = 99;
      }
    });

  async function leg(prefix, viewport) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await bossRun(page, 'urzadzenia');
    await stillBoss(page);
    await topUp(page);
    const up = await page.evaluate(() => ({
      info: window.__game.spor.info(),
      buttons: [...document.querySelectorAll('.spor-reply')].map((b) => {
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), right: Math.round(r.right), left: Math.round(r.left), bottom: Math.round(r.bottom), radius: getComputedStyle(b).borderTopLeftRadius, font: getComputedStyle(b).fontFamily.split(',')[0] };
      }),
      bubbles: document.querySelectorAll('.bubble.comment').length,
      vw: window.innerWidth,
    }));
    check(`${prefix}: the comment is up with three boxed replies`, up.info?.open === true && up.buttons.length === 3 && up.bubbles === 1, JSON.stringify(up.buttons.map((b) => `${b.w}x${b.h}`)));
    check(`${prefix}: every reply is at least 44 px tall and inside the screen, with square corners`, up.buttons.every((b) => b.h >= 44 && b.left >= 0 && b.right <= up.vw && b.radius === '0px'), JSON.stringify(up.buttons));
    check(`${prefix}: Space Mono`, up.buttons.every((b) => /Space Mono/.test(b.font)));
    await shot('1-prompt');

    // a wrong reply: struck in red where it stands
    const wrong = up.info ? [0, 1, 2].find((i) => i !== up.info.correct) : 0;
    const hp0 = await page.evaluate(() => window.__game.state().player.hp);
    await page.locator(`.spor-reply[data-reply="${wrong}"]`).click();
    await sleep(350);
    const w = await page.evaluate(() => ({ hp: window.__game.state().player.hp, wrong: document.querySelectorAll('.spor-reply.wrong').length, notes: window.__game.notes().map((n) => n.text) }));
    check(`${prefix}: a wrong reply costs racja, is struck and prints the footnote`, w.hp < hp0 && w.wrong === 1 && w.notes.some((n) => n.includes('nie na temat')), `${hp0} -> ${w.hp}`);
    await shot('2-wrong');
    await sleep(700);
    check(`${prefix}: the strip is gone after 600 ms`, (await page.evaluate(() => document.querySelectorAll('.spor-reply').length)) === 0);

    // phase two: knock the boss below half racja, then answer right
    await topUp(page);
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => {
        const g = window.__game;
        const b = g.state().enemies.find((e) => e.boss);
        if (b && b.hp > b.hpMax / 2 + 1) g.enemies.hit(b.id, 'regulaminowy', 30);
      });
      await sleep(120);
      if (await page.evaluate(() => window.__game.spor.info()?.open === true && window.__game.spor.info().phase === 2)) break;
    }
    await sleep(500);
    await topUp(page);
    await stillBoss(page);
    const second = await page.evaluate(() => window.__game.spor.info());
    check(`${prefix}: the second comment comes with the phase`, second?.open === true && second.phase === 2);
    await shot('3-prompt-phase2');
    await page.locator(`.spor-reply[data-reply="${second?.correct ?? 0}"]`).click();
    await sleep(380);
    const r = await page.evaluate(() => ({ win: window.__game.spor.info()?.window ?? 0, picked: document.querySelectorAll('.spor-reply.picked').length, struck: document.querySelectorAll('.bubble.comment .strike').length, stamps: document.querySelectorAll('#fx .t-stamp').length }));
    check(`${prefix}: the right reply opens the window, strikes the comment and stamps`, r.win > 0 && r.picked === 1 && r.struck === 1 && r.stamps >= 1, JSON.stringify(r));
    await shot('4-right');
    await sleep(1400);
    const gone = await page.evaluate(() => ({ strip: document.querySelectorAll('.spor-reply').length, bubble: document.querySelectorAll('.bubble.comment').length }));
    check(`${prefix}: the strip and the comment are rubbed out afterwards`, gone.strip === 0 && gone.bubble === 0, JSON.stringify(gone));
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 });
  await leg('land', { width: 844, height: 390 });

  // the other two bosses' first comments, portrait (a taller figure, the captcha grid under the bubble)
  for (const family of ['powiadomienia', 'wygenerowane']) {
    const { ctx, page } = await open(`port-${family}`, { width: 390, height: 844 });
    await bossRun(page, family);
    await page.screenshot({ path: `${SHOTS}/port-${family}-prompt.png` });
    const n = await page.evaluate(() => document.querySelectorAll('.bubble.comment').length);
    check(`${family}: a comment bubble is drawn`, n === 1);
    await ctx.close();
  }
  // left-handed landscape mirrors the strip
  {
    const { ctx, page } = await open('land-lefty', { width: 844, height: 390 });
    await page.evaluate(() => window.__game.setLeftHanded(true));
    await bossRun(page, 'wygenerowane');
    await page.screenshot({ path: `${SHOTS}/land-lefty-prompt.png` });
    await ctx.close();
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'SPOR SHOTS PASSED' : `SPOR SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
