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
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ` (${detail})`}`);
};
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
        // in steps of two frames, with a rendered frame between (a projectile has a picture only if a frame saw it)
        for (let left = ms; left > 0; left -= 33) {
          s.status = 'running';
          g.advance(Math.min(33, left) / 1000);
          s.status = 'paused';
          await raf();
        }
        await raf();
        await raf();
        return {
          projectiles: s.projectiles.length,
          fx: document.querySelectorAll('#fx .attack-ink').length,
          labels: [...document.querySelectorAll('#fx text.t-note')].map((n) => n.textContent).join('|'),
        };
      },
      { who, ms, dist },
    );

  const snap = async (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, clip: await clipAround() });

  // moments (ms into the animation) that show each hero's pose best
  // (Pralka 320 ms: whip drawn 60-95, held to 275, rubbed out by 320; Konsultant: cable tip on the target at 90, home at 210;
  // Petlowiec: remark in flight, "—!" beside the helmet until ~200; Kartograf as before)
  // Kartograf: the ruled line is there at once, held 80 ms, rubbed out from the instrument over 160 ms; the label fades over 300
  // Nalesnik 220 ms: the disc turns over (scale -1 -> 1) hopping 12 toward the enemy, the slap is inked from 90 to 220
  const MOMENTS = {
    pralka: [40, 80, 130, 200, 260, 300],
    konsultant: [25, 45, 70, 90, 110, 130, 190],
    petlowiec: [20, 40, 100, 160],
    kartograf: [20, 60, 100, 160, 240, 340],
    nalesnik: [20, 50, 90, 120, 150, 200],
  };
  // how far the enemy stands: the melee hero in reach, the others at about the distance they shoot from
  const DIST = { pralka: 56, konsultant: 110, petlowiec: 90, kartograf: 130, nalesnik: 48 };
  for (const hero of Object.keys(MOMENTS)) {
    await setup(hero, 'urzadzenia', DIST[hero]);
    await snap(`atk-${hero}-0-idle`);
    for (const ms of MOMENTS[hero]) {
      const r = await attackAt('player', ms, DIST[hero]);
      await snap(`atk-${hero}-${String(ms).padStart(3, '0')}`);
      console.log(hero, ms, JSON.stringify(r));
      if (hero === 'pralka' && ms === 130) check('pralka: the whip is one fx stroke with its splash', r.fx >= 2, JSON.stringify(r));
      if (hero === 'kartograf' && ms === 20) check('kartograf: a ruled line, ticks and crosshair (3 ink strokes) and a label like "13,0 m"', r.fx >= 3 && r.labels.split('|').some((x) => /^\d+,\d\sm$/.test(x)), JSON.stringify(r));
      if (hero === 'nalesnik' && ms === 150) check('nalesnik: the ink slap is one fx stroke', r.fx >= 1, JSON.stringify(r));
      if (hero === 'konsultant' && ms === 90) {
        const cable = await page.evaluate(() => ({
          part: document.querySelectorAll('#world g[data-kind="player"] [data-part="cable"]').length,
          lash: document.querySelectorAll('#fx .attack-ink').length,
        }));
        check('konsultant: the cable is a sub-group data-part=cable and the lash is one fx stroke', cable.part === 1 && cable.lash === 1, JSON.stringify(cable));
      }
    }
    // after its duration everything is back where it was
    await attackAt('player', 400, DIST[hero]);
    await snap(`atk-${hero}-9-after`);
  }

  // Kartograf on a crit: the line doubles, the label is underlined, the line runs on past the target through the next two
  {
    await setup('kartograf', 'urzadzenia', 120);
    const placed = await page.evaluate(async () => {
      const g = window.__game;
      const s = g.state();
      s.player.stats.critChance = 1;
      s.player.stats.pewnoscSiebie = 1e6;
      // the next two stand on the ruled line from the instrument (21.6 right of and 31.6 above the hero) through the first enemy
      const first = s.enemies[0];
      const sx = 600 + 21.6;
      const sy = 800 - 31.6;
      const d1 = Math.hypot(first.x - sx, first.y - sy);
      const ux = (first.x - sx) / d1;
      const uy = (first.y - sy) / d1;
      const ids = g.enemies.spawnFamily('urzadzenia', 2);
      ids.forEach((id, i) => {
        const e = s.enemies.find((x) => x.id === id);
        e.x = sx + ux * (d1 + 60 + i * 60);
        e.y = sy + uy * (d1 + 60 + i * 60);
        e.home = { x: e.x, y: e.y };
        e.mode = 'wander';
        e.wanderTimer = 99;
        e.hp = e.hpMax = 1e9;
        e.attackTimer = 99;
      });
      await new Promise((r) => setTimeout(r, 900));
      return s.enemies.length;
    });
    let crit = null;
    for (const ms of [20, 70, 130, 200]) {
      // every shot is a crit unless the 5 percent miss comes up; the frame is only kept when the line is doubled
      for (let tries = 0; tries < 6; tries++) {
        const r = await page.evaluate(
          async ({ ms }) => {
            const g = window.__game;
            const s = g.state();
            const raf = () => new Promise((rr) => requestAnimationFrame(() => rr(null)));
            s.status = 'running';
            s.player.x = 600;
            s.player.y = 800;
            s.player.facing = 1;
            s.player.attackTimer = 0;
            document.querySelectorAll('#fx > g').forEach((n) => n.remove());
            g.attack('player');
            s.status = 'paused';
            await raf();
            await raf();
            for (let left = ms; left > 0; left -= 33) {
              s.status = 'running';
              g.advance(Math.min(33, left) / 1000);
              s.status = 'paused';
              await raf();
            }
            const lines = [...document.querySelectorAll('#fx path.attack-ink')].filter((p) => (p.getAttribute('d') ?? '').startsWith('M') && (p.getAttribute('stroke-width') ?? '') === '1.4').length;
            return { lines, hp: s.enemies.map((e) => Math.round(1e9 - e.hp)) };
          },
          { ms },
        );
        if (r.lines >= 2 || ms > 130) {
          crit = r;
          break;
        }
      }
      await snap(`atk-kartograf-crit-${String(ms).padStart(3, '0')}`);
    }
    check('kartograf: a crit draws two parallel lines and strikes all three enemies on the line', placed === 3 && crit !== null && crit.hp.filter((h) => h > 0).length === 3, JSON.stringify({ placed, crit }));
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
if (problems.length || checks.some((c) => !c.ok)) {
  console.error([...problems, ...checks.filter((c) => !c.ok).map((c) => `check failed: ${c.name}`)].join('\n'));
  process.exit(1);
}
console.log(`attack shots in ${SHOTS}/`);
