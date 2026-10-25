// The Kartograf filled (S20) in pictures: skills 6 to 10 and the two new ultimates mid-effect, the pads with the new glyphs, the loadout sheet
// with ten rows, Konfiguracja. One hero, 390 x 844 at 2x, clips of the page around him.
// Usage: SHOT_PORT=4182 SHOT_OUT=dist-kartograf SHOT_DIR=shots-kartograf vite build --outDir dist-kartograf && node scripts/shot-kartograf.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4182);
const OUT = process.env.SHOT_OUT ?? 'dist-kartograf';
const SHOTS = process.env.SHOT_DIR ?? 'shots-kartograf';
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
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`${name} ${detail}`);
};

// skill: SkillIndex (5 pomiar, 6 przekroj, 7 granica, 8 punktOdniesienia, 9 rozaWiatrow); ult: the ultimate id; para: the paragraph; aim: what the pad hands over;
// at: the enemies relative to the hero; waits: ms after the cast at which a picture is taken.
const SCENES = [
  { name: 'pomiar', skill: 5, aim: null, at: [[150, -10], [210, 25], [90, 80]], waits: [110, 500] },
  { name: 'przekroj', skill: 6, aim: { kind: 'kierunek', dx: 1, dy: 0 }, at: [[110, 0], [150, 45], [150, -45], [190, 90], [80, -60]], waits: [150, 500] },
  { name: 'przekroj-3', skill: 6, para: 3, aim: { kind: 'kierunek', dx: 1, dy: 0 }, at: [[110, 0], [150, 45], [150, -45], [190, 90]], waits: [400, 1200] },
  { name: 'granica', skill: 7, aim: { kind: 'kierunek', dx: 1, dy: 0 }, at: [[160, 0], [150, 50], [190, -50], [250, 20]], waits: [300, 1500] },
  { name: 'odniesienia', skill: 8, aim: { kind: 'wskazanie', x: 700, y: 800 }, at: [[170, 40], [200, -50], [60, 90]], waits: [400, 2000] },
  { name: 'roza', skill: 9, aim: null, at: [[100, 20], [-60, -90], [70, -100], [-110, 40], [320, 0]], waits: [120, 600] },
  { name: 'skreslenie', ult: 'skreslenie', at: [[120, 0], [150, 30], [130, -50], [100, 55], [-150, 10]], waits: [300, 900] },
  { name: 'pomiar-kontrolny', ult: 'pomiarKontrolny', at: [[130, 0], [140, 20], [60, 100], [-120, -60], [220, -40]], waits: [250, 900] },
];

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    Math.random = () => 0.4242;
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

  const clip = (h = 400, up = 0) =>
    page.evaluate(
      ({ h, up }) => {
        const r = document.querySelector('#world > g[data-kind="player"]').getBoundingClientRect();
        const cy = r.top + r.height / 2 - up;
        return { x: 0, y: Math.max(0, Math.round(cy - h / 2)), width: 390, height: h };
      },
      { h, up },
    );

  for (const sc of SCENES) {
    await page.evaluate((h) => window.__game.start(11, { heroId: h }), 'kartograf');
    await sleep(1300);
    await page.evaluate((sc) => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      g.placePlayer(600, 800);
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
      for (const i of [3, 4, 5, 6, 7, 8, 9, 10]) g.hero.installSkill(i);
      g.setLevel(36);
      g.hero.spawn(sc.at.length);
      s.enemies.forEach((e, i) => {
        e.x = s.player.x + sc.at[i][0];
        e.y = s.player.y + sc.at[i][1];
        e.home = { x: e.x, y: e.y };
        e.mode = 'wander';
        e.wanderTimer = 99;
        e.speed = 0;
        e.attackTimer = 99;
        e.hp = e.hpMax = 1e6;
      });
      if (sc.skill !== undefined) {
        g.hero.assignPad(1, sc.skill);
        if (sc.para) g.hero.setParagraph(g.hero.info().skillIds[sc.skill], sc.para, true);
      }
    }, sc);
    await sleep(900); // drawn in, the camera has settled
    const fired = await page.evaluate((sc) => {
      const g = window.__game;
      const s = g.state();
      if (sc.ult) {
        s.hero.ultimateId = sc.ult;
        g.fillMeter(1);
        return g.castUltimate();
      }
      s.hero.cd[sc.skill] = 0;
      return g.hero.cast(1, sc.aim ?? undefined);
    }, sc);
    check(`${sc.name}: fired`, fired === true);
    let last = 0;
    for (const w of sc.waits) {
      await sleep(w - last);
      last = w;
      await page.screenshot({ path: `${SHOTS}/${sc.name}-${w}.png`, clip: await clip(sc.h, sc.up) });
    }
  }

  // the pads with the new glyphs and the loadout sheet with ten rows
  await page.evaluate((h) => window.__game.start(11, { heroId: h }), 'kartograf');
  await sleep(1300);
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.hero.pendingLevels = 0;
    for (const i of [3, 4, 5, 6, 7, 8, 9, 10]) g.hero.installSkill(i);
    g.hero.assignPad(1, 7);
    g.hero.assignPad(2, 8);
    g.hero.assignPad(3, 9);
  });
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/pads.png` });
  const words = await page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
  check('pads: the new skills carry their words', words.join() === 'Granica,Odniesienie,Róża', words.join());
  await page.locator('.pause-btn').click();
  await sleep(400);
  await page.locator('[data-pause=skills]').click();
  await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/loadout.png` });
  const rows = await page.evaluate(() => document.querySelectorAll('.loadout-sheet .lo-row').length);
  check('loadout: ten rows', rows === 10, String(rows));
  await ctx.close();

  // Konfiguracja (ten rows, three ultimates) in portrait
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  await c2.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const pg = await c2.newPage();
  pg.on('pageerror', (e) => problems.push(`pageerror (konfiguracja): ${e.message}`));
  await pg.goto(BASE, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__game !== undefined);
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'kartograf' }));
  await sleep(1400);
  await pg.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.setLevel(36);
    s.hero.pendingLevels = 0;
    s.hero.updateRequested = false;
    g.enemies.clear();
    for (const i of [3, 4, 5, 6, 7, 8, 9, 10]) g.hero.installSkill(i);
  });
  await pg.locator('.pause-btn').click();
  await sleep(400);
  await pg.locator('[data-pause=paragraphs]').click();
  await pg.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(500);
  await pg.screenshot({ path: `${SHOTS}/konfiguracja.png` });
  const m = await pg.evaluate(() => ({ rows: document.querySelectorAll('.kf-sheet .kf-row').length, specs: document.querySelectorAll('.kf-sheet .kf-spec').length, hx: document.documentElement.scrollWidth > innerWidth + 1 }));
  check('Konfiguracja lists ten skills and three columns', m.rows === 10 && m.specs === 3 && !m.hx, JSON.stringify(m));
  await c2.close();
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  if (browser) await browser.close();
  stop();
}

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}
console.log('\nAll shots taken and checks passed.');
