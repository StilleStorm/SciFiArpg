// Screenshots for aiming (DESIGN 5.6): each kierunek and wskazanie skill mid-hold with its preview, in portrait and landscape,
// and one cancelled hold. Usage: SHOT_PORT=4195 SHOT_OUT=dist-aim SHOT_DIR=shots-aim vite build --outDir dist-aim && node scripts/shot-aim.mjs
// (Port 4190 is on the unsafe-port blocklist of fetch and the browser: ERR_UNSAFE_PORT. Use another.)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4190);
const OUT = process.env.SHOT_OUT ?? 'dist-aim';
const SHOTS = process.env.SHOT_DIR ?? 'shots-aim';
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

// slot is 1..3; (dx, dy) is the finger's drag from the pad centre in css px. `at` places the enemies relative to the hero in world units.
const SCENES = [
  {
    name: 'odwirowanie',
    hero: 'pralka',
    slot: 3,
    drag: [-70, -60],
    enemies: [[-95, -135], [-165, -30], [90, -40], [100, 60], [-80, 70], [30, -150]],
  },
  { name: 'przekierowuje', hero: 'konsultant', slot: 2, drag: [-80, -30], enemies: [[-120, -45], [-100, 10], [-70, -70], [90, -60], [60, 70], [0, -140]] },
  { name: 'prosze-czekac', hero: 'konsultant', slot: 1, drag: [10, -90], enemies: [[-60, -150], [20, -145], [90, -120], [-100, 20], [80, 70]] },
  { name: 'triangulacja', hero: 'kartograf', slot: 1, drag: [-90, -40], enemies: [[-100, -45], [-170, -85], [-90, 30], [90, -60], [0, -160]] },
  { name: 'teren', hero: 'kartograf', slot: 2, drag: [20, -85], enemies: [[10, -130], [60, -150], [-40, -110], [-110, 30], [110, 40]] },
  { name: 'korekta', hero: 'kartograf', slot: 3, drag: [-40, -55], enemies: [[-60, -50], [40, -90], [90, -30], [-100, 50], [70, 70]] },
];

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const view of [
    { tag: 'portrait', width: 390, height: 844 },
    { tag: 'landscape', width: 844, height: 390 },
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: UA,
      colorScheme: 'light',
      serviceWorkers: 'block',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror (${view.tag}): ${e.message}`));
    page.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (${view.tag}): ${m.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => document.fonts.ready);

    for (const sc of SCENES) {
      await page.evaluate((h) => window.__game.start(11, { heroId: h }), sc.hero);
      await sleep(1300);
      await page.evaluate(
        ({ at }) => {
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
        },
        { at: sc.enemies },
      );
      await sleep(900); // drawn in, the camera has settled
      await page.evaluate(({ slot, drag }) => window.__game.holdPad(slot, drag[0], drag[1]), sc);
      await sleep(350);
      const during = await page.evaluate(() => ({
        preview: !!document.querySelector('#aim-fx') && document.querySelector('#aim-fx').style.opacity === '1',
        thick: document.querySelectorAll('.pad path[stroke-width="2.8"]').length,
      }));
      if (!during.preview) problems.push(`${view.tag} ${sc.name}: no preview while held`);
      if (during.thick === 0) problems.push(`${view.tag} ${sc.name}: the pad circle was not drawn thicker`);
      await page.screenshot({ path: `${SHOTS}/${view.tag}-${sc.name}.png` });
      const fired = await page.evaluate((slot) => window.__game.releasePad(slot), sc.slot);
      if (!fired) problems.push(`${view.tag} ${sc.name}: release asked for no cast`);
      await sleep(250);
      const cd = await page.evaluate((slot) => window.__game.hero.info().cd[slot - 1], sc.slot);
      if (!(cd > 0)) problems.push(`${view.tag} ${sc.name}: the skill did not fire (cd ${cd})`);
      const gone = await page.evaluate(() => document.querySelector('#aim-fx').style.opacity === '0');
      if (!gone) problems.push(`${view.tag} ${sc.name}: the preview was not erased on release`);
    }

    // a hold dragged back onto the pad cancels: nothing fires, no cooldown
    await page.evaluate(() => window.__game.start(12, { heroId: 'kartograf' }));
    await sleep(1200);
    await page.evaluate(() => {
      window.__game.enemies.clear();
      window.__game.state().player.hp = window.__game.state().player.hpMax = 1e9;
    });
    await page.evaluate(() => window.__game.holdPad(1, -80, -60));
    await sleep(250);
    await page.screenshot({ path: `${SHOTS}/${view.tag}-triangulacja-empty.png` });
    await page.evaluate(() => window.__game.holdPad(1, 3, 2));
    await sleep(200);
    const cancelled = await page.evaluate(() => ({ asked: window.__game.releasePad(1), cd: window.__game.hero.info().cd[0], shots: window.__game.state().projectiles.length }));
    if (cancelled.asked || cancelled.cd > 0 || cancelled.shots > 0) problems.push(`${view.tag}: a cancelled hold fired ${JSON.stringify(cancelled)}`);
    await ctx.close();
  }
} finally {
  await browser?.close();
  stop();
}

if (problems.length) console.error(problems.join('\n'));
else console.log(`shots written to ${SHOTS}/`);
process.exit(problems.length ? 1 : 0);
