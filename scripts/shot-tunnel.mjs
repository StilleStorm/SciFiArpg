// Tunel serwisowy (DESIGN 2, 4.1): the Tunel note on the HUD in every layout, the hole, the base with the return line, the
// return into the very same run and the tape over the hole, plus the checks that go with them: the note is 44 x 44 and
// collides with nothing, walking in holds the run (same object, clock still), returning restores enemies and clock exactly,
// a second tunnel closes the first, dying closes it, and the Android back button (history) opens the pause sheet.
// Usage: SHOT_PORT=4188 SHOT_OUT=dist-tunnel SHOT_DIR=shots-tunnel vite build --outDir dist-tunnel && node scripts/shot-tunnel.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4188);
const OUT = process.env.SHOT_OUT ?? 'dist-tunnel';
const SHOTS = process.env.SHOT_DIR ?? 'shots-tunnel';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

mkdirSync(SHOTS, { recursive: true });
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

  /** One layout: viewport, file prefix, steering and handedness. */
  async function leg(prefix, viewport, { steering = null, lefty = false, full = true } = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      Math.random = () => 0.4242;
      Date.now = () => 1.75e12;
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
    const shot = (name, clip) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png`, ...(clip ? { clip } : {}) });
    if (steering) await page.evaluate((st) => window.__game.setSteering(st), steering);
    if (lefty) await page.evaluate(() => window.__game.setLeftHanded(true));

    await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
    await sleep(1800);
    await page.evaluate(() => {
      window.__game.hero.levelUp(); // the typed "aktualizacja dostepna" line hangs on the HUD: the Tunel note must not touch it
    });
    await sleep(400);

    // ---- the Tunel note: 44 x 44, on the screen, clear of everything, beside Pauza ----
    const boxes = await page.evaluate(() => {
      const r = (n) => {
        const b = n.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, name: n.className };
      };
      const visible = (n) => n.getClientRects().length > 0;
      return {
        tunnel: r(document.querySelector('.tunnel-btn')),
        pause: r(document.querySelector('.pause-btn')),
        others: [...document.querySelectorAll('.hud, .upd, .pad, .foot, .joy, .pause-btn')].filter(visible).map(r),
        view: { w: window.innerWidth, h: window.innerHeight },
      };
    });
    const b = boxes.tunnel;
    check(`${prefix}: the Tunel note is at least 44 x 44`, b.w >= 44 && b.h >= 44, `${b.w.toFixed(0)} x ${b.h.toFixed(0)}`);
    check(`${prefix}: the Tunel note is on the screen`, b.x >= 0 && b.y >= 0 && b.x + b.w <= boxes.view.w && b.y + b.h <= boxes.view.h);
    const hits = boxes.others.filter((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
    check(`${prefix}: the Tunel note touches no HUD, pad, update line, footnote or the Pauza note`, hits.length === 0, hits.map((o) => o.name).join(', '));
    check(`${prefix}: the Tunel note sits beside Pauza`, Math.abs(b.y - boxes.pause.y) < 2 && Math.abs(b.x - boxes.pause.x) >= 44, `dy ${(b.y - boxes.pause.y).toFixed(1)}, dx ${(b.x - boxes.pause.x).toFixed(1)}`);
    await shot('run');
    await page.evaluate(() => {
      const s = window.__game.state();
      s.hero.pendingLevels = 0;
      s.hero.updateRequested = false;
    });

    // ---- open: a hole at the feet, one step aside so it can be seen ----
    const before = await page.evaluate(() => {
      const s = window.__game.state();
      return { x: s.player.x, y: s.player.y };
    });
    await page.locator('.tunnel-btn').click();
    await sleep(900);
    const opened = await page.evaluate(() => {
      const s = window.__game.state();
      return { tunnel: s.tunnel ? { x: s.tunnel.x, y: s.tunnel.y, page: s.tunnel.pageIndex } : null, hole: document.querySelectorAll('#page .tn-hole').length, note: document.querySelector('#page .tn-hole text')?.textContent ?? '', foot: window.__game.notes().map((n) => n.text).join(' ') };
    });
    check(`${prefix}: tapping Tunel cuts a hole at the player's feet`, opened.tunnel !== null && Math.hypot(opened.tunnel.x - before.x, opened.tunnel.y - before.y) < 6 && opened.hole === 1, JSON.stringify(opened.tunnel));
    check(`${prefix}: the hole carries the note "c.d. na stronie __"`, opened.note === 'c.d. na stronie __', opened.note);
    check(`${prefix}: the Asystent notes the cut`, opened.foot.includes('Stronę przecięto'), opened.foot.slice(0, 60));
    // he does not fall in while standing on it
    await sleep(500);
    check(`${prefix}: standing on a fresh hole does not take the player in`, (await page.evaluate(() => window.__game.screen())) === 'run');
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      g.placePlayer(s.tunnel.x + 120, s.tunnel.y + 30);
    });
    await sleep(700);
    await shot('hole');
    const clip = await page.evaluate(() => {
      const r = document.querySelector('#page .tn-hole').getBoundingClientRect();
      const w = 190;
      const h = 130;
      return { x: Math.max(0, Math.round(r.left + r.width / 2 - w / 2)), y: Math.max(0, Math.round(r.top + r.height / 2 - h / 2)), width: w, height: h };
    });
    await shot('hole-close', clip);
    if (prefix === 'port') {
      await page.evaluate(() => window.__game.setTheme('night'));
      await sleep(300);
      await shot('hole-night');
      await page.evaluate(() => window.__game.setTheme('day'));
      await sleep(200);
    }

    if (!full) {
      await ctx.close();
      return;
    }

    // ---- a second tunnel closes the first with tape ----
    await page.evaluate(() => {
      const g = window.__game;
      g.placePlayer(g.state().tunnel.x + 130, g.state().tunnel.y + 40);
    });
    await page.locator('.tunnel-btn').click();
    await sleep(900);
    const second = await page.evaluate(() => ({ holes: document.querySelectorAll('#page .tn-hole').length, tapes: document.querySelectorAll('#page .tn-tape').length, has: !!window.__game.state().tunnel }));
    check(`${prefix}: a second tunnel tapes the first and leaves one open`, second.has && second.holes === 2 && second.tapes === 1, JSON.stringify(second));
    await shot('second');

    // ---- walk in on foot ----
    await page.evaluate(() => {
      window.__keep = window.__game.state();
      const g = window.__game;
      const s = g.state();
      g.placePlayer(s.tunnel.x + 80, s.tunnel.y - 10);
      g.enemies.spawnFamily('urzadzenia', 2);
      g.enemies.spawnFamily('powiadomienia', 1);
    });
    await sleep(300);
    await page.evaluate(() => {
      const s = window.__game.state();
      s.player.target = { x: s.tunnel.x, y: s.tunnel.y };
    });
    await sleep(1500);
    await page.evaluate(() => window.__game.station('biurko')); // the return line is on the desk sheet (the hole in the base is the other way back)
    await sleep(500);
    const held = await page.evaluate(() => {
      const g = window.__game;
      const cur = g.state();
      const s = window.__keep; // the held run waits in memory; the live state is the base page
      return {
        screen: g.screen(),
        same: s !== cur && cur.phase === 'base',
        status: s.status,
        time: s.time,
        page: s.pageIndex,
        enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]),
        player: [s.player.x, s.player.y],
        tunnel: s.tunnel ? [s.tunnel.x, s.tunnel.y] : null,
        meta: { bookmark: g.meta().bookmark ?? null, character: g.character() !== null },
        line: document.querySelector('.tunnel-wait')?.textContent ?? '',
        button: document.querySelector('.tunnel-return')?.textContent ?? '',
        resume: !!document.querySelector('.resume-btn:not(.tunnel-return)'),
        hud: document.querySelector('.hud')?.classList.contains('hidden') ?? null,
      };
    });
    check(`${prefix}: walking onto the hole takes the player to the base`, held.screen === 'baza' && held.status === 'paused', `${held.screen}, ${held.status}`);
    check(`${prefix}: the base offers "Wróć do zgłoszenia" and says where the ticket waits`, held.button === 'Wróć do zgłoszenia' && /^Zgłoszenie\snr\s\d+\sczeka na stronie\s\d+\.$/.test(held.line), held.line);
    check(`${prefix}: the character and a bookmark were saved on the way in`, held.meta.bookmark !== null && held.meta.character);
    check(`${prefix}: the base does not offer the bookmark of the same ticket twice`, held.resume === false);
    check(`${prefix}: the held run is still the same object`, held.same);
    await sleep(700);
    const stillHeld = await page.evaluate(() => {
      const s = window.__keep;
      return { time: s.time, enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]) };
    });
    check(`${prefix}: nothing moves while the player is in the base`, stillHeld.time === held.time && JSON.stringify(stillHeld.enemies) === JSON.stringify(held.enemies));
    await shot('baza-return');

    // ---- the same page, the same spot, enemies as they were, then the tape ----
    await page.locator('.tunnel-return').click();
    await sleep(1400);
    const back = await page.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      return {
        screen: g.screen(),
        same: window.__keep === s,
        status: s.status,
        time: s.time,
        page: s.pageIndex,
        enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]),
        player: [s.player.x, s.player.y],
        tunnel: s.tunnel ?? null,
        tapes: document.querySelectorAll('#page .tn-tape').length,
        struck: [...document.querySelectorAll('#page .tn-hole')].filter((h) => h.querySelector('path[style*="accent"]')).length,
        foot: window.__game.notes().map((n) => n.text).join(' '),
        hudHidden: document.querySelector('.hud')?.classList.contains('hidden') ?? null,
      };
    });
    check(`${prefix}: returning lands in the run screen with the same state object`, back.screen === 'run' && back.same && back.page === held.page, `${back.screen}, page ${back.page}`);
    check(`${prefix}: the player stands at the hole`, Math.hypot(back.player[0] - held.tunnel[0], back.player[1] - held.tunnel[1]) < 28, `${back.player.map((n) => n.toFixed(0))} vs ${held.tunnel}`);
    // the run has been running again for ~1.4 s: the ids are the same and (barring their walking) nobody was regenerated
    check(`${prefix}: the same enemy ids are present`, JSON.stringify(back.enemies.map((e) => e[0])) === JSON.stringify(held.enemies.map((e) => e[0])), `${back.enemies.length} enemies`);
    check(`${prefix}: the clock continued from where it stopped`, back.time >= held.time && back.time - held.time < 2.5, `${held.time.toFixed(2)} -> ${back.time.toFixed(2)}`);
    check(`${prefix}: the hole is taped and the tunnel is closed`, back.tunnel === null && back.tapes >= 1, `tapes ${back.tapes}`);
    check(`${prefix}: the note beside the hole is struck through`, back.struck >= 1, `struck ${back.struck}`);
    check(`${prefix}: the Asystent notes the repair`, back.foot.includes('Taśma nie jest przezroczysta'), back.foot.slice(-80));
    check(`${prefix}: the HUD is back`, back.hudHidden === false);
    await sleep(500);
    await shot('taped');
    const clip2 = await page.evaluate(() => {
      const tapes = [...document.querySelectorAll('#page .tn-tape')];
      const r = tapes[tapes.length - 1].getBoundingClientRect();
      const w = 200;
      const h = 140;
      return { x: Math.max(0, Math.round(r.left + r.width / 2 - w / 2)), y: Math.max(0, Math.round(r.top + r.height / 2 - h / 2)), width: w, height: h };
    });
    await shot('taped-close', clip2);

    // ---- dying closes the tunnel ----
    await page.evaluate(() => window.__game.openTunnel());
    await sleep(200);
    check(`${prefix}: a tunnel is open before the fall`, await page.evaluate(() => !!window.__game.state().tunnel));
    await page.evaluate(() => window.__game.hero.die('zgloszenie'));
    await sleep(300);
    check(`${prefix}: dying closes the tunnel`, await page.evaluate(() => window.__game.state()?.tunnel === undefined));
    await ctx.close();
  }

  await leg('port', { width: 390, height: 844 });
  await leg('port-joy', { width: 390, height: 844 }, { steering: 'joystick', full: false });
  await leg('land', { width: 844, height: 390 });
  await leg('land-lefty', { width: 844, height: 390 }, { lefty: true, full: false });
  await leg('port-lefty', { width: 390, height: 844 }, { steering: 'joystick', lefty: true, full: false });

  // ---- the back button and the held run's fate (one context) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      Math.random = () => 0.4242;
      Date.now = () => 1.75e12;
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror (back): ${e.message}`));
    page.on('console', (m) => {
      if (m.text().includes('Service Worker registration blocked')) return;
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (back): ${m.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    const screen = () => page.evaluate(() => window.__game.screen());
    const sheet = () => page.evaluate(() => !!document.querySelector('.pause-sheet'));

    await page.evaluate(() => window.__game.go('baza'));
    await sleep(300);
    // baza -> desk -> ticket -> back -> baza (the sheets over the base are one history entry)
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(300);
    await page.locator('.start:visible').click();
    await sleep(500);
    check('back: the ticket sheet is up', await page.evaluate(() => !!document.querySelector('.ticket-sheet')));
    await page.evaluate(() => history.back());
    await sleep(500);
    check('back: the back button closes the sheet and returns to the base page', (await screen()) === 'baza' && (await page.evaluate(() => !document.querySelector('.ps'))), await screen());
    // baza -> run: back opens the pause sheet, back again resumes, the run is never left
    await page.evaluate(() => window.__game.start(11, { pageCount: 4 }));
    await sleep(1200);
    await page.evaluate(() => history.back());
    await sleep(500);
    check('back: during a run the back button opens the pause sheet', (await screen()) === 'run' && (await sheet()));
    await page.evaluate(() => history.back());
    await sleep(500);
    check('back: pressed again it resumes the run', (await screen()) === 'run' && !(await sheet()) && (await page.evaluate(() => window.__game.state().status)) === 'running');
    await page.evaluate(() => history.back());
    await sleep(500);
    check('back: and once more it pauses again (the entry was put back)', (await screen()) === 'run' && (await sheet()));
    await page.locator('[data-pause=resume]').click();
    await sleep(300);

    // a held run is given up when a new ticket starts: bookmarked, character saved, the hole gone
    await page.evaluate(() => {
      const g = window.__game;
      g.openTunnel();
      const s = g.state();
      window.__keep = s; // the run that is held while the player is in the base
      g.placePlayer(s.tunnel.x + 80, s.tunnel.y);
    });
    await sleep(200);
    const walked = await page.evaluate(() => window.__game.enterTunnel());
    await sleep(500);
    check('held: the hook walks onto the hole and the base opens', walked && (await screen()) === 'baza');
    // resuming the bookmark from the base gives the held run up: the pages come from the seed again, the hole is gone
    const resumed = await page.evaluate(() => {
      const ok = window.__game.resumeTicket();
      return { ok };
    });
    await page.evaluate(() => window.__game.walkToExit());
    await sleep(2000);
    Object.assign(resumed, await page.evaluate(() => {
      const s = window.__game.state();
      return { screen: window.__game.screen(), seed: s.seed, same: s === window.__keep, tunnel: s.tunnel ?? null, bookmark: window.__game.meta().bookmark ?? null };
    }));
    check('held: resuming the bookmark gives the held run up (a new state, no tunnel, the bookmark kept)', resumed.ok && resumed.screen === 'run' && !resumed.same && resumed.tunnel === null && resumed.seed === 11 && resumed.bookmark?.seed === 11, JSON.stringify({ ...resumed, bookmark: resumed.bookmark?.seed }));
    // ... and so does starting a new ticket from the base
    await page.evaluate(() => {
      const g = window.__game;
      g.openTunnel();
      const s = g.state();
      window.__keep = s; // the run that is held while the player is in the base
      g.placePlayer(s.tunnel.x + 80, s.tunnel.y);
    });
    await sleep(200);
    await page.evaluate(() => window.__game.enterTunnel());
    await sleep(400);
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(300);
    await page.locator('.start:visible').click();
    await sleep(500);
    await page.locator('.start:visible').click();
    await sleep(1200);
    await page.evaluate(() => window.__game.walkToExit());
    await sleep(2000);
    const fresh = await page.evaluate(() => ({ screen: window.__game.screen(), same: window.__game.state() === window.__keep, tunnel: window.__game.state()?.tunnel ?? null }));
    check('held: starting a new ticket gives the held run up', fresh.screen === 'run' && !fresh.same && fresh.tunnel === null, JSON.stringify(fresh));
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
console.log(failed.length === 0 ? 'TUNNEL SHOTS PASSED' : `TUNNEL SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
