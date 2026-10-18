// Attack animations: each hero mid-auto-attack and an enemy mid-lunge, at fixed moments of the animation.
// The game is paused between frames and stepped by hand, so the pictures do not depend on timing.
// Usage: SHOT_PORT=4186 SHOT_OUT=dist-atk SHOT_DIR=shots-atk vite build --outDir dist-atk && node scripts/shot-attacks.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4186);
const OUT = process.env.SHOT_OUT ?? 'dist-atk';
const SHOTS = process.env.SHOT_DIR ?? 'shots-atk';
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
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);

  /** A clip around the player and the one enemy, with a margin. */
  const clipAround = () =>
    page.evaluate(() => {
      const rects = [...document.querySelectorAll('#world > g[data-kind="player"], #world > g[data-kind="enemy"]')].map((n) => n.getBoundingClientRect());
      const x0 = Math.min(...rects.map((r) => r.left));
      const x1 = Math.max(...rects.map((r) => r.right));
      const y0 = Math.min(...rects.map((r) => r.top));
      const y1 = Math.max(...rects.map((r) => r.bottom));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const w = 300;
      const h = 190;
      return { x: Math.max(0, Math.round(cx - w / 2)), y: Math.max(0, Math.round(cy - h / 2)), width: w, height: h };
    });

  /** Set up one hero beside one enemy (`family`), both harmless, the game paused. */
  const setup = (heroId, family, dist) =>
    page.evaluate(
      async ({ heroId, family, dist }) => {
        const g = window.__game;
        g.start(11, { heroId });
        await new Promise((r) => setTimeout(r, 1400));
        g.enemies.clear();
        g.placePlayer(600, 800);
        const s = g.state();
        const [id] = g.enemies.spawnFamily(family, 1);
        const e = s.enemies.find((x) => x.id === id);
        e.x = s.player.x + dist;
        e.y = s.player.y - 4;
        e.home = { x: e.x, y: e.y };
        e.mode = 'wander';
        e.wanderTimer = 99;
        e.hp = e.hpMax = 1e9;
        e.attackTimer = 99;
        s.player.hp = s.player.hpMax = 1e9;
        s.player.attackTimer = 99;
        await new Promise((r) => setTimeout(r, 900)); // drawn in, camera settled
        s.status = 'paused';
      },
      { heroId, family, dist },
    );

  /** One attack, then `ms` of game time, then two rendered frames. Returns the state of the world's animation nodes. */
  const attackAt = (who, ms, dist) =>
    page.evaluate(
      async ({ who, ms, dist }) => {
        const g = window.__game;
        const s = g.state();
        const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
        s.status = 'running';
        s.player.x = 600;
        s.player.y = 800;
        for (const e of s.enemies) {
          e.x = 600 + dist;
          e.y = 796;
        }
        s.player.facing = 1;
        s.projectiles.length = 0; // the shots of the earlier moments
        g.attack(who);
        s.status = 'paused';
        await raf();
        await raf(); // the first frame that sees the attack starts its clock
        if (ms > 0) {
          s.status = 'running';
          g.advance(ms / 1000);
          s.status = 'paused';
        }
        await raf();
        await raf();
        return { projectiles: s.projectiles.length, fx: document.querySelectorAll('#fx .attack-ink').length };
      },
      { who, ms, dist },
    );

  const snap = async (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, clip: await clipAround() });

  // moments (ms into the animation) that show each hero's pose best
  const MOMENTS = { pralka: [40, 90, 130, 165], konsultant: [25, 45, 65, 100], petlowiec: [40, 100, 160], kartograf: [20, 50, 90, 150] };
  // how far the enemy stands: the melee hero in reach, the others at about the distance they shoot from
  const DIST = { pralka: 56, konsultant: 110, petlowiec: 90, kartograf: 130 };
  for (const hero of Object.keys(MOMENTS)) {
    await setup(hero, 'urzadzenia', DIST[hero]);
    await snap(`atk-${hero}-0-idle`);
    for (const ms of MOMENTS[hero]) {
      const r = await attackAt('player', ms, DIST[hero]);
      await snap(`atk-${hero}-${String(ms).padStart(3, '0')}`);
      console.log(hero, ms, JSON.stringify(r));
    }
    // after its duration everything is back where it was
    await attackAt('player', 400, DIST[hero]);
    await snap(`atk-${hero}-9-after`);
  }

  for (const family of ['urzadzenia', 'powiadomienia', 'wygenerowane']) {
    await setup('pralka', family, 56);
    await snap(`atk-enemy-${family}-0-idle`);
    for (const ms of [60, 120, 150, 170, 200]) {
      await attackAt('enemy', ms, 56);
      await snap(`atk-enemy-${family}-${String(ms).padStart(3, '0')}`);
    }
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`attack shots in ${SHOTS}/`);
