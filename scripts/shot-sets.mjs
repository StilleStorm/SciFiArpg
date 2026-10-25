// S17: set pieces and paragraph uniques on the ground and on the card (the paperclip, the bonus lines, the paragraph) into SHOT_DIR.
// Usage: SHOT_PORT=4196 SHOT_OUT=dist-sets SHOT_DIR=shots-sets npx vite build --outDir dist-sets && node scripts/shot-sets.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4173);
const OUT = process.env.SHOT_OUT ?? 'dist';
const SHOTS = process.env.SHOT_DIR ?? 'shots';
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
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
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

  await page.evaluate(() => window.__game.start(7));
  await wait(1200);

  // set pieces and a unique on the ground: the paperclip and the seal beside the tier marks of the others
  await page.evaluate(() => {
    const g = window.__game;
    g.giveNamed({ set: 'serwis', piece: 0 }, { ground: true });
    g.giveNamed({ set: 'obieg', piece: 1 }, { ground: true });
    g.giveNamed({ unique: 'program95' }, { ground: true });
    const s = g.state();
    const p = s.player;
    // out of reach of the hero, or he would pick them up on the spot
    const spots = [[-80, -80], [80, -80], [0, -120]];
    s.pickups.forEach((k, i) => {
      if (k.item) {
        k.x = p.x + (spots[i]?.[0] ?? 0);
        k.y = p.y + (spots[i]?.[1] ?? 0);
      }
    });
  });
  await page.evaluate(() => {
    window.__game.state().enemies.length = 0; // a quiet page: nothing to read over the plates
  });
  await wait(3500);
  await shot('sets-ground');
  await page.evaluate(() => window.__game.start(7));
  await wait(1000);

  // a fresh ticket: two pieces of «Obieg dokumentów» worn: the bonus lines, the first reached, the second not
  await page.evaluate(() => {
    const g = window.__game;
    g.giveNamed({ set: 'obieg', piece: 0 }, { wear: true });
    g.giveNamed({ set: 'obieg', piece: 1 }, { wear: true });
    g.giveNamed({ set: 'obieg', piece: 2 });
    g.openInventory();
  });
  await wait(500);
  await page.evaluate(() => document.querySelectorAll('.inv-slot')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);
  await page.evaluate(() => document.querySelector('.ps-scroll')?.scrollTo(0, 0)); // the slot icons stay in the frame
  await wait(300);
  await shot('sets-card-two');

  // the third piece in the bag: its card says two of three are worn
  await page.evaluate(() => document.querySelectorAll('.inv-row')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-set')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('sets-card-bag');

  // all three worn
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.inv-actions .ps-btn')].find((b) => b.textContent === 'Załóż');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(400);
  await page.evaluate(() => document.querySelector('.inv-set')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('sets-card-three');
  await page.evaluate(() => document.querySelector('.ps-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);

  // a unique with a paragraph, worn by the hero it concerns
  await page.evaluate(() => {
    const g = window.__game;
    g.giveNamed({ unique: 'program95' }, { wear: true });
    g.openInventory();
  });
  await wait(500);
  await page.evaluate(() => {
    const slots = document.querySelectorAll('.inv-slot');
    slots[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-para')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('sets-card-unique');
  await page.evaluate(() => window.__game.setTheme('night'));
  await wait(300);
  await shot('sets-card-unique-night');
  await page.evaluate(() => window.__game.setTheme('day'));
  await page.evaluate(() => document.querySelector('.ps-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);

  // the same unique for another hero: the card says so and the skill is not his
  await page.evaluate(() => window.__game.start(7, { heroId: 'konsultant' }));
  await wait(1200);
  await page.evaluate(() => {
    const g = window.__game;
    g.giveNamed({ unique: 'program95' }, { wear: true });
    g.openInventory();
  });
  await wait(500);
  await page.evaluate(() => document.querySelectorAll('.inv-slot')[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-para')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('sets-card-unique-other');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log(`S17 set and unique shots written to ${SHOTS}/`);
}
process.exit(problems.length ? 1 : 0);
