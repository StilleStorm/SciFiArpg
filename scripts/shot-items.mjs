// Renders the item screens (Załączniki, Sklep, loot on the ground) into SHOT_DIR.
// Usage: SHOT_PORT=4182 SHOT_OUT=dist-b2 SHOT_DIR=shots-b2 npx vite build --outDir dist-b2 && node scripts/shot-items.mjs
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

  // loot on the ground: the plates and a star, drawn into the margin
  await page.evaluate(() => {
    const g = window.__game;
    g.demoInventory();
    const s = g.state();
    const p = s.player;
    const items = [...p.inventory];
    items.forEach((item, i) => {
      s.pickups.push({ kind: 'pickup', id: 9000 + i, x: p.x - 90 + i * 36, y: p.y - 70 + (i % 2) * 34, r: 14, number: item.number, item });
    });
    s.pickups.push({ kind: 'pickup', id: 9100, x: p.x + 70, y: p.y + 60, r: 14, number: 0, gwiazdki: 2 });
    s.pickups.push({ kind: 'pickup', id: 9101, x: p.x - 60, y: p.y + 60, r: 14, number: 0, gwiazdki: 1 });
  });
  await wait(900);
  await shot('items-ground');

  // the sheet with six items; the first plate is open
  await page.evaluate(() => window.__game.openInventory());
  await wait(500);
  await shot('inventory');

  // a worn, niekompatybilny item: tap its slot
  await page.evaluate(() => {
    const slots = document.querySelectorAll('.inv-slot');
    slots[4]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await shot('inventory-blocked');

  // the unique and the liar in the bag
  await page.evaluate(() => {
    const rows = document.querySelectorAll('.inv-row');
    rows[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await page.evaluate(() => document.querySelector('.ps-scroll')?.scrollTo(0, 260));
  await wait(200);
  await shot('inventory-unique');

  await page.evaluate(() => {
    const rows = document.querySelectorAll('.inv-row');
    rows[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await page.evaluate(() => document.querySelector('.ps-scroll')?.scrollTo(0, 360));
  await wait(200);
  await shot('inventory-free');

  await page.evaluate(() => window.__game.setTheme('night'));
  await wait(300);
  await shot('inventory-night');
  await page.evaluate(() => window.__game.setTheme('day'));
  await page.evaluate(() => document.querySelector('.ps-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await wait(300);

  // Sklep
  await page.evaluate(() => window.__game.openSklep());
  await wait(500);
  await shot('sklep');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.sk-row .ps-btn');
    btns[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await shot('sklep-checkout');
  await page.evaluate(() => {
    document.querySelector('.sk-actions .ps-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await shot('sklep-bought');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log(`item shots written to ${SHOTS}/`);
}
process.exit(problems.length ? 1 : 0);
