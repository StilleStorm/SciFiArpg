// Screenshots for S24 (akt2-enemies): the red "Sprawe wznowiono" card (portrait and landscape), an oddzwaniajacy elite struck and
// inked again, a dwuetapowy elite whose claim bracket reads 1/2 and then 2/2.
// Usage: SHOT_PORT=4187 SHOT_OUT=dist-akt2 SHOT_DIR=shots-akt2 npx vite build --outDir dist-akt2 && node scripts/shot-s24akt2.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4187);
const OUT = process.env.SHOT_OUT ?? 'dist-akt2';
const SHOTS = process.env.SHOT_DIR ?? 'shots-akt2';
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

/** A fresh case file in a viewport, past the opening page. */
async function caseFile(viewport, scale) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
    try {
      const patch = localStorage.getItem('__patch');
      const raw = localStorage.getItem('zgloszenie.meta');
      if (patch && raw) {
        const meta = JSON.parse(raw);
        const c = meta.characters.find((x) => x.id === meta.activeCharacterId) ?? meta.characters[0];
        c.character.campaign = JSON.parse(patch);
        delete c.bookmark;
        localStorage.setItem('zgloszenie.meta', JSON.stringify(meta));
        localStorage.removeItem('__patch');
      }
    } catch {
      /* the picture will show it */
    }
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
  await page.waitForTimeout(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
  await page.waitForTimeout(500);
  return { context, page };
}

const oldSave = { current: 0, closed: [0, 1, 2], finalTicket: false, caseClosed: true, extras: 0, cards: { opening: true, chapters: [0, 1, 2, -1, -2, -3], finale: true } };
/**
 * The save is rewritten to the old closed list and the game loaded again, as a player's next visit would: the base prints the red card
 * itself. The page writes its own save when it unloads, so the rewrite happens in the new document, before the game boots.
 */
async function intoCase(page) {
  await page.evaluate((camp) => localStorage.setItem('__patch', JSON.stringify(camp)), oldSave);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.waitForTimeout(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.waitForTimeout(900);
  if ((await page.evaluate(() => window.__game.screen())) === 'profile') await page.locator('[data-roster=open]').locator('visible=true').first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
}

try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });

  // ---- the reopened card, portrait and landscape ----
  for (const [name, vp, scale] of [
    ['reopened-portrait', { width: 390, height: 844 }, 2],
    ['reopened-landscape', { width: 844, height: 390 }, 2],
  ]) {
    const { context, page } = await caseFile(vp, scale);
    await intoCase(page);
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    await context.close();
  }

  // ---- the two affixes on planet 4 (portrait) ----
  const { context, page } = await caseFile({ width: 390, height: 844 }, 2);
  const g = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  async function stage(seed) {
    await g((s) => window.__game.start(s, { plan: { kind: 'campaign', planet: 3, priority: 'niski', lawId: 'godziny-konsultanta' }, pageCount: 3 }), seed);
    await wait(900);
    for (let k = 0; k < 3 && (await g(() => window.__game.state()?.modal ?? null)); k++) {
      await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
      await wait(400);
    }
    await g(() => {
      window.__game.placePlayer(600, 1000);
      window.__game.enemies.clear();
      window.__game.state().player.suspended = true;
      window.__game.state().player.level = 25; // a kill must not print the update form over the picture
    });
    await wait(600);
  }
  const place = () =>
    g(() => {
      const s = window.__game.state();
      s.enemies.forEach((e, i) => {
        e.x = s.player.x - 20 + i * 70;
        e.y = s.player.y - 170;
        e.home = { x: e.x, y: e.y };
      });
    });

  await stage(47);
  await g(() => {
    const h = window.__game;
    h.enemies.spawnFamily('urzadzenia', 1, { elite: 'dwuetapowy' });
    const e = h.state().enemies[0];
    e.hp = e.hpMax = 9999;
  });
  await place();
  await wait(1100);
  await page.screenshot({ path: `${SHOTS}/dwuetapowy-1of2.png` });
  await g(() => {
    const h = window.__game;
    const e = h.state().enemies[0];
    h.enemies.hit(e.id, e.claim.type, 5);
  });
  await wait(1100);
  await page.screenshot({ path: `${SHOTS}/dwuetapowy-2of2.png` });

  await stage(47);
  await g(() => window.__game.enemies.spawnFamily('urzadzenia', 1, { elite: 'oddzwaniajacy' }));
  await place();
  await wait(1100);
  await page.screenshot({ path: `${SHOTS}/oddzwaniajacy-1-alive.png` });
  await g(() => {
    const h = window.__game;
    h.enemies.hit(h.state().enemies[0].id, 'mechaniczny', 99999);
  });
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/oddzwaniajacy-2-struck.png` });
  await g(() => window.__game.advance(4.1));
  await wait(450);
  await page.screenshot({ path: `${SHOTS}/oddzwaniajacy-3-returning.png` });
  await wait(1100);
  await page.screenshot({ path: `${SHOTS}/oddzwaniajacy-4-back.png` });
  await context.close();
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('done');
