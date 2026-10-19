// S3 in pictures: the ultimate stamp pad and the Argument meter, empty and full, in portrait (tap and joystick) and landscape, right- and left-handed.
// Usage: SHOT_PORT=4183 SHOT_OUT=dist-s3 SHOT_DIR=shots-s3 vite build --outDir dist-s3 && node scripts/shot-s3.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4183);
const OUT = process.env.SHOT_OUT ?? 'dist-s3';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s3';
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

  async function leg(prefix, viewport, { steer, lefty, boss = false }) {
    const { ctx, page } = await open(prefix, viewport);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    await startRun(page, 'pralka');
    await page.evaluate(([st, l]) => {
      window.__game.setSteering(st);
      window.__game.setLeftHanded(l);
    }, [steer, lefty]);
    await sleep(500);
    // below the level of the first ultimate the pad is not there at all
    const locked = await page.evaluate(() => ({ info: window.__game.ultimatePad(), shown: document.querySelector('.pad.ult')?.getClientRects().length ?? 0 }));
    check(`${prefix}: below level 12 the pad is hidden`, locked.info?.hidden === true && locked.shown === 0, JSON.stringify(locked));
    await page.evaluate(() => window.__game.setLevel(12));
    // empty: drawn disabled, a press does nothing
    await page.evaluate(() => window.__game.setMeterUi(0.3));
    await sleep(250);
    const mid = await page.evaluate(() => window.__game.ultimatePad());
    check(`${prefix}: at 30% the pad is disabled and three strokes are inked`, mid?.off === true && mid.ready === false && mid.inked === 3, JSON.stringify(mid));
    await shot('empty');
    const fired0 = await page.evaluate(() => {
      document.querySelector('.pad.ult').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      return { meter: window.__game.state().player.meter };
    });
    check(`${prefix}: a press on the disabled pad casts nothing and keeps the meter`, fired0.meter === 0.3, JSON.stringify(fired0));
    // geometry
    const geo = await page.evaluate(() => {
      const rect = (e) => {
        const r = e.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const ult = document.querySelector('.pad.ult');
      const ur = rect(ult);
      const others = [...document.querySelectorAll('.pad:not(.ult), .pause-btn, .tunnel-btn, .upd:not(.hidden), .hud, .foot')].filter((e) => e.getClientRects().length).map((e) => ({ cls: e.className, ...rect(e) }));
      // the tappable area of a pad is its svg; compare the svg with the others' svgs/buttons
      const sv = rect(ult.querySelector('svg'));
      const hit = others.filter((o) => sv.l < o.r && sv.r > o.l && sv.t < o.b && sv.b > o.t).map((o) => o.cls);
      return { w: ur.w, h: ur.h, sv, hit, vw: innerWidth, vh: innerHeight, inside: ur.l >= 0 && ur.r <= innerWidth && ur.t >= 0 && ur.b <= innerHeight };
    });
    check(`${prefix}: the pad is at least 44 px, on screen, and overlaps no other control`, geo.sv.w >= 44 && geo.sv.h >= 44 && geo.h >= 44 && geo.inside && geo.hit.length === 0, JSON.stringify({ w: geo.w, h: geo.h, hit: geo.hit, inside: geo.inside }));
    // full
    await page.evaluate(() => window.__game.setMeterUi(1));
    await sleep(300);
    const full = await page.evaluate(() => window.__game.ultimatePad());
    check(`${prefix}: at a full meter the pad is ready`, full?.ready === true && full.off === false && full.inked === 10, JSON.stringify(full));
    await shot('full');
    const argFull = await page.evaluate(() => document.querySelector('.hud .arg')?.classList.contains('full') && document.querySelector('.hud .arg label')?.textContent);
    check(`${prefix}: the HUD meter reads Argument and is red when full`, argFull === 'Argument', String(argFull));
    const clip = await page.evaluate(() => {
      const r = document.querySelector('.pad.ult').getBoundingClientRect();
      return { x: Math.max(0, r.left - 40), y: Math.max(0, r.top - 30), width: r.width + 80, height: r.height + 60 };
    });
    await page.screenshot({ path: `${SHOTS}/${prefix}-pad-full.png`, clip });
    const hudClip = await page.evaluate(() => {
      const r = document.querySelector('.hud').getBoundingClientRect();
      return { x: Math.max(0, r.left), y: 0, width: Math.min(innerWidth - r.left, r.width + 10), height: r.bottom + 10 };
    });
    await page.screenshot({ path: `${SHOTS}/${prefix}-hud-full.png`, clip: hudClip });
    // cast
    const cast = await page.evaluate(() => {
      document.querySelector('.pad.ult').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      return { meter: window.__game.state().player.meter };
    });
    await sleep(250);
    cast.info = await page.evaluate(() => window.__game.ultimatePad());
    check(`${prefix}: pressing the full pad spends the meter and the pad is disabled again`, cast.meter === 0 && cast.info?.off === true, JSON.stringify(cast));
    await shot('after');
    await ctx.close();
  }

  await leg('port-tap', { width: 390, height: 844 }, { steer: 'tap', lefty: false });
  await leg('port-joy', { width: 390, height: 844 }, { steer: 'joystick', lefty: false });
  await leg('port-lefty', { width: 390, height: 844 }, { steer: 'tap', lefty: true });
  await leg('land', { width: 844, height: 390 }, { steer: 'joystick', lefty: false });
  await leg('land-lefty', { width: 844, height: 390 }, { steer: 'joystick', lefty: true });
  await leg('land-small', { width: 640, height: 360 }, { steer: 'joystick', lefty: false });
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'S3 SHOTS PASSED' : `S3 SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
