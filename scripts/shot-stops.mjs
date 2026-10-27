// Przystanki (DESIGN 4.1, S21a): the stop on a run page (unregistered, then registered with its pen ring and stamp), the base with
// the stop board station, the open board with the stops of two planets, a tap on the board printing the ticket from that page, and a
// tap on a registered stop in a run going back to the base; both orientations.
// Usage: SHOT_PORT=4200 SHOT_OUT=dist-stops SHOT_DIR=shots-stops vite build --outDir dist-stops && node scripts/shot-stops.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4200);
const OUT = process.env.SHOT_OUT ?? 'dist-stops';
const SHOTS = process.env.SHOT_DIR ?? 'shots-stops';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
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
process.on('exit', () => server.kill('SIGTERM'));
const problems = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const CHARACTER = {
  version: 2,
  heroId: 'konsultant',
  level: 4,
  xp: 0,
  upgrades: {},
  permissions: [],
  pendingLevels: 0,
  pads: [0, 1, 2],
  gwiazdki: 30,
  equipment: {},
  inventory: [],
  campaign: { current: 1, closed: [0], finalTicket: false, caseClosed: false, extras: 0, cards: { opening: true, chapters: [0, 1] } },
  stops: { 0: [0, 2, 4], 1: [0] },
};
const PLAN = { kind: 'campaign', planet: 0, priority: 'normalny', lawId: 'parzystosc' };

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const [prefix, viewport] of [['port', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
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
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    const screenOf = (sel) => page.evaluate((s) => {
      const svg = document.getElementById('stage');
      const m = svg.getScreenCTM();
      const o = window.__game.state();
      const p = s === 'stop' ? o.page.stop : o.page.base.stations.find((x) => x.id === s);
      return { x: m.a * p.x + m.e, y: m.d * (p.y - 30) + m.f };
    }, sel);

    // ---- the stop on a run page: not registered, then registered ----
    await page.evaluate(([plan]) => window.__game.start(11, { plan, phase: 'run' }), [PLAN]);
    await sleep(900);
    const info0 = await page.evaluate(() => window.__game.stops.info());
    check(`${prefix}: page 1 carries a stop, none registered`, info0.stop !== null && info0.stop.registered === false && info0.planet === 0, JSON.stringify(info0.carries));
    await page.evaluate(() => {
      window.__game.stops.place(false);
      window.__game.advance(0.2);
    });
    await sleep(1100);
    await shot('stop-open');
    await page.evaluate(() => {
      window.__game.stops.place(true);
      window.__game.advance(0.2);
    });
    await sleep(900);
    const info1 = await page.evaluate(() => ({ i: window.__game.stops.info(), ring: document.querySelector('#page [data-stop="registered"]') !== null, notes: window.__game.notes().map((n) => n.text) }));
    check(`${prefix}: walking over it registers the page, the post is redrawn with its ring, the Asystent writes the footnote`, info1.i.stop.registered && info1.i.registered[0]?.includes(0) && info1.ring && info1.notes.some((n) => n.includes('przystanek')), JSON.stringify(info1.i.registered));
    await shot('stop-registered');

    // ---- a tap on the registered stop settles the run as Zakończ ----
    await page.evaluate(() => window.__game.stops.place(false));
    await sleep(300);
    const at = await screenOf('stop');
    await page.touchscreen.tap(at.x, at.y + 18);
    await sleep(900);
    const after = await page.evaluate(() => ({ screen: window.__game.screen(), bookmark: window.__game.meta().bookmark ?? null, phase: window.__game.state()?.phase ?? null }));
    check(`${prefix}: a tap on a registered stop in a run goes back to the base with the bookmark on that page`, after.screen === 'baza' && after.phase === 'base' && after.bookmark !== null && after.bookmark.pageIndex === 0, JSON.stringify(after.bookmark?.pageIndex));

    // ---- the base with the stop board, and the open board with two planets ----
    await page.evaluate((c) => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, heroId: 'konsultant', character: c, bookmark: undefined });
    }, CHARACTER);
    await page.evaluate(() => window.__game.startBase(3));
    await sleep(1500);
    await page.evaluate(() => {
      const s = window.__game.state();
      const b = s.page.base.stations.find((x) => x.id === 'przystanek');
      window.__game.placePlayer(b.x - 110, b.y + 90);
    });
    await sleep(900);
    const lay = await page.evaluate(() => window.__game.state().base.layout);
    const label = await page.evaluate(() => document.querySelector('.base-label[data-label="przystanek"] text')?.textContent ?? null);
    check(`${prefix}: the base has the stop board station with its label`, label !== null && label.length > 3, `${lay} ${label}`);
    await shot('base-board');
    const tapAt = await screenOf('przystanek');
    await page.touchscreen.tap(tapAt.x, tapAt.y + 18);
    await sleep(600);
    const open = await page.evaluate(() => ({ sheet: document.querySelector('.stops-sheet') !== null, buttons: [...document.querySelectorAll('.stops-sheet .stop-go')].map((b) => ({ s: b.dataset.stop, h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })) }));
    check(`${prefix}: a tap on the board opens the sheet with the stops of two planets, each button at least 44 px high`, open.sheet && open.buttons.length === 4 && open.buttons.every((b) => b.h >= 44), JSON.stringify(open.buttons.map((b) => b.s)));
    await shot('board-open');
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${prefix}: the board has no horizontal scroll`, wide <= 0, String(wide));

    // ---- a tap on a stop prints the ticket from that page ----
    await page.evaluate(() => document.querySelector('.stop-go[data-stop="0:4"]').click());
    await sleep(900);
    const trip = await page.evaluate(() => {
      const s = window.__game.state();
      return { screen: window.__game.screen(), phase: s.phase, pageIndex: s.pageIndex, planet: s.plan?.planet, count: s.pageCount, bookmark: window.__game.meta().bookmark ?? null, sheet: document.querySelector('.ps') !== null };
    });
    check(`${prefix}: travel sets the exit to page 5 of planet 1 with at least 5 pages, the sheet is gone`, trip.screen === 'baza' && trip.pageIndex === 4 && trip.planet === 0 && trip.count >= 5 && trip.bookmark?.pageIndex === 4 && !trip.sheet, JSON.stringify(trip));
    await page.evaluate(() => window.__game.walkToExit());
    await sleep(1500);
    const run = await page.evaluate(() => {
      const s = window.__game.state();
      return { phase: s.phase, index: s.pageIndex, planet: s.plan.planet, stop: s.page.stop ? s.page.stop.registered : null, notes: window.__game.notes().length };
    });
    check(`${prefix}: the exit leads to page 5 of the planet with its stop already registered`, run.phase === 'run' && run.index === 4 && run.planet === 0 && run.stop === true, JSON.stringify(run));
    await shot('travelled');
    await ctx.close();
  }
  if (problems.length) {
    console.log(problems.join('\n'));
    failed++;
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
console.log(failed ? `${failed} problem(s)` : 'all ok');
process.exit(failed ? 1 : 0);
