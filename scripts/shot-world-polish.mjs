// S28 world-polish frames: miasto and biuro props, archiwum reels, the Ankieta stars, koszyk grid, Numerek numerals, chair and phone, Petlowiec copies, Zderzenie stamp.
// Usage: SHOT_PORT=4194 SHOT_OUT=dist-world-polish SHOT_DIR=shots-world-polish npx vite build --outDir dist-world-polish && node scripts/shot-world-polish.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4185);
const OUT = process.env.SHOT_OUT ?? 'dist-world-polish';
const SHOTS = process.env.SHOT_DIR ?? 'shots-world-polish';
// SHOT_TAG prefixes every file name (shots-m5/ holds planets 5 and 6 side by side: SHOT_TAG=p5- / p6-)
const TAG = process.env.SHOT_TAG ?? '';
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);
  const wait = (ms) => page.waitForTimeout(ms);
  const g = (fn, arg) => page.evaluate(fn, arg);
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  await wait(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
  await wait(400);

  const begin = async (planet, seed, hero = 'konsultant') => {
    await g(([p, sd, h]) => window.__game.start(sd, { heroId: h, pageCount: 6, plan: { kind: 'campaign', planet: p, priority: 'niski', lawId: 'godziny-konsultanta' } }), [planet, seed, hero]);
    await wait(900);
    for (let k = 0; k < 4 && (await g(() => window.__game.state()?.modal ?? null)); k++) {
      await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
      await wait(400);
    }
    await g(() => { const s = window.__game.state(); s.player.level = 25; s.player.hp = s.player.hpMax = 1e9; });
  };
  const turn = async (n) => {
    await g((k) => { window.__game.state().enemies.length = 0; window.__game.turnTo(k); }, n);
    await page.waitForFunction((k) => window.__game.state()?.pageIndex === k && !window.__game.state().turning, n, { timeout: 6000 }).catch(() => undefined);
    await wait(500);
  };
  const quiet = () => g(() => { const h = window.__game; h.enemies.clear(); h.state().player.suspended = true; });
  const near = (ids) => g((want) => {
    const h = window.__game;
    const props = h.state().page.obstacles.filter((q) => q.kind === 'prop' && q.colliders.length && want.includes(q.variant));
    const score = (q) => h.state().page.obstacles.filter((r) => r.kind === 'prop' && Math.hypot(r.x - q.x, r.y - q.y) < 280).length;
    const best = props.sort((a, b) => score(b) - score(a))[0];
    if (best) h.placePlayer(best.x, best.y + 150);
    return best ? best.variant : null;
  }, ids);

  // planet 4: the miasto pages (zebra, timetable) then the biuro pages (the second office props)
  await begin(3, 41);
  await turn(1);
  await quiet();
  await near(['rozklad', 'pasy']);
  await wait(700);
  await shot('miasto');
  for (const k of [3, 4]) {
    await turn(k);
    await quiet();
    const v = await near(['stos-formularzy', 'drzwi-windy', 'okno-zaluzje', 'sznur']);
    if (!v) problems.push(`no second-office prop on biuro page ${k}`);
    await wait(700);
    await shot(`biuro-${k}`);
  }
  // planet 6: the archiwum reels
  await begin(5, 43);
  await turn(4);
  await quiet();
  await near(['regal']);
  await wait(700);
  await shot('archiwum');
  // planet 6 boss: the Ankieta, stars filled by lost racja
  await turn(5);
  await g(() => { window.__game.state().player.suspended = false; });
  await wait(1500);
  for (const frac of [1, 0.5, 0.1]) {
    await g((f) => { const b = window.__game.state().enemies.find((e) => e.boss); if (b) { b.hp = Math.round(b.hpMax * f); b.speed = 0; window.__game.placePlayer(b.x + 40, b.y + 150); } }, frac);
    await wait(600);
    await shot(`ankieta-${Math.round(frac * 100)}`);
  }
  // planet 5 boss: the grid with its carts
  await begin(4, 45);
  await turn(5);
  await g(() => { window.__game.state().player.suspended = false; });
  await wait(1500);
  await g(() => { const h = window.__game; const b = h.state().enemies.find((e) => e.boss); if (b) { b.speed = 0; h.placePlayer(b.x + 30, b.y + 190); h.advance(3); } });
  await wait(700);
  await shot('koszyk-grid');
  // Konsultant: Numerek numerals, the chair and the phone
  await begin(0, 47, 'konsultant');
  await g(() => {
    const h = window.__game;
    const s = h.state();
    h.enemies.clear();
    s.hero.upgrades['passive8'] = 1;
    s.hero.pendingLevels = 0;
    h.setLevel(40);
    for (let k = 3; k < h.hero.info().skillIds.length; k++) h.hero.installSkill(k);
    h.placePlayer(600, 800);
    h.hero.spawn(4);
    s.enemies.forEach((e, i) => { e.x = s.player.x + 48 + (i % 2) * 26; e.y = s.player.y + (i - 1.5) * 38; e.home = { x: e.x, y: e.y }; e.mode = 'wander'; e.hp = e.hpMax = 99999; e.attackTimer = 99; });
    h.hero.assignPad(1, 1);
    h.hero.cast(1);
    h.advance(0.3);
    h.hero.assignPad(1, 8);
    s.hero.cd.fill(0);
    h.hero.cast(1);
    h.advance(0.2);
  });
  await wait(700);
  await shot('konsultant-numerek-chair');
  // Petlowiec: copies spread
  await begin(0, 49, 'petlowiec');
  await g(() => {
    const h = window.__game;
    const s = h.state();
    h.enemies.clear();
    h.placePlayer(600, 800);
    h.hero.spawn(3);
    for (let i = 0; i < 3; i++) { s.hero.cd.fill(0); h.hero.assignPad(1, 0); h.hero.cast(1); }
  });
  await wait(900);
  await shot('petlowiec-copies');
  // Nalesnik: Zderzenie stamp lands where the roll ends (two frames)
  await begin(0, 51, 'nalesnik');
  await g(() => {
    const h = window.__game;
    const s = h.state();
    h.enemies.clear();
    s.page.obstacles.length = 0;
    h.setLevel(40);
    h.placePlayer(400, 800);
    h.hero.spawn(6);
    s.enemies.forEach((e, i) => { e.x = 700 + (i % 3) * 40; e.y = 800 + ((i % 5) - 2) * 30; e.home = { x: e.x, y: e.y }; e.mode = 'wander'; e.hp = e.hpMax = 99999; e.attackTimer = 99; });
    s.hero.ultimateId = 'zderzenie';
    s.hero.ult = { para: 1, active: [], idle: 0 };
    h.fillMeter(1);
    h.castUltimate();
  });
  await wait(250);
  await shot('zderzenie-cast');
  await wait(1000);
  await shot('zderzenie-landed');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) console.error(problems.join('\n'));
else console.log(`shots written to ${SHOTS}/`);
process.exit(problems.length ? 1 : 0);
