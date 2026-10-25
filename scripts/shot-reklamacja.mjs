// S18: the Reklamacja line in the Sklep, the base paczkomat with awizo cards, the bin form and its refusals, into SHOT_DIR.
// Usage: SHOT_PORT=4197 SHOT_OUT=dist-reklamacja SHOT_DIR=shots-reklamacja npx vite build --outDir dist-reklamacja && node scripts/shot-reklamacja.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4197);
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
  const click = (sel, nth = 0) => page.evaluate(([s, n]) => document.querySelectorAll(s)[n]?.dispatchEvent(new MouseEvent('click', { bubbles: true })), [sel, nth]);
  /** Every element of `sel` is at least 44 css px tall (DESIGN 3.3 tap targets); returns the failures. */
  const tapTargets = (sel) =>
    page.evaluate(
      (s) => [...document.querySelectorAll(s)].filter((b) => b.getBoundingClientRect().height < 44).map((b) => `tap target under 44 px: ${s} "${b.textContent}" ${b.getBoundingClientRect().height.toFixed(1)}`),
      sel,
    );
  const clickText = (sel, text) =>
    page.evaluate(([s, tx]) => [...document.querySelectorAll(s)].find((b) => b.textContent?.startsWith(tx))?.dispatchEvent(new MouseEvent('click', { bubbles: true })), [sel, text]);

  // the base of a planet, gear in the bag: a rzadki and a set piece to reclaim, a unique and a withdrawn item to be refused
  await page.evaluate(() => window.__game.startBase(7));
  await wait(1200);
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    s.player.gwiazdki = 340;
    g.giveItem('rzadki');
    g.giveItem('nietypowy');
    g.giveNamed({ set: 'serwis', piece: 1 });
    g.giveNamed({ unique: 'odmowa' });
    const bad = g.giveItem('rzadki');
    if (bad && !bad.affixes.includes('wycofany')) {
      bad.affixes.push('wycofany');
      g.renameItem(bad);
    }
  });

  // the Sklep with the Reklamacja line, then the form open
  await page.evaluate(() => window.__game.station('kiosk'));
  await wait(900);
  await page.evaluate(() => document.querySelector('.sk-rek')?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot('sklep-reklamacja-line');
  problems.push(...(await tapTargets('.sk-rek [data-rek="toggle"]')));
  await click('.sk-rek [data-rek="toggle"]');
  await wait(300);
  await page.evaluate(() => document.querySelector('.sk-rek')?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot('sklep-reklamacja-open');
  // one reclaim: the old line struck, the new typed under it
  await click('.sk-rek-row .ps-btn', 0);
  await wait(400);
  await page.evaluate(() => document.querySelector('.sk-rek')?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot('sklep-reklamacja-done');
  // the rows the kiosk refuses (the unique, the withdrawn one, the item just reclaimed on this planet): a reason, no button
  await page.evaluate(() => [...document.querySelectorAll('.sk-rek-row')].at(-1)?.scrollIntoView({ block: 'end' }));
  await wait(300);
  await shot('sklep-reklamacja-refused');
  problems.push(
    ...(await page.evaluate(() =>
      [...document.querySelectorAll('.sk-rek-row')]
        .filter((r) => r.querySelector('.ps-btn') && /Nie podlega|reklamowano już/.test(r.textContent ?? ''))
        .map((r) => `refused row with a Reklamuj button: ${r.querySelector('.sk-name')?.textContent}`),
    )),
  );
  await click('.ps-close');
  await wait(400);

  // the base paczkomat: three awizos, one from the Komisja
  await page.evaluate(() => {
    const g = window.__game;
    g.giveAwizo({ set: 'obieg', piece: 0 }, 0);
    g.giveAwizo({ unique: 'program95' }, 0);
    const k = g.giveAwizo({ tier: 'rzadki' }, 0);
    void k;
    const a = g.state().player.awizos;
    if (a?.[1]) a[1].age = 1;
    if (a?.[2]) a[2].komisja = true;
  });
  await page.evaluate(() => window.__game.station('paczkomat'));
  await wait(900);
  await shot('paczkomat-awizos');
  problems.push(...(await tapTargets('.awizo-actions .ps-btn')));
  await click('.awizo-actions .ps-btn', 0);
  await wait(400);
  await shot('paczkomat-picked');
  await click('.ps-close');
  await wait(400);

  // the bin: a rzadki asks once, a wycofany item is refused
  await page.evaluate(() => {
    window.__game.giveAwizo({ tier: 'rzadki' }, 3);
    window.__game.openInventory();
  });
  await wait(600);
  await page.evaluate(() => {
    // the first plate opens on its own; the rzadki of the Sklep line is "Ryc. 1."
    const plate = [...document.querySelectorAll('.inv-plate')].find((p) => p.textContent?.includes('Ryc. 1.'));
    if (plate && !plate.classList.contains('open')) plate.querySelector('.inv-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await clickText('.inv-actions .ps-btn', 'Do kosza');
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-ask')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('bin-ask');

  await clickText('.inv-ask .ps-btn', 'Potwierdzam');
  await wait(400);
  await shot('bin-done');
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.inv-row')];
    rows.find((r) => r.textContent?.includes('wycofan'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await clickText('.inv-actions .ps-btn', 'Do kosza');
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-actions')?.scrollIntoView({ block: 'center' }));
  await wait(300);
  await shot('bin-refused');
  // at 360 css the "Do kosza" button still sits on the row of Załóż / Wyrzuć
  await page.setViewportSize({ width: 360, height: 780 });
  await wait(300);
  const binRow = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.inv-plate.open .inv-actions .ps-btn')];
    return new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size;
  });
  if (binRow > 1) problems.push(`the item card buttons wrap at 360 css (${binRow} rows)`);
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(300);
  await page.evaluate(() => document.querySelector('.inv-h:last-of-type')?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot('inventory-awizo');
  await click('.ps-close');
  await wait(400);

  // landscape: the Sklep with the Reklamacja form open, and the base paczkomat
  await page.setViewportSize({ width: 844, height: 390 });
  await wait(500);
  await page.evaluate(() => window.__game.station('kiosk'));
  await wait(900);
  await click('.sk-rek [data-rek="toggle"]');
  await wait(300);
  await page.evaluate(() => document.querySelector('.sk-rek')?.scrollIntoView({ block: 'start' }));
  await wait(300);
  await shot('land-sklep-reklamacja');
  await click('.ps-close');
  await wait(400);
  await page.evaluate(() => window.__game.station('paczkomat'));
  await wait(900);
  await shot('land-paczkomat-awizos');
  problems.push(...(await tapTargets('.awizo-actions .ps-btn')));
  await click('.ps-close');
} finally {
  await browser?.close();
  stop();
}

if (problems.length) {
  console.error(problems.join('\n'));
} else {
  console.log(`S18 reklamacja and paczkomat shots written to ${SHOTS}/`);
}
process.exit(problems.length ? 1 : 0);
