// S5: text size, damage numbers, the archive lines on the desk (export -> import round trip), the bug line in the pause sheet.
// Usage: SHOT_PORT=4185 SHOT_OUT=dist-s5 SHOT_DIR=shots-s5 vite build --outDir dist-s5 && node scripts/shot-s5.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4185);
const OUT = process.env.SHOT_OUT ?? 'dist-s5';
const SHOTS = process.env.SHOT_DIR ?? 'shots-s5';
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
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);
const problems = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const [prefix, viewport] of [['land', { width: 844, height: 390 }], ['port', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: 'block', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
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

    // ---- the desk and its archive lines ----
    await page.evaluate(() => {
      const g = window.__game;
      g.setMeta({ ...g.meta(), heroId: 'pralka', stamps: 5, runsCompleted: 4 });
      g.startBase(7);
    });
    await sleep(900);
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(500);
    await shot('desk');
    const lines = await page.evaluate(() => [...document.querySelectorAll('[data-desk=export],[data-desk=import]')].map((n) => n.textContent));
    check(`${prefix}: the desk has the two archive lines`, lines.length === 2, lines.join(' | '));

    // ---- export -> import: equality ----
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-desk=export]').click()]);
    const file = `${SHOTS}/${prefix}-archive.json`;
    await dl.saveAs(file);
    const archive = JSON.parse(readFileSync(file, 'utf8'));
    check(`${prefix}: the exported file carries kind, version and the save`, archive.kind === 'zgloszenie-archiwum' && archive.meta.heroId === 'pralka');
    const wanted = await page.evaluate(() => JSON.stringify(window.__game.meta()));
    archive.meta.stamps = 99; // a different save is imported, then the original is imported again
    const other = `${SHOTS}/${prefix}-archive-other.json`;
    writeFileSync(other, JSON.stringify(archive));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-desk=import]').click()]);
    await chooser.setFiles(other);
    await page.waitForSelector('.pop');
    await shot('import-confirm');
    const stillOld = await page.evaluate(() => window.__game.meta().stamps);
    check(`${prefix}: nothing is overwritten before the confirmation`, stillOld === 5, `stamps ${stillOld}`);
    await page.locator('.pop .form-btn').first().click();
    await sleep(500);
    check(`${prefix}: after confirming the save is the imported one`, (await page.evaluate(() => window.__game.meta().stamps)) === 99);
    await page.locator('[data-desk=import]').waitFor();
    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-desk=import]').click()]);
    await chooser2.setFiles(file);
    await page.waitForSelector('.pop');
    await page.locator('.pop .form-btn').first().click();
    await sleep(500);
    const back = await page.evaluate(() => JSON.stringify(window.__game.meta()));
    check(`${prefix}: export then import gives an equal save`, back === wanted);
    // a bad file and a newer file change nothing
    const bad = `${SHOTS}/${prefix}-bad.json`;
    writeFileSync(bad, '{"x":1}');
    const [chooser3] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-desk=import]').click()]);
    await chooser3.setFiles(bad);
    await sleep(400);
    check(`${prefix}: a foreign file opens no confirmation and changes nothing`, (await page.locator('.pop').count()) === 0 && (await page.evaluate(() => JSON.stringify(window.__game.meta()))) === wanted);
    await shot('desk-after');

    // ---- text size ----
    await page.evaluate(() => window.__game.start(11, { pageCount: 4, lawId: 'grawitacja' }));
    await sleep(1500);
    await page.evaluate(() => {
      const g = window.__game;
      g.footnote('Przypis próbny, który ma zająć dwa wiersze druku, aby można było ocenić wielkość czcionki.');
    });
    for (const step of [0, 1, 2]) {
      await page.evaluate((n) => window.__game.setSettings({ textSize: n }), step);
      await sleep(300);
      const ts = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim());
      check(`${prefix}: text size ${step} sets --ts`, ts === ['1', '1.15', '1.3'][step], ts);
      if (step !== 1) await shot(`text-${step}`);
    }
    await page.evaluate(() => window.__game.setSettings({ textSize: 0 }));

    // ---- damage numbers: off by default, on when asked ----
    const countNum = () => page.evaluate(() => [...document.querySelectorAll('.dmg')].filter((n) => n.style.opacity !== '0' && n.textContent).length);
    const hitOff = await page.evaluate(() => window.__game.hitEnemy());
    await sleep(150);
    check(`${prefix}: damage numbers are off by default`, hitOff && (await countNum()) === 0);
    await page.evaluate(() => window.__game.setSettings({ damageNumbers: true }));
    await page.evaluate(() => {
      window.__game.hitEnemy();
      window.__game.hitEnemy();
    });
    await sleep(250);
    check(`${prefix}: with the setting on a hit writes a number in the margin`, (await countNum()) >= 1);
    await shot('damage-on');
    const poolSize = await page.evaluate(() => document.querySelectorAll('.dmg').length);
    check(`${prefix}: the numbers come from a fixed pool`, poolSize === 10, String(poolSize));
    await page.evaluate(() => window.__game.setSettings({ damageNumbers: false }));

    // ---- the pause line: dump to the clipboard and a footnote ----
    await page.locator('.pause-btn').click();
    await sleep(500);
    await shot('pause-report');
    await page.locator('[data-pause=report]').click();
    await sleep(500);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const note = await page.evaluate(() => document.querySelector('.pause-sheet .ps-notes')?.textContent ?? '');
    check(`${prefix}: the dump is on the clipboard with version, hero, planet, page, settings, viewport, events`, ['version:', 'hero: pralka', 'planet:', 'page:', 'settings:', 'viewport:', 'events:'].every((k) => clip.includes(k)), clip.split('\n').length + ' lines');
    check(`${prefix}: a footnote confirms the copy`, note.includes('schowka'), note.slice(0, 60));
    await shot('pause-reported');
    // settings screen with the new groups
    await page.locator('[data-pause=settings]').click();
    await sleep(400);
    await shot('settings');
    await page.evaluate(() => {
      const sc = document.querySelector('.screen:not(.hidden) .set-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
    await sleep(200);
    await shot('settings-end');
    await page.locator('.screen:not(.hidden) .form-btn').click();
    await page.evaluate(() => window.__game.setSettings({ bugButton: false }));
    await sleep(200);
    await page.evaluate(() => {
      window.__game.resume();
      window.__game.pause();
    });
    await sleep(400);
    check(`${prefix}: the bug line can be hidden in the settings`, (await page.locator('[data-pause=report]').count()) === 0);
    await ctx.close();
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}
check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 400));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'S5 SHOTS PASSED' : `S5 SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
