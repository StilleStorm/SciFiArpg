// Screenshots of the finale (S15 anomalia-core): the struck page, phase 1 forms, phase 2 (the hero face), phase 3, the closing stamp.
// Usage: SHOT_PORT=4194 SHOT_OUT=dist-s15c SHOT_DIR=shots-s15c node scripts/shot-s15.mjs   (builds into SHOT_OUT, serves it with vite preview)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4194);
const OUT = process.env.SHOT_OUT ?? 'dist-s15c';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s15c';
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

  // 1. the struck page, first form, portrait
  await begin('konsultant');
  await stand();
  await g(() => window.__game.advance(0.3));
  await wait(600);
  await shot('finale-phase1-form1');
  console.log('info', JSON.stringify(await g(() => window.__game.finale.info())));

  // 1b. the Spor comment of phase 1 (after 1.5 s)
  await g(() => window.__game.advance(1.6));
  await wait(500);
  await shot('finale-phase1-spor');

  // 2. second form (the captcha)
  await g(() => {
    const e = window.__game.state().enemies[0];
    window.__game.enemies.hit(e.id, 'mechaniczny', 1e9);
    window.__game.advance(0.1);
  });
  await stand();
  await wait(1200);
  await shot('finale-phase1-form2');

  // 3. third form
  await g(() => {
    const e = window.__game.state().enemies[0];
    window.__game.enemies.hit(e.id, 'mechaniczny', 1e9);
    window.__game.advance(0.1);
  });
  await stand();
  await wait(1200);
  await shot('finale-phase1-form3');

  // 4. phase 2 with the real face
  await g(() => window.__game.finale.skipTo('face'));
  await stand();
  await g(() => window.__game.advance(2));
  await wait(1200);
  await shot('finale-phase2-konsultant');
  console.log('info', JSON.stringify(await g(() => window.__game.finale.info())));

  // 5. phase 3
  await g(() => window.__game.finale.skipTo('last'));
  await stand();
  await g(() => window.__game.advance(2));
  await wait(1200);
  await shot('finale-phase3');
  console.log('info', JSON.stringify(await g(() => window.__game.finale.info())));

  // 6. the closing stamp
  await g(() => window.__game.finale.skipTo('end'));
  await wait(450);
  await shot('finale-stamp');
  await wait(1400);
  await shot('finale-after-stamp');

  // 7. every hero's face mid-phase (integration: the face mechanic has ticked for a few seconds, the struck forms have faded)
  for (const hero of ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik']) {
    await begin(hero, 5);
    await g(() => window.__game.finale.skipTo('face'));
    // past the face's Spór comment (posted 1.5 s in, up for 12 s), the hero kept alive (a stat recompute resets the racja)
    for (let i = 0; i < 7; i++) {
      await stand();
      await g(() => {
        const s = window.__game.state();
        s.player.hp = s.player.hpMax = 1e7;
        window.__game.advance(2);
      });
    }
    await stand();
    await wait(2200);
    await shot(`finale-face-${hero}`);
  }

  // landscape, first form of another hero
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(400);
  await begin('nalesnik', 9);
  await stand();
  await g(() => window.__game.advance(0.3));
  await wait(800);
  await shot('finale-landscape-nalesnik');
  await g(() => window.__game.finale.skipTo('face'));
  await stand();
  await g(() => window.__game.advance(2));
  await wait(1000);
  await shot('finale-landscape-nalesnik-face');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('shots in', SHOTS);
