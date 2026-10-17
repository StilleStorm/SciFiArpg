// Screenshots for the heroes: profile screens, each hero mid-skill, the update form, the three death forms.
// Usage: SHOT_PORT=4183 SHOT_OUT=dist-b3 SHOT_DIR=shots-b3 vite build --outDir dist-b3 && node scripts/shot-heroes.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4183);
const OUT = process.env.SHOT_OUT ?? 'dist-b3';
const SHOTS = process.env.SHOT_DIR ?? 'shots-b3';
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
  const heroes = ['pralka', 'konsultant', 'petlowiec', 'kartograf'];

  // ---- each hero alone, large (4x) ----
  const big = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 4, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  const bp = await big.newPage();
  await bp.goto(BASE, { waitUntil: 'load' });
  await bp.waitForFunction(() => window.__game !== undefined);
  await bp.evaluate(() => document.fonts.ready);
  for (const id of heroes) {
    await bp.evaluate((h) => window.__game.start(11, { heroId: h }), id);
    await bp.waitForTimeout(1300);
    await bp.evaluate(() => {
      const s = window.__game.state();
      s.enemies.length = 0;
    });
    await bp.waitForTimeout(500);
    if (id === 'pralka') await bp.screenshot({ path: `${SHOTS}/solo-full.png` });
    await bp.screenshot({ path: `${SHOTS}/hero-solo-${id}.png`, clip: { x: 125, y: 535, width: 140, height: 140 } });
  }
  await big.close();

  // ---- profile screens ----
  await page.evaluate(() => window.__game.hero.profile());
  await wait(900);
  for (const id of heroes) {
    await shot(`profile-${id}`);
    await page.click('.profile .nav .arrow:last-child');
    await wait(900);
  }
  await page.click('.profile .choose');
  await wait(200);

  // ---- every hero in the run, each skill ----
  const cluster = () =>
    page.evaluate(() => {
      const s = window.__game.state();
      s.enemies.forEach((e, i) => {
        e.x = s.player.x + 60 + (i % 3) * 26;
        e.y = s.player.y + ((i % 5) - 2) * 34;
        e.home = { x: e.x, y: e.y };
        e.mode = 'wander';
        e.hp = e.hpMax = 999;
      });
      s.player.hp = s.player.hpMax;
      return s.enemies.length;
    });
  for (const id of heroes) {
    await page.evaluate((h) => window.__game.start(11, { heroId: h }), id);
    await wait(1400);
    await page.evaluate(() => window.__game.placePlayer(600, 800));
    await page.evaluate(() => window.__game.hero.spawn(6));
    await wait(300);
    const n = await cluster();
    if (n < 3) problems.push(`only ${n} enemies for ${id}`);
    await wait(250);
    await shot(`hero-${id}-idle`);
    for (let slot = 1; slot <= 3; slot++) {
      await cluster();
      const ok = await page.evaluate((k) => window.__game.hero.cast(k), slot);
      if (!ok) problems.push(`${id}: skill ${slot} did not fire ${JSON.stringify(await page.evaluate(() => window.__game.hero.info()))}`);
      await wait(slot === 3 && id === 'petlowiec' ? 200 : 260);
      await shot(`hero-${id}-skill${slot}`);
      await wait(400);
    }
  }

  // ---- update form ----
  await page.evaluate(() => window.__game.start(21, { heroId: 'konsultant' }));
  await wait(1200);
  await page.evaluate(() => window.__game.hero.levelUp());
  await wait(1200);
  await shot('update-form');
  await page.evaluate(() => window.__game.hero.givePermission('powiadomienia'));
  await page.evaluate(() => window.__game.hero.report());
  await wait(1200);
  await shot('update-reroll');
  await page.evaluate(() => window.__game.hero.pickUpdate(0));
  await wait(300);
  await shot('update-stamp');
  await wait(1200);

  // ---- death forms ----
  for (const outcome of ['zgloszenie', 'petla', 'zawieszenie']) {
    await page.evaluate(() => window.__game.start(31, { heroId: 'pralka' }));
    await wait(1200);
    await page.evaluate((o) => window.__game.hero.die(o), outcome);
    await wait(outcome === 'zgloszenie' ? 2300 : 900);
    await shot(`death-${outcome}`);
    if (outcome === 'zgloszenie') {
      await wait(2000);
      await shot('death-zgloszenie-end');
    } else {
      await page.click('.sheet.slip .install');
      await wait(500);
      await shot(`death-${outcome}-after`);
    }
  }
} finally {
  await browser?.close();
  stop();
}

if (problems.length) console.error(problems.join('\n'));
else console.log(`shots written to ${SHOTS}/`);
process.exit(problems.length ? 1 : 0);
