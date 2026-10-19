// S6: roster, creation, archive with transfers, per-character progress. Drives the real buttons.
// Usage: SHOT_PORT=4186 SHOT_OUT=dist-s6 SHOT_DIR=shots-s6 vite build --outDir dist-s6 && node scripts/shot-s6.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4186);
const OUT = process.env.SHOT_OUT ?? 'dist-s6';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s6';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

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

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));
const problems = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const [prefix, viewport] of [['port', { width: 390, height: 844 }], ['land', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      Math.random = () => 0.4242;
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
    const noHScroll = async (label) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${prefix}: ${label}: no horizontal scroll`, w <= 0, String(w));
    };
    const screenName = () => page.evaluate(() => window.__game.screen());

    // ---- cover -> creation (no case file yet) ----
    await sleep(1800);
    await page.locator('.start', { hasText: 'Rozpocznij' }).click();
    await page.locator('.profile .choose').waitFor({ state: 'visible' });
    await sleep(900);
    const defaultName = await page.locator('[data-profile=name]').inputValue();
    check(`${prefix}: creation offers a generated case number`, /^\d{4}$/.test(defaultName), defaultName);
    await shot('create');
    await noHScroll('creation');
    // an empty number is refused with words, nothing is created
    await page.locator('[data-profile=name]').fill('');
    await page.locator('.profile .choose').click();
    const empty = await page.locator('.pf-note.bad').textContent();
    check(`${prefix}: an empty number is refused`, !!empty && empty.length > 5 && (await screenName()) === 'profile', empty ?? '');
    await shot('create-error');
    await page.locator('[data-profile=name]').fill('0042');
    await page.locator('.profile .choose').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    await sleep(900);
    check(`${prefix}: first case file opens the base`, (await page.evaluate(() => window.__game.meta().characters.length)) === 1);

    // ---- items into the bag, then the archive sheet from the desk ----
    await page.evaluate(() => {
      const g = window.__game;
      g.giveItem('zwykly');
      g.giveItem('rzadki');
      g.giveItem('nietypowy');
      g.setLevel(5);
    });
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(500);
    await shot('desk');
    await page.locator('[data-desk=archiwum]').click();
    await page.locator('.ar-sheet').waitFor();
    await sleep(300);
    await shot('archive');
    await noHScroll('archive');
    const counts = await page.evaluate(() => [...document.querySelectorAll('.ar-sec')].map((s) => `${s.dataset.place}:${s.querySelectorAll('.ar-cell:not(.empty)').length}`));
    check(`${prefix}: the archive shows the bag with 3 items`, counts.join(',') === 'bag:3,personal:0,shared:0', counts.join(','));
    // tap an item, then the destination
    const uid = await page.locator('.ar-sec[data-place=bag] .ar-cell:not(.empty)').first().getAttribute('data-uid');
    await page.locator('.ar-sec[data-place=bag] .ar-cell:not(.empty)').first().click();
    await sleep(200);
    await shot('archive-picked');
    check(`${prefix}: the bar offers the other two places`, (await page.locator('.ar-move').count()) === 2);
    await page.locator('.ar-move[data-to=shared]').click();
    await sleep(200);
    const after = await page.evaluate(() => [...document.querySelectorAll('.ar-sec')].map((s) => `${s.dataset.place}:${s.querySelectorAll('.ar-cell:not(.empty)').length}`));
    check(`${prefix}: item went to the shared archive`, after.join(',') === 'bag:2,personal:0,shared:1', after.join(','));
    // second item to the personal archive by tapping an empty box
    await page.locator('.ar-sec[data-place=bag] .ar-cell:not(.empty)').first().click();
    await page.locator('.ar-sec[data-place=personal] .ar-cell.target').first().click();
    await sleep(200);
    const after2 = await page.evaluate(() => [...document.querySelectorAll('.ar-sec')].map((s) => `${s.dataset.place}:${s.querySelectorAll('.ar-cell:not(.empty)').length}`));
    check(`${prefix}: item went to the personal archive by tapping a box`, after2.join(',') === 'bag:1,personal:1,shared:1', after2.join(','));
    await shot('archive-moved');
    const live = await page.evaluate(() => window.__game.state()?.player.inventory.length);
    check(`${prefix}: the live bag follows`, live === 1, String(live));
    await page.locator('.ar-sheet .ps-close').click();
    await sleep(300);
    check(`${prefix}: closing the archive shows the desk again`, (await page.locator('.desk-sheet:not(.hidden)').count()) === 1);

    // ---- roster from the desk, a second case file ----
    await page.locator('[data-desk=roster]').click();
    await page.locator('.roster .rs-case').first().waitFor();
    await sleep(300);
    await shot('roster-one');
    await noHScroll('roster');
    await page.locator('[data-roster=new]').click();
    await page.locator('.profile .choose').waitFor({ state: 'visible' });
    check(`${prefix}: a second file starts with another number`, (await page.locator('[data-profile=name]').inputValue()) !== '0042');
    await page.locator('[data-profile=name]').fill('0042');
    await page.locator('.profile .choose').click();
    check(`${prefix}: a taken number is refused`, ((await page.locator('.pf-note.bad').textContent()) ?? '').length > 5);
    await page.locator('.profile .arrow').last().click();
    await sleep(300);
    await page.locator('[data-profile=name]').fill('Pilne');
    await page.locator('.profile .choose').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    await sleep(900);
    const second = await page.evaluate(() => ({ hero: window.__game.meta().heroId, level: window.__game.meta().character?.level, n: window.__game.meta().characters.length, bag: window.__game.state()?.player.inventory.length }));
    check(`${prefix}: the second file is another hero at level 1 with an empty bag`, second.n === 2 && second.hero !== 'pralka' && second.level === 1 && second.bag === 0, JSON.stringify(second));
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(400);
    await page.locator('[data-desk=archiwum]').click();
    await page.locator('.ar-sheet').waitFor();
    const other = await page.evaluate(() => [...document.querySelectorAll('.ar-sec')].map((s) => `${s.dataset.place}:${s.querySelectorAll('.ar-cell:not(.empty)').length}`));
    check(`${prefix}: the other file sees the shared item and not the personal one`, other.join(',') === 'bag:0,personal:0,shared:1', other.join(','));
    // take the shared item into this bag
    await page.locator('.ar-sec[data-place=shared] .ar-cell:not(.empty)').first().click();
    await page.locator('.ar-move[data-to=bag]').click();
    await sleep(200);
    check(`${prefix}: the shared item is taken into the second bag`, (await page.evaluate(() => window.__game.state()?.player.inventory.length)) === 1);
    await page.locator('.ar-sheet .ps-close').click();
    await sleep(200);

    // ---- roster with two, switch back, separate progress ----
    await page.locator('[data-desk=roster]').click();
    await page.locator('.roster .rs-case').nth(1).waitFor();
    await sleep(300);
    await shot('roster-two');
    await noHScroll('roster of two');
    await page.locator('.rs-case[data-hero=pralka] [data-roster=open]').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    await sleep(900);
    const back = await page.evaluate(() => ({ hero: window.__game.meta().heroId, level: window.__game.meta().character?.level, bag: window.__game.state()?.player.inventory.length }));
    check(`${prefix}: the first file keeps its level and its bag`, back.hero === 'pralka' && back.level === 5 && back.bag === 1, JSON.stringify(back));

    // ---- Karta uprawnien of a file, then delete with the confirmation ----
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(400);
    await page.locator('[data-desk=roster]').click();
    await page.locator('.roster .rs-case').nth(1).waitFor();
    await page.locator('.rs-case:not([data-hero=pralka]) [data-roster=karta]').click();
    await page.locator('.kt-sheet').waitFor();
    await sleep(300);
    await shot('roster-karta');
    await page.locator('[data-karta=back]').click();
    await page.locator('.roster:not(.hidden)').waitFor();
    await page.locator('.rs-case:not([data-hero=pralka]) [data-roster=remove]').click();
    await page.locator('.pop').waitFor();
    await shot('roster-remove');
    await page.locator('.pop .link-btn').click();
    check(`${prefix}: cancelling keeps both files`, (await page.locator('.rs-case').count()) === 2);
    await page.locator('.rs-case:not([data-hero=pralka]) [data-roster=remove]').click();
    await page.locator('.pop .form-btn').click();
    await sleep(300);
    check(`${prefix}: confirming removes the file`, (await page.locator('.rs-case').count()) === 1);
    await shot('roster-after-delete');
    // the cover leads to the roster when there are files
    await page.locator('[data-roster=back]').click();
    await page.waitForFunction(() => window.__game.screen() === 'baza');
    check(`${prefix}: Wroc leads back to the base`, true);
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
for (const p of problems) console.log(`PROBLEM ${p}`);
if (failed > 0 || problems.length > 0) {
  console.log(`shot-s6: ${failed} failed, ${problems.length} problems`);
  process.exit(1);
}
console.log('shot-s6: all green');
