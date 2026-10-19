// Screenshots for S10 page content: teczki (closed, open), the six seals, the three events, a buff stamp.
// Usage: SHOT_PORT=4183 SHOT_OUT=dist-world-content SHOT_DIR=shots-world-content npx vite build --outDir dist-world-content && node scripts/shot-s10-content.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4183);
const OUT = process.env.SHOT_OUT ?? 'dist-world-content';
const SHOTS = process.env.SHOT_DIR ?? 'shots-world-content';
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
    deviceScaleFactor: 2,
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
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const wait = (ms) => page.waitForTimeout(ms);
  const g = (fn, arg) => page.evaluate(fn, arg);

  async function stage(seed) {
    await g((s) => window.__game.start(s, { pageCount: 5 }), seed);
    await wait(900);
    await g(() => {
      const h = window.__game;
      h.enemies.clear();
      const s = h.state();
      s.page.content = [];
      s.page.obstacles = [];
      // the cleared obstacles' and content's drawings go too, or they float over the HUD pads with no body under them
      for (const o of document.querySelectorAll('#page [data-obstacle], #page [data-content]')) o.remove();
      s.player.suspended = true;
      h.placePlayer(600, 800);
    });
    await wait(500);
  }

  // ---- teczki: closed, then open ----
  await stage(5);
  const ids = await g(() => [window.__game.content.put('teczka', { dist: -60, dy: -40 }), window.__game.content.put('teczka', { dist: 150, dy: 90 })]);
  await wait(400);
  await shot('teczki-closed');
  await g((id) => window.__game.content.open(id), ids[0]);
  await wait(900);
  await shot('teczki-open');

  // ---- the six seals ----
  await stage(5);
  const seals = ['pilnosc', 'kontrola', 'argument', 'obieg', 'zwolnienie', 'wypoczynek'];
  for (let i = 0; i < 6; i++)
    await g(([seal, dist, dy]) => window.__game.content.put('pieczec', { seal, dist, dy }), [seals[i], (i % 3) * 110 - 110, i < 3 ? -150 : 115]);
  await wait(400);
  await shot('seals');
  // a stamp on the player: the buff's own stamp and footnote
  await g(() => {
    window.__game.state().player.suspended = false;
    window.__game.content.seal('pilnosc');
  });
  await wait(700);
  await shot('seal-stamp');

  // ---- the three events ----
  for (const ev of ['formularz', 'przesylka', 'audyt']) {
    await stage(7);
    await g((ev) => {
      const id = window.__game.content.put(ev, { dist: 140, dy: -30 });
      void id;
    }, ev);
    await wait(500);
    await shot(`event-${ev}-idle`);
    // started
    await g(() => {
      const s = window.__game.state();
      s.player.suspended = false;
      const z = window.__game.content.list().find((c) => c.event);
      window.__game.placePlayer(z.x, z.y);
    });
    await g(() => window.__game.advance(0.2));
    await wait(600);
    if (ev === 'formularz') {
      await g(() => {
        const h = window.__game;
        h.enemies.clear();
        h.advance(4.5);
      });
      await wait(500);
    }
    await shot(`event-${ev}-active`);
    if (ev !== 'przesylka') {
      await g((n) => window.__game.advance(n), ev === 'formularz' ? 6 : 15);
      await wait(700);
      await shot(`event-${ev}-done`);
    }
  }

  // landscape once: seals and a folder
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(500);
  await stage(5);
  await g(() => {
    window.__game.content.put('teczka', { dist: -150, dy: 0 });
    window.__game.content.put('pieczec', { seal: 'obieg', dist: 0, dy: -20 });
    window.__game.content.put('audyt', { dist: 160, dy: 20 });
  });
  await wait(500);
  await shot('landscape');
} catch (e) {
  problems.push(String(e));
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`shots in ${SHOTS}`);
