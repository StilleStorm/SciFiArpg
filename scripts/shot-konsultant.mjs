// The Konsultant filled (S19) in pictures: skills 6 to 10 and the two new ultimates mid-effect, passive 9's recording on the floor, the pads
// with the new glyphs, the loadout sheet with ten rows. One hero, 390 x 844 at 2x, clips of the page around him.
// Usage: SHOT_PORT=4199 SHOT_OUT=dist-konsultant SHOT_DIR=shots-konsultant vite build --outDir dist-konsultant && node scripts/shot-konsultant.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4199);
const OUT = process.env.SHOT_OUT ?? 'dist-konsultant';
const SHOTS = process.env.SHOT_DIR ?? 'shots-konsultant';
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

// skill: SkillIndex (5 zgloszenie, 6 formularz, 7 muzyka, 8 przerwa, 9 oddzwonimy); ult: the ultimate id; para: the paragraph; aim: what the pad hands over;
// at: the enemies relative to the hero; carry: they carry his status (Koniec kolejki); waits: ms after the cast at which a picture is taken.
const SCENES = [
  { name: 'zgloszenie', skill: 5, aim: null, at: [[110, -10], [170, 25], [60, 80]], waits: [110, 500] },
  { name: 'zgloszenie-2', skill: 5, para: 2, aim: null, at: [[130, 0], [130, 55], [130, -55], [200, 20]], waits: [110, 500] },
  { name: 'formularz', skill: 6, aim: { kind: 'wskazanie', x: 700, y: 800 }, at: [[100, 0], [130, 30], [75, -35], [250, 0]], waits: [350, 1800] },
  { name: 'formularz-3', skill: 6, para: 3, aim: { kind: 'wskazanie', x: 700, y: 800 }, at: [[100, 0], [130, 30], [75, -35]], waits: [350] },
  { name: 'muzyka', skill: 7, aim: null, at: [[90, 0], [-80, 40], [30, 110], [250, 0]], waits: [350, 2200] },
  { name: 'przerwa', skill: 8, aim: { kind: 'kierunek', dx: -1, dy: 0.2 }, at: [[60, 0], [90, 40], [70, -45]], waits: [180, 900] },
  { name: 'oddzwonimy', h: 460, skill: 9, aim: { kind: 'wskazanie', x: 720, y: 800 }, at: [[100, -75], [165, -35], [95, 80], [175, 65]], waits: [400, 3300, 5200] },
  { name: 'koniec-kolejki', ult: 'koniecKolejki', carry: true, at: [[150, 90], [-120, 40], [100, -150], [200, 20], [-60, -90]], waits: [250, 1000, 2200] },
  { name: 'ankieta', ult: 'ankieta', at: [[120, 0], [150, 30], [130, -30], [100, 50], [-150, 10]], waits: [300, 2400] },
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
    await page.evaluate((h) => window.__game.start(11, { heroId: h }), 'konsultant');
    await sleep(1300);
    await page.evaluate((sc) => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      g.placePlayer(600, 800);
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
      for (const i of [3, 4, 5, 6, 7, 8, 9]) g.hero.installSkill(i);
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
        if (sc.carry) e.statuses.push({ kind: 'do_weryfikacji', remaining: 30, source: s.player.id });
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

  // passive 9: a blocked enemy falls and leaves its bubble on the floor
  await page.evaluate((h) => window.__game.start(11, { heroId: h }), 'konsultant');
  await sleep(1300);
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    g.placePlayer(600, 800);
    s.player.hp = s.player.hpMax = 1e9;
    s.hero.pendingLevels = 0;
    s.hero.upgrades['passive9'] = 1;
    g.hero.spawn(2);
    s.enemies.forEach((e, i) => {
      e.x = s.player.x + [110, 190][i];
      e.y = s.player.y + [0, 30][i];
      e.home = { x: e.x, y: e.y };
      e.mode = 'wander';
      e.wanderTimer = 99;
      e.speed = 0;
      e.attackTimer = 99;
      e.hp = e.hpMax = 1e6;
    });
    const first = s.enemies[0];
    if (first) {
      first.claim = { textKey: 'enemies.claim.wygenerowane.resolution', type: 'mechaniczny' };
      first.statuses.push({ kind: 'zablokowany', remaining: 30, source: s.player.id });
    }
  });
  await sleep(500);
  await page.evaluate(() => {
    const s = window.__game.state();
    const first = s.enemies[0];
    if (first) {
      s.enemies.splice(0, 1);
      s.kills++;
    }
  });
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/nagranie.png`, clip: await clip(400, 0) });
  check('nagranie: the bubble lies on the floor', await page.evaluate(() => window.__game.state().zones.some((z) => z.variant === 'nagranie')));

  // the pads with the new glyphs and the loadout sheet with ten rows
  await page.evaluate((h) => window.__game.start(11, { heroId: h }), 'konsultant');
  await sleep(1300);
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.hero.pendingLevels = 0;
    for (const i of [3, 4, 5, 6, 7, 8, 9]) g.hero.installSkill(i);
    g.hero.assignPad(1, 7);
    g.hero.assignPad(2, 8);
    g.hero.assignPad(3, 9);
  });
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/pads.png` });
  const words = await page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
  check('pads: the new skills carry their words', words.join() === 'Muzyka,Przerwa,Oddzwonimy', words.join());
  await page.locator('.pause-btn').click();
  await sleep(400);
  await page.locator('[data-pause=skills]').click();
  await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/loadout.png` });
  const rows = await page.evaluate(() => document.querySelectorAll('.loadout-sheet .lo-row').length);
  check('loadout: ten rows', rows === 10, String(rows));
  await page.evaluate(() => {
    const sc = document.querySelector('.loadout-sheet .ps-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  });
  await sleep(200);
  await page.screenshot({ path: `${SHOTS}/loadout-end.png` });
  await ctx.close();

  // Konfiguracja (ten rows, the ultimate slot with three ultimates) and the chart (Karta uprawnien) from the desk, in both orientations
  for (const [prefix, viewport] of [['port', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
    const c2 = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    await c2.addInitScript(() => {
      Math.random = () => 0.4242;
      Date.now = () => 1.75e12;
    });
    const pg = await c2.newPage();
    pg.on('pageerror', (e) => problems.push(`pageerror (${prefix}): ${e.message}`));
    pg.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (${prefix}): ${m.text()}`);
    });
    await pg.goto(BASE, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__game !== undefined);
    await pg.evaluate(() => document.fonts.ready);
    await pg.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', heroId: 'konsultant' }));
    await sleep(1400);
    await pg.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      g.setLevel(36);
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
      g.enemies.clear();
      for (const i of [3, 4, 5, 6, 7, 8, 9]) g.hero.installSkill(i);
    });
    await pg.locator('.pause-btn').click();
    await sleep(400);
    await pg.locator('[data-pause=paragraphs]').click();
    await pg.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(500);
    await pg.screenshot({ path: `${SHOTS}/${prefix}-konfiguracja.png` });
    const m = await pg.evaluate(() => ({ rows: document.querySelectorAll('.kf-sheet .kf-row').length, ult: document.querySelectorAll('.kf-sheet .kf-ultrow').length, specs: document.querySelectorAll('.kf-sheet .kf-spec').length, hx: document.documentElement.scrollWidth > innerWidth + 1 }));
    check(`${prefix}: Konfiguracja lists ten skills and three columns`, m.rows === 10 && m.specs === 3 && !m.hx, JSON.stringify(m));
    await pg.evaluate(() => {
      const e = document.querySelector('.kf-sheet .ps-scroll');
      e.scrollTop = e.scrollHeight;
    });
    await sleep(250);
    await pg.screenshot({ path: `${SHOTS}/${prefix}-konfiguracja-end.png` });
    await c2.close();
    const c3 = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    await c3.addInitScript(() => {
      Math.random = () => 0.4242;
      Date.now = () => 1.75e12;
    });
    const pg3 = await c3.newPage();
    pg3.on('pageerror', (e) => problems.push(`pageerror (${prefix}): ${e.message}`));
    await pg3.goto(BASE, { waitUntil: 'load' });
    await pg3.waitForFunction(() => window.__game !== undefined);
    await pg3.evaluate(() => document.fonts.ready);
    await pg3.evaluate(() => window.__game.go('profile'));
    await pg3.locator('.profile .karta-link').waitFor({ state: 'visible', timeout: 4000 });
    await sleep(700);
    await pg3.locator('.profile .arrow').last().click(); // pralka -> konsultant
    await sleep(500);
    await pg3.screenshot({ path: `${SHOTS}/${prefix}-profile.png` });
    await pg3.evaluate(() => {
      const e = document.querySelector('.profile');
      if (e) e.scrollTop = e.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(250);
    await pg3.screenshot({ path: `${SHOTS}/${prefix}-profile-end.png` });
    await pg3.locator('.profile .karta-link').scrollIntoViewIfNeeded();
    await pg3.locator('.profile .karta-link').click();
    await pg3.locator('.kt-sheet .kt-col').first().waitFor({ state: 'visible', timeout: 3000 });
    await sleep(600);
    const k = await pg3.evaluate(() => ({ hero: document.querySelector('.kt-sheet').dataset.hero, cols: document.querySelectorAll('.kt-sheet .kt-col').length, nodes: document.querySelectorAll('.kt-sheet .kt-node').length, hx: document.documentElement.scrollWidth > innerWidth + 1, h: document.querySelector('.kt-sheet .ps-scroll').scrollHeight }));
    check(`${prefix}: the chart of the Konsultant has three columns and no sideways scroll`, k.hero === 'konsultant' && k.cols === 3 && !k.hx, JSON.stringify(k));
    for (let n = 0; n < 4; n++) {
      await pg3.screenshot({ path: `${SHOTS}/${prefix}-karta-${n}.png` });
      const more = await pg3.evaluate(() => {
        const e = document.querySelector('.kt-sheet .ps-scroll');
        const before = e.scrollTop;
        e.scrollTop = before + e.clientHeight * 0.85;
        return e.scrollTop > before;
      });
      await sleep(250);
      if (!more) break;
    }
    await c3.close();
  }
} finally {
  await browser?.close();
  stop();
}

if (problems.length) console.error(problems.join('\n'));
else console.log(`shots written to ${SHOTS}/`);
process.exit(problems.length ? 1 : 0);
