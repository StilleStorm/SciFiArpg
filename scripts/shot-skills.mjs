// The fourth and fifth skills (DESIGN 10.1) mid-effect: one hero or two, each new skill cast with its aim, a clip of the page around the hero.
// Usage: SHOT_PORT=4197 SHOT_OUT=dist-skills SHOT_DIR=shots-skills vite build --outDir dist-skills && node scripts/shot-skills.mjs
// The skills are installed through the run state (ranks 3 and 4 at rank 1, the pads set by hand), as the update form would.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4197);
const OUT = process.env.SHOT_OUT ?? 'dist-skills';
const SHOTS = process.env.SHOT_DIR ?? 'shots-skills';
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

// skill is the SkillIndex (3 or 4); aim is what the pad hands over; at places the enemies relative to the hero in world units;
// waits are the milliseconds after the cast at which a picture is taken.
const SCENES = [
  { name: 'ksiezyc', hero: 'nalesnik', skill: 4, aim: { kind: 'kierunek', dx: 1, dy: -0.3 }, at: [[110, -10], [-100, 60], [30, 120]], waits: [250, 1500] },
  { name: 'plywy', hero: 'nalesnik', skill: 3, aim: null, at: [[60, -20], [-90, 40], [20, 110], [130, -80]], waits: [120, 700] },
  { name: 'legenda', hero: 'kartograf', skill: 4, aim: { kind: 'wskazanie', x: 700, y: 800 }, at: [[90, -75], [150, 80], [45, 90]], waits: [700] },
  { name: 'skala', hero: 'kartograf', skill: 3, aim: null, at: [[110, 0], [170, 30], [230, 60]], waits: [150, 600] },
  { name: 'start', h: 560, up: 110, hero: 'petlowiec', skill: 4, aim: { kind: 'wskazanie', x: 760, y: 790 }, at: [[150, -20], [190, 30], [120, 50]], waits: [300, 560, 840] },
  { name: 'juz-bylo', hero: 'petlowiec', skill: 3, aim: null, at: [[110, -10], [150, 40], [90, 60]], waits: [250] },
  { name: 'numer', hero: 'konsultant', skill: 3, aim: { kind: 'wskazanie', x: 710, y: 800 }, at: [[110, 0], [170, -40], [150, 70]], waits: [400] },
  { name: 'rozlaczenie', hero: 'konsultant', skill: 4, aim: { kind: 'kierunek', dx: 1, dy: 0 }, at: [[100, 2], [190, -6], [80, 90]], waits: [220] },
  { name: 'beben', hero: 'pralka', skill: 3, aim: { kind: 'kierunek', dx: 1, dy: 0 }, at: [[90, 0], [120, 40], [110, -45], [60, 20]], waits: [200, 600] },
  { name: 'osobowosc', hero: 'pralka', skill: 4, aim: null, at: [[90, 0], [-100, 40], [30, 110]], waits: [700] },
];

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);

  const clip = (h = 380, up = 0) =>
    page.evaluate(
      ({ h, up }) => {
        const r = document.querySelector('#world > g[data-kind="player"]').getBoundingClientRect();
        const cy = r.top + r.height / 2 - up;
        return { x: 0, y: Math.max(0, Math.round(cy - h / 2)), width: 390, height: h };
      },
      { h, up },
    );

  for (const sc of SCENES) {
    await page.evaluate((h) => window.__game.start(11, { heroId: h }), sc.hero);
    await sleep(1300);
    await page.evaluate(
      ({ at, skill }) => {
        const g = window.__game;
        const s = g.state();
        g.enemies.clear();
        g.placePlayer(600, 800);
        s.player.hp = s.player.hpMax = 1e9;
        s.hero.pendingLevels = 0;
        g.hero.installSkill(3);
        g.hero.installSkill(4);
        g.hero.assignPad(1, skill);
        g.hero.spawn(at.length);
        s.enemies.forEach((e, i) => {
          e.x = s.player.x + at[i][0];
          e.y = s.player.y + at[i][1];
          e.home = { x: e.x, y: e.y };
          e.mode = 'wander';
          e.wanderTimer = 99;
          e.speed = 0;
          e.attackTimer = 99;
          e.hp = e.hpMax = 1e6;
        });
      },
      sc,
    );
    await sleep(900); // drawn in, the camera has settled
    if (sc.name === 'juz-bylo') {
      // something to repeat: Spor (skill 1) on pad 2 first
      await page.evaluate(() => {
        const s = window.__game.state();
        window.__game.hero.assignPad(1, 3); // pads: Juz to bylo, Spor, Petla
        window.__game.hero.cast(2);
        s.hero.cd[3] = 0;
      });
      await sleep(900);
    }
    const cast = await page.evaluate(
      ({ aim, skill }) => {
        const s = window.__game.state();
        s.hero.cd[skill] = 0;
        // the pad's cast with the aim a drag would hand over (heroes/aim.ts queueAim), through the same slot 1 (pad 0)
        return window.__game.hero.cast(1, aim ?? undefined);
      },
      sc,
    );
    const spent = await page.evaluate((skill) => window.__game.hero.info().cd[skill], sc.skill);
    if (!cast && !(spent > 0)) problems.push(`${sc.name}: the skill did not fire`);
    let last = 0;
    for (const w of sc.waits) {
      await sleep(w - last);
      last = w;
      await page.screenshot({ path: `${SHOTS}/${sc.name}-${w}.png`, clip: await clip(sc.h, sc.up) });
    }
  }
  await ctx.close();
} finally {
  await browser?.close();
  stop();
}

if (problems.length) console.error(problems.join('\n'));
else console.log(`shots written to ${SHOTS}/`);
process.exit(problems.length ? 1 : 0);
