// Screenshots of the finale look items (S27): the phase-3 beast, the Konsultant phase-2 bubbles, the Planeta and the update plate in landscape.
// Usage: SHOT_PORT=4192 SHOT_OUT=dist-fin SHOT_DIR=shots-fin node scripts/shot-finale-polish.mjs   (builds into SHOT_OUT, serves it with vite preview)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4192);
const OUT = process.env.SHOT_OUT ?? 'dist-fin';
const SHOTS = process.env.SHOT_DIR ?? 'shots-fin';
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
if (!process.env.SHOT_NOBUILD) {
  const b = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', OUT], { stdio: 'ignore' });
  if (b.status !== 0) throw new Error('build failed');
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));

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
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const wait = (ms) => page.waitForTimeout(ms);
  const g = (fn, arg) => page.evaluate(fn, arg);

  async function begin(hero, seed = 5) {
    await g(([h, sd]) => {
      window.__game.finale.start(h, { seed: sd, lawId: 'parzystosc' });
      const s = window.__game.state();
      s.player.hp = s.player.hpMax = 1e7;
    }, [hero, seed]);
    await wait(900);
  }
  /** Stand the hero in the lower part of the desk's neighbourhood so both fit the view. */
  const stand = () =>
    g(() => {
      const s = window.__game.state();
      const d = s.page.base.stations.find((x) => x.id === 'biurko');
      window.__game.placePlayer(d.x - 90, d.y + 150);
    });

  const settle = (ms) => wait(ms);
  async function face(hero, name, secs = 3, level = false) {
    await begin(hero, 5);
    if (level) await g(() => window.__game.hero.levelUp());
    await g(() => window.__game.finale.skipTo('face'));
    for (let i = 0; i < secs; i++) {
      await stand();
      await g(() => {
        const s = window.__game.state();
        s.player.hp = s.player.hpMax = 1e7;
        window.__game.advance(1);
      });
    }
    await stand();
    await settle(250);
    await shot(name);
  }
  // portrait
  await face('konsultant', 'p-konsultant-face-1s', 1);
  await face('konsultant', 'p-konsultant-face-6s', 6);
  await begin('nalesnik', 5);
  await g(() => window.__game.finale.skipTo('last'));
  await stand();
  await g(() => window.__game.advance(3));
  await settle(1500);
  await shot('p-phase3');
  // landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(500);
  await face('konsultant', 'l-konsultant-face-1s', 1, true);
  await face('konsultant', 'l-konsultant-face-6s', 6, true);
  await face('kartograf', 'l-kartograf-face', 3, true);
  await begin('nalesnik', 5);
  await g(() => window.__game.hero.levelUp());
  await g(() => window.__game.finale.skipTo('last'));
  await stand();
  await g(() => window.__game.advance(3));
  await settle(1500);
  await shot('l-phase3');
  // the endgame: the ticket form's case letter (the board's certificates are covered by src/world/certificates.test.ts only) (a case file closed at nine planets with seven extras)
  await page.setViewportSize({ width: 390, height: 844 });
  await g(() => window.__game.go('title'));
  await wait(500);
  await g(() => {
    const gm = window.__game;
    gm.start(49, { heroId: 'pralka' });
  });
  await wait(600);
  await g((n) => {
    const gm = window.__game;
    const a = JSON.parse(gm.exportArchive());
    const c = a.meta.characters.find((x) => x.id === a.meta.activeCharacterId) ?? a.meta.characters[0];
    c.character.campaign = { current: 0, closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], finalTicket: false, caseClosed: true, extras: n, cards: { opening: true, chapters: [0, 1, 2, 3, 4, 5, 6, 7, 8], finale: 9 } };
    delete c.bookmark;
    return gm.importArchive(JSON.stringify(a));
  }, 7);
  await wait(900);
  await page.locator('.desk-sheet .ps-close').first().click({ timeout: 1000 }).catch(() => undefined);
  await page.locator('.card-layer .card-skip').click({ timeout: 1500 }).catch(() => undefined);
  await wait(500);
  await g(() => window.__game.go('ticket'));
  await wait(900);
  await page.evaluate(() => document.querySelector('.tk-case')?.scrollIntoView());
  await wait(300);
  await shot('p-ticket-case');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('shots in', SHOTS);
