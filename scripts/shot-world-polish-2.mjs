// S28b world-polish-2 frames. Pick scenarios with ONLY=a,b (default all); both orientations (l-, p-).
// Usage: SHOT_PORT=4201 SHOT_OUT=dist-world-polish-2 SHOT_DIR=shots-world-polish-2 npx vite build --outDir dist-world-polish-2 && node scripts/shot-world-polish-2.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4201);
const OUT = process.env.SHOT_OUT ?? 'dist-world-polish-2';
const SHOTS = process.env.SHOT_DIR ?? 'shots-world-polish-2';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const want = (n) => ONLY.length === 0 || ONLY.includes(n);
const VIEWS = (process.env.VIEWS ?? 'l,p').split(',');

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
const campaign = (planet, lawId = 'grawitacja') => ({ kind: 'campaign', planet, priority: 'normalny', lawId });
let browser;

/** One fresh session: boot, pass the chapter card, start the run on `plan`, hand the helpers to `fn`. */
async function session(view, name, plan, opts, fn) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`${name}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error') problems.push(`${name}: console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);
  const wait = (ms) => page.waitForTimeout(ms);
  const g = (f, arg) => page.evaluate(f, arg);
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${view.tag}-${name}-${n}.png` });
  await wait(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('.card-layer').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
  await wait(400);
  await g(([o, p]) => window.__game.start(o.seed ?? 49, { pageCount: o.pageCount ?? 6, plan: p, ...(o.extra ?? {}) }), [opts, plan]);
  await wait(900);
  for (let k = 0; k < 4 && (await g(() => window.__game.state()?.modal ?? null)); k++) {
    await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
    await wait(400);
  }
  const dismiss = async () => {
    for (let k = 0; k < 6; k++) {
      if (await page.locator('.sheet:not(.hidden) .entry').first().isVisible().catch(() => false)) {
        await page.locator('.sheet:not(.hidden) .entry').first().click({ timeout: 2000 }).catch(() => undefined);
        await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 }).catch(() => undefined);
        await wait(300);
        await page.locator('.sheet.assigning:not(.hidden) .report.later').click({ timeout: 2000 }).catch(() => undefined);
      }
      await wait(300);
    }
  };
  const turn = async (n) => {
    await g((k) => { window.__game.state().enemies.length = 0; window.__game.turnTo(k); }, n);
    await page.waitForFunction((k) => window.__game.state()?.pageIndex === k && !window.__game.state().turning, n, { timeout: 6000 }).catch(() => undefined);
    await wait(500);
    await dismiss();
  };
  const quiet = () => g(() => { const h = window.__game; h.enemies.clear(); h.state().player.suspended = true; });
  const at = (x, y) => g(([px, py]) => window.__game.placePlayer(px, py), [x, y]);
  try {
    await fn({ page, g, wait, shot, turn, quiet, at, dismiss, view });
  } catch (e) {
    problems.push(`${name} (${view.tag}): ${e.message}`);
  }
  await context.close();
}

const answerSpor = (g) => g(() => { const h = window.__game; const info = h.spor.info(); if (info?.open && info.correct !== null) h.spor.answer(info.correct); });

try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });
  for (const view of [{ tag: 'l', width: 844, height: 390 }, { tag: 'p', width: 390, height: 844 }].filter((v) => VIEWS.includes(v.tag))) {
    // item 1: planet 9, the Wizualizacja under the HUD; the player pulls it to the page top
    if (want('p9')) {
      await session(view, 'p9', campaign(8, 'czas-wsteczny'), {}, async ({ g, wait, shot, turn }) => {
        await turn(5);
        await g(() => { window.__game.state().player.suspended = false; });
        await wait(1000);
        await answerSpor(g);
        await g(() => {
          const h = window.__game;
          const s = h.state();
          s.enemies = s.enemies.filter((e) => e.boss);
          h.placePlayer(s.enemies[0].x, 40);
        });
        await g(() => { const h = window.__game; for (let i = 0; i < 80; i++) { h.state().player.hp = h.state().player.hpMax; h.advance(0.1); } });
        await wait(600);
        console.log('p9 boss y after pull to the top:', await g(() => Math.round(window.__game.state().enemies[0].y)));
        await g(() => { const h = window.__game; const b = h.state().enemies[0]; h.placePlayer(b.x, b.y - 60); h.state().player.hp = h.state().player.hpMax; });
        await wait(300);
        await g(() => { const h = window.__game; const b = h.state().enemies[0]; b.y = 40; h.placePlayer(b.x, 60); h.advance(0.3); });
        console.log('p9 boss y after being set to 40:', await g(() => Math.round(window.__game.state().enemies[0].y)));
        await wait(500);
        await shot('top');
        await g(() => { const h = window.__game; h.state().player.attackTimer = 0; const info = h.spor.info(); h.spor.answer?.(info?.correct ?? 0); });
        await wait(700);
        await shot('stamp');
      });
    }
    // item 2: landscape. The clause header at the top centre, the pads at the corner exits and gate figures
    if (want('land')) {
      for (const [pl, lbl] of [[campaign(1), 'p2'], [campaign(5), 'p6'], [campaign(7, 'grawitacja'), 'p8']]) {
        await session(view, `land-${lbl}`, pl, { pageCount: 4 }, async ({ g, wait, shot, turn, quiet, at }) => {
          for (const n of [0, 1]) {
            await turn(n);
            await quiet();
            await at(600, 300);
            await wait(900);
            await shot(`pg${n + 1}-top`);
            if (process.env.DBG) console.log(await g(() => [...document.querySelectorAll('.t-head-top,.t-head')].map((n) => { const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right)].join(','); }).concat([JSON.stringify(document.querySelector('.hud')?.getBoundingClientRect())])));
            await g(() => {
              const h = window.__game;
              const e = h.state().page.exit;
              if (!e) return;
              const fx = e.corner[1] === 'l' ? 1 : -1;
              const fy = e.corner[0] === 't' ? 1 : -1;
              h.placePlayer(e.x + fx * 150, e.y + fy * 150);
            });
            await wait(900);
            await shot(`pg${n + 1}-exit`);
          }
        });
      }
    }
    // item 7: the archiwum reels (planet 6) and the biuro page 4 props (planet 4): find the pages by what they hold, then frame the prop
    if (want('arch')) {
      for (const [pl, lbl, ids] of [[campaign(5), 'p6', ['regal', 'szuflady', 'tuby-map']], [campaign(3), 'p4', ['formularze-stos', 'drzwi-windy', 'okno-slepe', 'sznur', 'stos-formularzy']]]) {
        await session(view, `arch-${lbl}`, pl, { pageCount: 6 }, async ({ g, wait, shot, turn, quiet, at }) => {
          for (let n = 0; n < 6; n++) {
            await turn(n);
            await quiet();
            const seen = await g((want) => {
              const h = window.__game;
              const all = h.state().page.obstacles.filter((q) => q.kind === 'prop');
              const hit = all.find((q) => want.includes(q.variant));
              if (hit) h.placePlayer(hit.x, hit.y + 150);
              return [all.map((q) => q.variant).join(','), hit ? hit.variant : null];
            }, ids);
            console.log(view.tag, lbl, 'page', n + 1, seen[0], '->', seen[1]);
            if (seen[1]) {
              await wait(900);
              await shot(`pg${n + 1}-${seen[1]}`);
            }
          }
        });
      }
    }
    // item 4: plate lettering (kiosk and stop plates on the base, item number plate on the ground), the clerk's label, REKLAMA in the slots
    if (want('plates')) {
      await session(view, 'plates', campaign(5), {}, async ({ g, wait, shot }) => {
        await g(() => window.__game.startBase(7));
        await wait(900);
        for (const id of ['kiosk', 'urzednik', 'przystanek', 'biurko']) {
          const ok = await g((sid) => {
            const h = window.__game;
            const st = h.state().page.base.stations.find((x) => x.id === sid);
            if (!st) return false;
            h.placePlayer(st.x, st.y + 90);
            return true;
          }, id);
          if (!ok) continue;
          await wait(900);
          await shot(`base-${id}`);
        }
        await g(() => { const h = window.__game; h.start(49, { pageCount: 3, plan: { kind: 'campaign', planet: 5, priority: 'normalny', lawId: 'grawitacja' } }); });
        await wait(900);
        await g(() => { const h = window.__game; h.enemies.clear(); h.state().player.suspended = true; for (const t of ['pospolity', 'rzadki', 'epicki']) h.giveItem(t); });
        await wait(900);
        await shot('ground');
        await g(() => { window.__game.demoInventory(); });
        await wait(900);
        await shot('inventory');
      });
    }
    // item 4: Odwirowanie: the dragged enemy is thrown on when the dash lets go
    if (want('odwir')) {
      await session(view, 'odwir', campaign(0), {}, async ({ g, wait, shot, quiet }) => {
        await wait(300);
        const info = await g(() => {
          const h = window.__game;
          const s = h.state();
          s.enemies = s.enemies.slice(0, 1);
          const e = s.enemies[0];
          if (!e) return null;
          h.placePlayer(e.x - 90, e.y);
          return { ex: e.x, ey: e.y, hero: s.hero?.id ?? null };
        });
        console.log('odwir', JSON.stringify(info));
        if (!info) return;
        await wait(500);
        await g(() => { const h = window.__game; const s = h.state(); const e = s.enemies[0]; e.rt.speedMul = 0; e.hp = e.hpMax; h.state().player.attackTimer = 1e6; const ok = h.aimCast(3, { kind: 'kierunek', dx: 1, dy: 0 }); console.log('cast', ok); });
        await wait(120);
        await shot('mid');
        await wait(700);
        await shot('after');
        console.log('odwir after', await g(() => { const s = window.__game.state(); return s.enemies[0] ? { x: Math.round(s.enemies[0].x), px: Math.round(s.player.x) } : null; }));
      });
    }
    // item 1: planet 8, the HIPOTEZA caption against the fence
    if (want('p8')) {
      await session(view, 'p8', campaign(7, 'grawitacja'), {}, async ({ g, wait, shot, turn }) => {
        await turn(5);
        await g(() => { window.__game.state().player.suspended = false; });
        await wait(1200);
        await g(() => { const h = window.__game; h.state().player.hp = h.state().player.hpMax; });
        await wait(1800);
        await shot('boss');
        await g(() => {
          const h = window.__game;
          const b = h.state().enemies.find((e) => e.boss);
          if (b) { b.rt.speedMul = 0; h.placePlayer(b.x, b.y + 140); }
        });
        await wait(900);
        await shot('boss-near');
      });
    }
  }
} finally {
  await browser?.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('shots in', SHOTS);
