// Scripted play-through of the built game in the bundled Chromium: real button clicks to get into a run,
// the test hook for fighting, then a boss, the end of the ticket, a death, and a frame-time measurement
// with 40 enemies. Usage: npm run smoke (builds first). Exits non-zero on page errors or a failed check.
// Pictures go to shots-smoke/. Env: SMOKE_PORT, SMOKE_OUT (build dir), SMOKE_DIR, PERF_MAX_MS (fail above this),
// SMOKE_UNCAPPED (measure without the 60 Hz limit).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SMOKE_PORT ?? 4191);
const OUT = process.env.SMOKE_OUT ?? 'dist';
const SHOTS = process.env.SMOKE_DIR ?? 'shots-smoke';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const log = (...a) => console.log(' ', ...a);

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

let browser;
try {
  await waitForServer(BASE);
  // SMOKE_UNCAPPED=1 lifts the 60 Hz limit so the frame time shows what a frame really costs.
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  // The only randomness outside the seeded run is the fresh seed of each ticket: pin it.
  await ctx.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => document.fonts.ready);

  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const screen = () => page.evaluate(() => window.__game.screen());
  const runState = () =>
    page.evaluate(() => {
      const s = window.__game.state();
      return s && { status: s.status, modal: s.modal, hp: s.player.hp, level: s.player.level, pending: s.hero.pendingLevels, kills: s.kills, page: s.pageIndex, pages: s.pageCount, victoryAt: s.victoryAt, boss: s.enemies.some((e) => e.boss) };
    });
  const clickText = async (txt) => {
    const el = page.locator('#ui').getByText(txt, { exact: false }).locator('visible=true').first();
    await el.click({ timeout: 5000 });
  };

  /**
   * The hung-controls bug: a sheet opened from a station (desk, notice board, Sklep, ticket) left the input off after it closed,
   * so no tap walked and the joystick never showed. For each steering mode and each sheet: open it with a real touch on the
   * station, close it with the real button, then a synthesized touch on the steering half must show the stick (joystick) or
   * walk there (tap), and the player must move.
   */
  async function controlsAfterSheets(p, pc, label) {
    const cd = await pc.newCDPSession(p);
    const tch = (type, x, y) => cd.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const vp = p.viewportSize();
    const stationScreen = (id) =>
      p.evaluate((sid) => {
        const st = window.__game.state().page.base.stations.find((x) => x.id === sid);
        const m = document.getElementById('stage').getScreenCTM();
        return { x: m.a * st.x + m.e, y: m.d * st.y + m.f };
      }, id);
    const standBy = async (id) => {
      await p.evaluate((sid) => {
        const g = window.__game;
        const st = g.state().page.base.stations.find((x) => x.id === sid);
        g.placePlayer(st.x, st.y + 110);
      }, id);
      await sleep(1300); // the camera follows
    };
    const tapStation = async (id) => {
      await standBy(id);
      const q = await stationScreen(id);
      await p.touchscreen.tap(q.x, q.y);
      await p.locator('.ps').first().waitFor({ state: 'visible', timeout: 3000 });
    };
    const openers = {
      biurko: () => tapStation('biurko'),
      tablica: () => tapStation('tablica'),
      kiosk: () => tapStation('kiosk'),
      ticket: async () => {
        await tapStation('biurko');
        await p.locator('#ui').getByText('Nowe zgłoszenie', { exact: false }).locator('visible=true').first().click({ timeout: 3000 });
        await p.locator('.ticket-sheet').waitFor({ state: 'visible', timeout: 3000 });
      },
    };
    const closeAll = async () => {
      for (let k = 0; k < 4 && (await p.locator('.ps').count()) > 0; k++) {
        await p.locator('.ps .ps-close').locator('visible=true').first().click({ timeout: 3000 });
        await sleep(250);
      }
    };
    const probe = async (mode) => {
      const st = await p.evaluate(() => {
        const s = window.__game.state();
        const m = document.getElementById('stage').getScreenCTM();
        return { x: s.player.x, y: s.player.y, sx: m.a * s.player.x + m.e, sy: m.d * s.player.y + m.f, status: s.status };
      });
      let joy = null;
      if (mode === 'joystick') {
        const sx = Math.round(vp.width * 0.2);
        const sy = Math.round(vp.height * 0.55);
        await tch('touchStart', sx, sy);
        await sleep(80);
        for (let i = 1; i <= 4; i++) {
          await tch('touchMove', sx + i * 10, sy + i * 8);
          await sleep(50);
        }
        joy = await p.evaluate(() => !document.querySelector('.joy').classList.contains('hidden'));
        await sleep(500);
        await tch('touchEnd', 0, 0);
      } else {
        await p.touchscreen.tap(st.sx, st.sy + 80);
        await sleep(900);
      }
      const after = await p.evaluate(() => {
        const s = window.__game.state();
        return { x: s.player.x, y: s.player.y, status: s.status };
      });
      return { joy, moved: Math.hypot(after.x - st.x, after.y - st.y), status: after.status };
    };
    for (const mode of ['tap', 'joystick']) {
      await p.evaluate((m) => window.__game.setSteering(m), mode);
      for (const kind of ['biurko', 'tablica', 'kiosk', 'ticket']) {
        await p.evaluate(() => window.__game.startBase());
        await sleep(600);
        let r = { error: '' };
        try {
          await openers[kind]();
          await closeAll();
          await sleep(300);
          r = await probe(mode);
        } catch (e) {
          r = { error: String(e).slice(0, 120) };
        }
        check(`${label}: ${mode}: after the ${kind} sheet closes the controls answer (${mode === 'joystick' ? 'the stick shows, ' : ''}the player moves)`, !r.error && r.status === 'running' && r.moved > 8 && (mode !== 'joystick' || r.joy === true), JSON.stringify(r));
      }
    }
  }

  /** One quick tap on the Pauza note opens the pause sheet and it stays open; the next tap (Wznów) closes it (no ghost click on the sheet). */
  async function pauseTap(p, label) {
    const box = await p.locator('.hud .pause-btn').boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(600);
    const open = await p.evaluate(() => ({ sheet: !!document.querySelector('.pause-sheet:not(.hidden)'), settings: !!document.querySelector('.set-grid'), status: window.__game.state().status }));
    check(`${label}: one quick tap on Pauza opens the pause sheet and it stays open`, open.sheet && !open.settings && open.status === 'paused', JSON.stringify(open));
    const rb = await p.locator('[data-pause=resume]').boundingBox();
    await p.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await sleep(500);
    const shut = await p.evaluate(() => ({ sheet: !!document.querySelector('.pause-sheet'), status: window.__game.state().status }));
    check(`${label}: the next tap (Wznów) closes it and the game runs on`, !shut.sheet && shut.status === 'running', JSON.stringify(shut));
  }

  /** Tunel and Pauza: the whole 44 x 44 px around each answers a tap (nothing laid over them, the update note included). */
  async function hitAreas(label) {
  const hits = await page.evaluate(() =>
    ['.hud .tunnel-btn', '.hud .pause-btn'].map((sel) => {
      const b = document.querySelector(sel);
      if (!b) return { sel, missing: true };
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pts = [[0, 0], [-21, -21], [21, -21], [-21, 21], [21, 21], [-21, 0], [21, 0], [0, -21], [0, 21]];
      const miss = pts.filter(([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy)?.closest(sel) !== b).length;
      return { sel, w: Math.round(r.width), h: Math.round(r.height), miss };
    }),
  );
  check(`${label}: Tunel and Pauza answer a tap anywhere in 44 x 44 px around them`, hits.every((h) => !h.missing && h.miss === 0), JSON.stringify(hits));
  }

  /** Take whatever holds the run: a law sheet, the update form (opened from the HUD line). Returns how many things it closed. */
  async function settle() {
    let closed = 0;
    for (let k = 0; k < 8; k++) {
      const st = await runState();
      if (!st) return closed;
      const later = page.locator('.sheet.assigning:not(.hidden) .report.later');
      if (await later.isVisible().catch(() => false)) {
        // a new skill was installed: the form asks which pad gets it; "Później" leaves the pads as they are
        await later.click({ timeout: 2000 });
        await sleep(300);
        closed++;
        continue;
      }
      const form = page.locator('.sheet:not(.hidden) .entry').first();
      if (await form.isVisible().catch(() => false)) {
        const open = page.locator('.sheet:not(.hidden) .entry:not(.locked)').first();
        await open.click({ timeout: 2000 });
        await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 });
        await sleep(1300); // the stamp lands, then the form closes
        closed++;
        continue;
      }
      if (st.modal) {
        const btn = page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first();
        await btn.click({ timeout: 2000 }).catch(() => undefined);
        await sleep(400);
        closed++;
        continue;
      }
      const upd = page.locator('.hud .upd');
      if (st.status === 'running' && st.pending > 0 && !st.boss && st.victoryAt === null && (await upd.isVisible().catch(() => false))) {
        await upd.click({ timeout: 2000 }).catch(() => undefined); // the typed "aktualizacja dostepna" line under Reputacja
        await sleep(600);
        continue;
      }
      return closed;
    }
    return closed;
  }

  // ---------- 1. into a run through the real buttons ----------
  await sleep(1500);
  await clickText('Rozpocznij');
  await sleep(600);
  if ((await screen()) === 'profile') {
    await shot('01-profile');
    await page.locator('button.choose').locator('visible=true').first().click();
    await sleep(600);
  }
  await shot('02-base');
  const baseSt = await page.evaluate(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), phase: s.phase, enemies: s.enemies.length, time: s.time, locked: !s.base.accepted, layout: s.base.layout };
  });
  check('after the profile the walkable base page is up: no enemies, the clock still, the exit locked', baseSt.screen === 'baza' && baseSt.phase === 'base' && baseSt.enemies === 0 && baseSt.time === 0 && baseSt.locked, JSON.stringify(baseSt));
  const lockedTurn = await page.evaluate(() => window.__game.walkToExit());
  check('walking into the locked exit does not turn the page', lockedTurn === false && (await page.evaluate(() => window.__game.state().phase)) === 'base');
  const place = await page.evaluate(() => {
    const v = document.querySelector('.hud .field.place .val');
    const b = v?.parentElement;
    return { label: v?.closest('.field')?.querySelector('label')?.textContent ?? '', text: v?.textContent ?? '', fits: !!b && b.scrollWidth <= b.clientWidth + 1 };
  });
  check('the HUD names the base and the kind of place, and the word fits its blank', place.label === 'Baza' && /^(lądowisko|wioska|miasteczko)$/.test(place.text) && place.fits, JSON.stringify(place));
  // the walk cycle runs on the base page too (the base has no clock: the figures animate on the render clock)
  const baseWalk = await page.evaluate(async () => {
    const g = window.__game;
    const s = g.state();
    g.placePlayer(s.page.w / 2, s.page.h / 2);
    s.player.target = { x: s.page.w / 2 + 320, y: s.page.h / 2 };
    const phases = new Set();
    const legs = new Set();
    let moving = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 1000) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const f = document.querySelector('#world > g[data-kind="player"]');
      if (!f) continue;
      phases.add(f.dataset.phase);
      legs.add([...f.querySelectorAll('[data-leg]')].map((l) => l.getAttribute('d')).join('|'));
      moving = moving || s.player.moving;
    }
    return { phases: [...phases], legs: legs.size, moving, time: s.time };
  });
  check('base: the walk cycle runs while the player walks (legs alternate, the base clock stays at 0)', baseWalk.moving && baseWalk.phases.length === 2 && baseWalk.legs >= 2 && baseWalk.time === 0, JSON.stringify(baseWalk));
  // the wall of the base page: the "margines" note is written inside the base page (900 x 700), beside the player
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.placePlayer(s.page.w - s.page.inset - 40, s.page.h / 2);
    s.player.target = { x: s.page.w + 300, y: s.page.h / 2 };
  });
  await sleep(700);
  const edgeNote = await page.evaluate(() => {
    const s = window.__game.state();
    const xs = [...document.querySelectorAll('#fx text.t-note')].map((n) => Number(n.getAttribute('x')));
    return { xs, w: s.page.w, inset: s.page.inset };
  });
  check('the base page\'s wall writes the margin note inside the base page', edgeNote.xs.some((x) => x > edgeNote.w / 2 && x < edgeNote.w - edgeNote.inset), JSON.stringify(edgeNote));
  // a queued update opens from the HUD line in the base, and the pads cool down there (skills are not cast in the base)
  await page.evaluate(() => {
    const s = window.__game.state();
    s.hero.pendingLevels = 1;
    s.hero.cd[0] = 0.8;
  });
  await sleep(300);
  await page.locator('.hud .upd').click({ timeout: 3000 }).catch(() => undefined);
  const baseUpd = await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
  check('in the base a queued update opens from the HUD line', baseUpd);
  await shot('02a-base-update');
  await settle();
  await sleep(900);
  const baseHero = await page.evaluate(() => {
    const s = window.__game.state();
    window.__game.hero.cast(1);
    return { pending: s.hero.pendingLevels, cd0: s.hero.cd[0], cd1: s.hero.cd[1], status: s.status, phase: s.phase };
  });
  check('the update installs in the base, the pads cool down and a pad does nothing there', baseHero.pending === 0 && baseHero.cd0 === 0 && baseHero.cd1 === 0 && baseHero.status === 'running' && baseHero.phase === 'base', JSON.stringify(baseHero));
  // the base page: controls after every sheet of a station, and a single quick tap on Pauza (portrait)
  await page.evaluate(() => window.__game.startBase());
  await sleep(600);
  await pauseTap(page, 'portrait base');
  await controlsAfterSheets(page, ctx, 'portrait base');
  // a real tap on the desk: the desk sheet opens at once
  await page.evaluate(() => window.__game.setSteering('tap'));
  await page.evaluate(() => window.__game.startBase());
  await sleep(900);
  const desk = await page.evaluate(() => {
    const s = window.__game.state();
    const st = s.page.base.stations.find((x) => x.id === 'biurko');
    const m = document.getElementById('stage').getScreenCTM();
    return { x: m.a * st.x + m.e, y: m.d * st.y + m.f };
  });
  await page.touchscreen.tap(desk.x, desk.y);
  await page.waitForFunction(() => document.querySelector('.desk-sheet') !== null, null, { timeout: 12000 }).catch(() => undefined);
  check('tapping the desk opens its sheet at once', await page.evaluate(() => document.querySelector('.desk-sheet') !== null));
  await sleep(500);
  await shot('02b-desk');
  // Konfiguracja from the desk (S2): over the hidden desk sheet; Wróć shows the desk again
  await page.locator('[data-desk=konfiguracja]').click({ timeout: 3000 });
  await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
  const kfDesk = await page.evaluate(() => ({ rows: document.querySelectorAll('.kf-sheet .kf-row').length, desk: !!document.querySelector('.desk-sheet:not(.hidden)'), stamps: document.querySelectorAll('.kf-sheet .kf-box.active .kf-stamp').length }));
  check('the desk line "Konfiguracja" opens the sheet over the hidden desk, § 1 stamped on the installed skills', kfDesk.rows === 5 && !kfDesk.desk && kfDesk.stamps >= 3, JSON.stringify(kfDesk));
  await page.locator('.kf-back').click({ timeout: 3000 });
  await sleep(300);
  check('Wróć from Konfiguracja shows the desk again', await page.evaluate(() => !document.querySelector('.kf-sheet') && !!document.querySelector('.desk-sheet:not(.hidden)')));
  await clickText('Nowe zgłoszenie');
  await sleep(600);
  await shot('03-ticket');
  await clickText('Akceptuję regulamin');
  await sleep(1800);
  await shot('03b-base-unlocked');
  check('accepting the ticket unlocks the exit and keeps the player in the base', (await screen()) === 'baza' && (await page.evaluate(() => window.__game.state().base.accepted)));
  const headerFits = (sel) =>
    page.evaluate((q) => {
      const lines = [...document.querySelectorAll(q)];
      const out = lines.filter((n) => {
        const r = n.getBoundingClientRect();
        return r.left < -1 || r.right > window.innerWidth + 1;
      });
      return { lines: lines.length, outside: out.length };
    }, sel);
  const bh = await headerFits('#page .base-header text.t-head');
  check('portrait: the clause header of the base is set inside the screen, two lines at most', bh.lines >= 1 && bh.lines <= 2 && bh.outside === 0, JSON.stringify(bh));
  const notesInBase = await page.evaluate(() => window.__game.notes());
  await page.evaluate(() => window.__game.walkToExit());
  await sleep(1800);
  check('reached the run through the real buttons and the exit of the base', (await screen()) === 'run' && (await page.evaluate(() => window.__game.state().phase)) === 'run');
  await shot('04-run-start');
  const rh = await headerFits('#page text.t-head');
  check('portrait: the clause header of the first page is set inside the screen, two lines at most', rh.lines >= 1 && rh.lines <= 2 && rh.outside === 0, JSON.stringify(rh));
  // the margin-note row (Potw., Tunel, Pauza) is measured from the DOM: the header at the page top, the claim bubbles and the
  // stamps keep out from under it and from under the pads
  const startAt = await page.evaluate(() => ({ x: window.__game.state().player.x, y: window.__game.state().player.y }));
  await page.evaluate(() => window.__game.placePlayer(600, 90));
  await sleep(1600);
  const clear = await page.evaluate(() => {
    const box = (n) => n.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const row = [...document.querySelectorAll('.pause-btn, .tunnel-btn, .potw-btn')].map(box).filter((r) => r.width > 0);
    const furniture = [...row, ...[...document.querySelectorAll('#ui .pad')].map(box).filter((r) => r.width > 0)];
    const head = [...document.querySelectorAll('#page text.t-head, #page text.t-head-top')].map((n) => {
      const r = box(n);
      // the glyphs, not the line box: about the font size above the baseline
      const size = parseFloat(getComputedStyle(n).fontSize) * (r.height / (n.getBBox().height || 1));
      return { left: r.left, right: r.right, bottom: r.bottom, top: r.bottom - size };
    });
    const bubbles = [...document.querySelectorAll('#world .bubble:not(.bubble-off)')].map(box).filter((r) => r.width > 0);
    return {
      row: row.length,
      headUnder: head.filter((h) => row.some((r) => hit(h, r))).length,
      head: head.length,
      bubbles: bubbles.length,
      bubblesUnder: bubbles.filter((b) => furniture.some((r) => hit(b, r))).length,
      measured: window.__game.keepOut()?.row !== null,
    };
  });
  check('the page header at the top of the page is clear of the Potw./Tunel/Pauza row (measured from the DOM)', clear.row === 3 && clear.head >= 2 && clear.headUnder === 0 && clear.measured, JSON.stringify(clear));
  check('no claim bubble shown under a pad or a margin note', clear.bubblesUnder === 0, JSON.stringify(clear));
  await page.evaluate((p) => window.__game.placePlayer(p.x, p.y), startAt);
  await sleep(600);
  const notesInRun = await page.evaluate(() => window.__game.notes());
  const lastBase = notesInBase.at(-1);
  const kept = lastBase !== undefined && notesInRun.some((n) => n.n === lastBase.n && n.text === lastBase.text);
  const ascending = notesInRun.every((n, i) => i === 0 || n.n === notesInRun[i - 1].n + 1);
  check('the footnotes run on from the base into the run (one numbering per ticket)', kept && ascending && notesInRun.length > notesInBase.length, `base ${notesInBase.length} notes, run ${notesInRun.length}, last ${notesInRun.at(-1)?.n}`);
  // sound: the real button clicks unlocked the context, the music started with the run (menus had none)
  const ctxState = await page.evaluate(() => window.__game.audio.contextState());
  check('the audio context was unlocked by the real clicks', ctxState === 'running', ctxState);
  await sleep(2500);
  const music = await page.evaluate(() => window.__game.audio.music());
  check('music is playing during the run', music !== null && music.bars >= 1, music ? `${music.id} ${music.bpm} bpm ${music.scale}, bars ${music.bars}` : 'none');
  await settle();

  // ---------- 2. walk, fight, kill ----------
  const k0 = (await runState())?.kills ?? 0;
  for (let i = 0; i < 12; i++) {
    await page.touchscreen.tap(120 + (i % 3) * 80, 300 + (i % 4) * 90);
    await sleep(500);
    await page.evaluate(() => window.__game.hitEnemy());
    if (i % 2) await page.evaluate(() => window.__game.killEnemy());
    if (i % 4 === 0) await page.locator('.pad.s1').click({ timeout: 800 }).catch(() => undefined);
    await settle();
  }
  const afterFight = await runState();
  check('at least one kill', (afterFight?.kills ?? 0) > k0, `kills ${afterFight?.kills}`);
  const music2 = await page.evaluate(() => window.__game.audio.music());
  check('the music kept going through the fight', music2 !== null && music2.bars > (music?.bars ?? 0), music2 ? `bars ${music2.bars}` : 'none');
  await shot('05-fight');

  // ---------- 3. the deferred update: HUD line, tap, form, install ----------
  await settle();
  await page.evaluate(() => {
    const s = window.__game.state();
    if (s) s.enemies.length = 0;
  });
  const before = await runState();
  await page.evaluate(() => window.__game.hero.levelUp());
  const queued = await runState();
  check('a level up queues the update and does not open the form', queued?.status === 'running' && queued.pending > (before?.pending ?? 0), `pending ${queued?.pending}`);
  await sleep(250);
  check('the HUD shows the "aktualizacja dostepna" line', await page.locator('.hud .upd').isVisible());
  // the update line never lies under a pad or a margin note, in every arrangement (the left-handed portrait with the
  // joystick hangs the Załączniki pad under the HUD on the left, where the line hung)
  const updClear = [];
  const settings0 = await page.evaluate(() => ({ ...window.__game.meta().settings }));
  for (const [steer, lefty] of [['tap', false], ['tap', true], ['joystick', false], ['joystick', true]]) {
    await page.evaluate(([st, l]) => {
      window.__game.setSteering(st);
      window.__game.setLeftHanded(l);
    }, [steer, lefty]);
    await sleep(120);
    updClear.push(
      await page.evaluate((label) => {
        const u = document.querySelector('.hud .upd').getBoundingClientRect();
        const hit = (b) => b.width > 0 && u.left < b.right && u.right > b.left && u.top < b.bottom && u.bottom > b.top;
        const under = [...document.querySelectorAll('#ui .pad, .pause-btn, .tunnel-btn, .potw-btn')].filter((n) => hit(n.getBoundingClientRect()));
        return { label, under: under.map((n) => n.className), onScreen: u.left >= 0 && u.right <= window.innerWidth };
      }, `${steer}${lefty ? '-lefty' : ''}`),
    );
  }
  await page.evaluate((st) => window.__game.setSettings({ ...st, steeringTouched: st.steeringTouched === true }), settings0);
  check('the "aktualizacja dostepna" line is clear of the pads and notes in portrait, tap and joystick, both hands', updClear.every((u) => u.under.length === 0 && u.onScreen), JSON.stringify(updClear));
  await shot('06-update-available');
  await page.locator('.hud .upd').click();
  await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(500);
  await shot('07-update-form');
  const closedForms = await settle();
  const afterUpdate = await runState();
  check('the update form closes after installing', closedForms > 0 && afterUpdate?.status === 'running' && afterUpdate.pending === 0, `status ${afterUpdate?.status}, pending ${afterUpdate?.pending}`);

  // ---------- 3b. the fourth and fifth skill (DESIGN 10.1): installed by the update, put on a pad, moved in the loadout ----------
  await settle();
  // the real path first: a permission, a level, the offer with skill 4, its entry and Zainstaluj; the form goes on to the assign step
  const fam = await page.evaluate(() => {
    const g = window.__game;
    g.enemies.clear();
    for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) g.hero.givePermission(f);
    return g.hero.info().ranks[3];
  });
  let viaForm = false;
  for (let k = 0; k < 12 && fam === 0 && !viaForm; k++) {
    await page.evaluate(() => {
      window.__game.hero.levelUp();
      window.__game.hero.requestUpdate();
    });
    await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
    const offer = (await page.evaluate(() => window.__game.hero.info().offer)) ?? [];
    const want = offer.indexOf('skill4');
    const idx = want >= 0 ? want : Math.max(0, offer.findIndex((id) => id !== 'skill5'));
    await page.locator('.sheet:not(.hidden) .entry').nth(idx).click({ timeout: 2000 });
    await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 });
    await page.waitForFunction(() => !document.querySelector('.sheet:not(.hidden):not(.assigning) .entry.picked'), null, { timeout: 5000 });
    await sleep(200);
    if (await page.locator('.sheet.assigning:not(.hidden)').isVisible().catch(() => false)) {
      viaForm = want >= 0;
      await page.locator('.sheet.assigning:not(.hidden) .report.later').click({ timeout: 2000 }); // "Później": the pads stay [0, 1, 2]
      await sleep(300);
    }
  }
  const viaInfo = await page.evaluate(() => window.__game.hero.info());
  check('installing skill 4 from an offered entry goes on to "Przypisz do przycisku"; Później keeps the pads', viaForm && viaInfo.ranks[3] === 1 && viaInfo.pads.join() === '0,1,2' && viaInfo.status === 'running', JSON.stringify({ ranks: viaInfo.ranks, pads: viaInfo.pads, status: viaInfo.status }));
  const padWords = () => page.evaluate(() => ['s1', 's2', 's3'].map((c) => document.querySelector(`.pad.${c} .word`)?.textContent ?? ''));
  const w0 = await padWords();
  const asked = await page.evaluate(() => {
    const g = window.__game;
    g.enemies.clear();
    return { ok: g.hero.openAssign(3), info: g.hero.info() };
  });
  await page.locator('.sheet.assigning:not(.hidden) .assign-pad').first().waitFor({ state: 'visible', timeout: 3000 });
  const asWords = await page.locator('.sheet.assigning .assign-pad .assign-word').allTextContents();
  const asHead = await page.locator('.sheet.assigning h2').textContent();
  await shot('07b-update-assign');
  check('a new skill: the update form asks "Przypisz do przycisku" with the three words on the pads', asked.ok && asked.info.ranks[3] === 1 && asWords.length === 3 && asWords.every((w, i) => w === w0[i]) && /Przypisz do przycisku/i.test(asHead ?? ''), JSON.stringify({ asWords, w0, asHead }));
  await page.locator('.assign-pad[data-pad="1"]').click({ timeout: 3000 });
  await sleep(500);
  const assigned = await page.evaluate(() => ({ info: window.__game.hero.info(), form: !!document.querySelector('.sheet.assigning:not(.hidden)') }));
  const w1 = await padWords();
  check('picking pad 1 puts the new skill there, the form closes and the game runs on', assigned.info.pads.join() === '3,1,2' && !assigned.form && assigned.info.status === 'running', JSON.stringify(assigned.info.pads));
  check('the pad word changed to the new skill, the other two stayed', w1[0] !== w0[0] && w1[0].length > 0 && w1[1] === w0[1] && w1[2] === w0[2], JSON.stringify({ w0, w1 }));
  await page.evaluate(() => {
    const g = window.__game;
    g.hero.spawn(8);
    const s = g.state();
    // a ring of enemies round the player: the drum's cone (an aimed skill, auto-aimed on a tap) finds some whichever way it points
    s.enemies.forEach((e, i) => {
      e.x = s.player.x + Math.cos((i * Math.PI) / 4) * 60;
      e.y = s.player.y + Math.sin((i * Math.PI) / 4) * 60;
      e.hp = e.hpMax = 100000;
    });
    s.hero.cd.fill(0);
  });
  await page.locator('.pad.s1').click({ timeout: 3000 });
  await sleep(250);
  const cast4 = await page.evaluate(() => window.__game.hero.info().cd);
  check('tapping pad 1 casts skill 4 (cd[3] runs), not skill 1', cast4[3] > 0 && cast4[0] === 0, JSON.stringify(cast4));
  const ring = await page.evaluate(() => document.querySelector('.pad.s1')?.classList.contains('cooling') ?? false);
  check('the cooldown ring of pad 1 follows skill 4', ring);
  await page.evaluate(() => {
    window.__game.enemies.clear();
    window.__game.state().hero.cd.fill(0);
  });
  // the loadout: from the pause sheet, with the real buttons
  await page.locator('.hud .pause-btn').click({ timeout: 3000 });
  await sleep(400);
  await page.locator('[data-pause=skills]').click({ timeout: 3000 });
  await page.locator('.loadout-sheet .lo-row').first().waitFor({ state: 'visible', timeout: 3000 });
  await shot('08a-loadout');
  const lo = await page.evaluate(() => ({
    rows: document.querySelectorAll('.loadout-sheet .lo-row').length,
    off: [...document.querySelectorAll('.loadout-sheet .lo-row.off')].map((r) => r.getAttribute('data-skill')),
    pause: !!document.querySelector('.pause-sheet:not(.hidden)'),
    on: [...document.querySelectorAll('.loadout-sheet .lo-pad.on')].map((b) => `${b.closest('.lo-row').getAttribute('data-skill')}:${b.getAttribute('data-pad')}`),
    padButtons: document.querySelectorAll('.loadout-sheet .lo-row:not(.off) .lo-pad').length,
    small: [...document.querySelectorAll('.loadout-sheet .lo-pad')].filter((b) => b.getBoundingClientRect().height < 43).length,
  }));
  check('the pause line "Umiejętności" opens the loadout: five rows, skill 5 greyed, pad numbers on the four installed', lo.rows === 5 && lo.off.join() === '4' && !lo.pause && lo.padButtons === 12 && lo.small === 0, JSON.stringify(lo));
  check('the loadout marks the pad each skill occupies', lo.on.join() === '1:2,2:3,3:1', lo.on.join());
  // tap skill 2 onto pad 3: the two swap (skill 3 goes to pad 2)
  await page.locator('.lo-row[data-skill="1"] .lo-pad[data-pad="3"]').click({ timeout: 3000 });
  await sleep(200);
  const swapped = await page.evaluate(() => ({ pads: window.__game.hero.info().pads, on: [...document.querySelectorAll('.loadout-sheet .lo-pad.on')].map((b) => `${b.closest('.lo-row').getAttribute('data-skill')}:${b.getAttribute('data-pad')}`) }));
  check('tapping a pad number moves the skill there, the displaced one swaps, the rows redraw', swapped.pads.join() === '3,2,1' && swapped.on.join() === '1:3,2:2,3:1', JSON.stringify(swapped));
  await page.locator('.lo-back').click({ timeout: 3000 });
  await sleep(300);
  const backed = await page.evaluate(() => ({ lo: !!document.querySelector('.loadout-sheet'), pause: !!document.querySelector('.pause-sheet:not(.hidden)'), status: window.__game.state().status }));
  check('Wróć closes the loadout and shows the pause sheet again', !backed.lo && backed.pause && backed.status === 'paused', JSON.stringify(backed));
  await page.locator('[data-pause=resume]').click({ timeout: 3000 });
  await sleep(500);
  const w2 = await padWords();
  check('after Wznów the pads carry the words of the new order', w2[0] === w1[0] && w2[1] === w1[2] && w2[2] === w1[1], JSON.stringify({ w1, w2 }));
  // the fifth skill, "Później": the pads stay
  const laterOk = await page.evaluate(() => {
    const g = window.__game;
    return g.hero.openAssign(4);
  });
  await page.locator('.sheet.assigning:not(.hidden) .report.later').click({ timeout: 3000 });
  await sleep(400);
  const laterState = await page.evaluate(() => ({ info: window.__game.hero.info(), form: !!document.querySelector('.sheet.assigning:not(.hidden)') }));
  check('"Później" leaves the pads as they are and closes the form', laterOk && laterState.info.pads.join() === '3,2,1' && laterState.info.ranks[4] === 1 && !laterState.form && laterState.info.status === 'running', JSON.stringify(laterState.info.pads));

  // ---------- 3c. paragraphs (S2): a level up offers the paragraph that opens, the pick is active, the pad shows the tag, the pause sheet switches it back ----------
  let paraOffer = null;
  for (let k = 0; k < 20 && !paraOffer; k++) {
    await page.evaluate(() => {
      window.__game.enemies.clear();
      window.__game.hero.levelUp();
    });
    await sleep(250);
    await page.locator('.hud .upd').click({ timeout: 3000 });
    await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
    const off = await page.evaluate(() => window.__game.hero.info());
    const at = off.offer.findIndex((id) => id.startsWith('para:'));
    if (at >= 0) paraOffer = { at, id: off.offer[at], level: off.level, offer: off.offer };
    else await settle();
  }
  check('a level up at the level a paragraph opens leads the update form with it, plus two other entries', paraOffer !== null && paraOffer.at === 0 && paraOffer.offer.length === 3, JSON.stringify(paraOffer));
  if (paraOffer) {
    const [, skillStr, nStr] = paraOffer.id.split(':');
    const skill = Number(skillStr);
    const n = Number(nStr);
    const tagText = await page.locator('.sheet:not(.hidden) .entry').nth(paraOffer.at).innerText();
    check('the paragraph entry is labelled "Paragraf" and names its number', /paragraf/i.test(tagText) && tagText.toLowerCase().replace(/\s+/g, ' ').includes(`paragraf ${n}`), tagText.replace(/\s+/g, ' '));
    await shot('07c-update-paragraph');
    await page.evaluate((i) => window.__game.hero.pickUpdate(i), paraOffer.at);
    await sleep(1300);
    await settle();
    const padsBefore = await page.evaluate(() => window.__game.hero.info().pads);
    await page.evaluate((i) => window.__game.hero.assignPad(1, i), skill);
    await sleep(300);
    const picked = await page.evaluate(() => ({ info: window.__game.hero.info(), tag: document.querySelector('.pad.s1 .ptag')?.textContent ?? null }));
    check('picking it makes the paragraph active and pad 1 wears the § tag', picked.info.paragraphs[skill] === n && picked.tag === `§${n}`, JSON.stringify({ para: picked.info.paragraphs, tag: picked.tag }));
    await shot('07d-pad-tag');
    // switch back to § 1 from the pause sheet with the real buttons
    await page.locator('.hud .pause-btn').click({ timeout: 3000 });
    await sleep(400);
    await page.locator('[data-pause=paragraphs]').click({ timeout: 3000 });
    await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
    const kf = await page.evaluate((i) => ({
      rows: document.querySelectorAll('.kf-sheet .kf-row').length,
      active: document.querySelector(`.kf-sheet .kf-row[data-skill="${i}"] .kf-box.active`)?.getAttribute('data-n') ?? null,
      stamps: document.querySelectorAll('.kf-sheet .kf-box.active .kf-stamp').length,
      pause: !!document.querySelector('.pause-sheet:not(.hidden)'),
    }), skill);
    check('the pause line "Konfiguracja" opens the sheet over the hidden pause sheet, the active box stamped', kf.rows === 5 && kf.active === String(n) && kf.stamps >= 3 && !kf.pause, JSON.stringify(kf));
    await shot('08aa-konfiguracja');
    await page.locator(`.kf-sheet .kf-row[data-skill="${skill}"] .kf-box[data-n="1"]`).click({ timeout: 3000 });
    await sleep(200);
    await page.locator('.kf-back').click({ timeout: 3000 });
    await sleep(300);
    const kfBack = await page.evaluate(() => ({ kf: !!document.querySelector('.kf-sheet'), pause: !!document.querySelector('.pause-sheet:not(.hidden)'), status: window.__game.state().status }));
    check('Wróć closes Konfiguracja and shows the pause sheet again', !kfBack.kf && kfBack.pause && kfBack.status === 'paused', JSON.stringify(kfBack));
    await page.locator('[data-pause=resume]').click({ timeout: 3000 });
    await sleep(400);
    const switched = await page.evaluate(() => ({ info: window.__game.hero.info(), tag: document.querySelector('.pad.s1 .ptag')?.textContent ?? null }));
    check('the switch to § 1 holds after Wznów and the pad tag is gone', switched.info.paragraphs[skill] === 1 && switched.tag === '' && switched.info.status === 'running', JSON.stringify({ para: switched.info.paragraphs, tag: switched.tag }));
    await page.evaluate((pads) => pads.forEach((k, i) => window.__game.hero.assignPad(i + 1, k)), padsBefore); // the order the rest of the smoke expects
  }

  // ---------- 3d. the Argument meter and the ultimate (S3): rebuttals fill it, the stamp pad inks in, a real tap casts ----------
  await settle();
  const ultLocked = await page.evaluate(() => ({ level: window.__game.state().player.level, pad: window.__game.ultimatePad(), shown: document.querySelector('.pad.ult')?.getClientRects().length ?? 0 }));
  if (ultLocked.level < 12) check('below level 12 the ultimate pad is hidden', ultLocked.pad?.hidden === true && ultLocked.shown === 0, JSON.stringify(ultLocked));
  const refused = await page.evaluate(() => {
    if (window.__game.state().player.level >= 12) return null;
    window.__game.fillMeter(1);
    const cast = window.__game.castUltimate();
    window.__game.fillMeter(0);
    return cast;
  });
  if (refused !== null) check('below level 12 a full meter casts nothing', refused === false);
  await page.evaluate(() => {
    window.__game.setLevel(Math.max(12, window.__game.state().player.level));
    window.__game.fillMeter(0);
  });
  // rebut until full: every standing claim answered with its own type (one rebuttal per claim; a fresh row each round)
  let rebuttals = 0;
  for (let k = 0; k < 20; k++) {
    const r = await page.evaluate(() => {
      const g = window.__game;
      g.enemies.clear();
      g.enemies.spawnFamily('urzadzenia', 6);
      const st = g.state();
      let n = 0;
      for (const e of st.enemies) {
        e.hp = e.hpMax = 1e6;
        if (e.claim && !e.claim.struck && g.enemies.hit(e.id, e.claim.type, 1)) n++;
      }
      return { n, meter: g.ultimateInfo().meter };
    });
    rebuttals += r.n;
    if (r.meter >= 1) break;
  }
  await sleep(300);
  const ultFull = await page.evaluate(() => ({ info: window.__game.ultimateInfo(), pad: window.__game.ultimatePad(), arg: document.querySelector('.hud .arg')?.classList.contains('full') ?? false }));
  check('rebuttals fill the Argument meter, the stamp pad is shown and ready, the HUD underline is full', ultFull.info.ready && ultFull.pad?.ready === true && ultFull.pad.hidden === false && ultFull.arg, JSON.stringify({ rebuttals, ...ultFull }));
  await shot('07e-ultimate-ready');
  // the crowd of six speaks through two bubbles at most, every one inside the screen; the ready pad's word is ink, underlined in red
  const crowd = await page.evaluate(() => {
    const on = [...document.querySelectorAll('#world [data-kind="enemy"] [data-part="over"] > .bubble:not(.comment):not(.bubble-off)')].filter((b) => b.childElementCount > 0);
    const out = on.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1;
    }).length;
    const word = document.querySelector('.pad.ult .word');
    const cs = word ? getComputedStyle(word) : null;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return { shown: on.length, out, color: cs?.color ?? '', line: cs?.textDecorationLine ?? '', lineColor: cs?.textDecorationColor ?? '', ink };
  });
  check('a crowd of six shows at most two claim bubbles, none past the screen edge', crowd.shown <= 2 && crowd.shown >= 1 && crowd.out === 0, JSON.stringify(crowd));
  check('the ready pad word is ink with a red underline (red stays on the cushion and the line)', crowd.line.includes('underline') && crowd.color !== crowd.lineColor, JSON.stringify(crowd));
  await hitAreas('the meter full');
  const fxTexts = () => page.evaluate(() => [...document.querySelectorAll('#fx .stamp-frame')].length);
  const stampsBefore = await fxTexts();
  await page.locator('.pad.ult').click({ timeout: 3000 });
  await sleep(350);
  const ultCast = await page.evaluate(() => ({ info: window.__game.ultimateInfo(), pad: window.__game.ultimatePad(), area: document.querySelectorAll('#fx .ult-area').length }));
  const stampsAfter = await fxTexts();
  const ultStamp = await page.evaluate(() => {
    const st = [...document.querySelectorAll('#fx .stamp-frame')].pop()?.getBoundingClientRect();
    const hero = document.querySelector('#world [data-kind="player"]')?.getBoundingClientRect();
    const bubbles = document.querySelectorAll('#world [data-kind="enemy"] [data-part="over"] > .bubble:not(.comment):not(.bubble-off)').length;
    if (!st || !hero) return { missing: true };
    const hy = hero.top + hero.height / 2;
    return { clear: hy < st.top || hy > st.bottom, inside: st.left >= 0 && st.right <= innerWidth && st.top >= 0 && st.bottom <= innerHeight, bubbles };
  });
  check('the ultimate stamp lands beside the hero (not across him), inside the screen, and the claim bubbles keep quiet under it', ultStamp.clear === true && ultStamp.inside === true && ultStamp.bubbles === 0, JSON.stringify(ultStamp));
  check('a real tap on the pad casts: a stamp lands, the meter is empty, the pad is off again, the area is outlined', stampsAfter > stampsBefore && ultCast.info.meter === 0 && ultCast.info.active.length === 1 && ultCast.pad?.off === true && ultCast.area === 1, JSON.stringify({ stampsBefore, stampsAfter, ...ultCast }));
  await shot('07f-ultimate-cast');
  await hitAreas('the update note up');
  await page.evaluate(() => window.__game.enemies.clear()); // the immortal row goes before it can wear the player down
  await sleep(6500);
  const ultEnd = await page.evaluate(() => ({ info: window.__game.ultimateInfo(), area: document.querySelectorAll('#fx .ult-area').length }));
  check('the ultimate ends within 8 s and its outline is rubbed out', ultEnd.info.active.length === 0 && ultEnd.area === 0, JSON.stringify(ultEnd));
  await page.evaluate(() => window.__game.enemies.clear());
  await settle();

  // ---------- 4. inventory sheet ----------
  await page.evaluate(() => window.__game.demoInventory());
  await page.locator('.pad.inv').click({ timeout: 2000 }).catch(() => undefined);
  await sleep(600);
  await shot('08-inventory');
  await page.locator('.ps-close').click({ timeout: 2000 }).catch(() => undefined);
  await sleep(300);

  // ---------- 4b. pause, resume, Zakończ and the bookmark (DESIGN 4.1) ----------
  await settle();
  await page.evaluate(() => {
    window.__keep = window.__game.state();
  });
  const pz0 = await page.evaluate(() => window.__game.state().time);
  await page.locator('.hud .pause-btn').click({ timeout: 3000 });
  await sleep(500);
  const pz1 = await page.evaluate(() => ({ status: window.__game.state().status, time: window.__game.state().time, sheet: !!document.querySelector('.pause-sheet') }));
  check('Pauza holds the run and opens the pause sheet', pz1.status === 'paused' && pz1.sheet && pz1.time >= pz0, JSON.stringify(pz1));
  await shot('08b-pause-sheet');
  await sleep(600);
  check('the clock stands still while the sheet is open', (await page.evaluate(() => window.__game.state().time)) === pz1.time);
  await page.locator('[data-pause=resume]').click({ timeout: 3000 });
  await sleep(500);
  const pz2 = await page.evaluate(() => ({ same: window.__keep === window.__game.state(), status: window.__game.state().status, time: window.__game.state().time }));
  check('Wznów continues the same state object', pz2.same && pz2.status === 'running' && pz2.time > pz1.time, JSON.stringify(pz2));
  await pauseTap(page, 'portrait run');
  // on to page 2, a wound, then Zakończ zgłoszenie
  await page.evaluate(() => window.__game.turnTo(1));
  await sleep(1500);
  await settle();
  await page.evaluate(() => {
    const g = window.__game;
    g.enemies.clear();
    g.hurtPlayer(12);
  });
  const pzBefore = await runState();
  await page.locator('.hud .pause-btn').click({ timeout: 3000 });
  await sleep(400);
  await page.locator('[data-pause=end]').click({ timeout: 3000 });
  await sleep(900);
  check("Zakończ goes to 'baza'", (await screen()) === 'baza', await screen());
  await page.evaluate(() => window.__game.station('biurko'));
  await sleep(500);
  const resumeLine = await page.locator('.resume-btn').textContent({ timeout: 3000 }).catch(() => null);
  check('the base offers "Wznów zgłoszenie nr ..." at the top', typeof resumeLine === 'string' && resumeLine.includes('Wznów zgłoszenie nr'), String(resumeLine));
  await shot('08c-baza-resume');
  const saved = await page.evaluate(() => ({ bookmark: window.__game.meta().bookmark ?? null, character: window.__game.character() }));
  check('the bookmark and the character were saved', saved.bookmark?.pageIndex === pzBefore?.page && saved.character !== null, JSON.stringify(saved.bookmark));
  await page.locator('.resume-btn').click({ timeout: 3000 });
  await sleep(600);
  check('Wznów zgłoszenie unlocks the exit of the base, the run has not started yet', (await page.evaluate(() => ({ phase: window.__game.state().phase, acc: window.__game.state().base.accepted }))).phase === 'base');
  await page.evaluate(() => window.__game.walkToExit());
  await sleep(2000);
  await settle();
  const pzAfter = await page.evaluate(() => {
    const s = window.__game.state();
    return s && { screen: window.__game.screen(), page: s.pageIndex, hp: s.player.hp, hpMax: s.player.hpMax, note: window.__game.notes().map((n) => n.text).join(' ') };
  });
  check('resuming lands on the same page index with full racja', pzAfter?.screen === 'run' && pzAfter.page === pzBefore?.page && pzAfter.hp === pzAfter.hpMax, JSON.stringify({ page: pzAfter?.page, hp: pzAfter?.hp }));
  check('a footnote says the ticket was reassigned', (pzAfter?.note ?? '').includes('innemu konsultantowi'));
  await shot('08d-resumed');

  // ---------- 4c. the service tunnel: open, walk in, the base, return into the same run, the tape (DESIGN 4.1) ----------
  await settle();
  await page.evaluate(() => {
    const g = window.__game;
    g.enemies.clear();
    g.enemies.spawnFamily('urzadzenia', 3);
    window.__keep = g.state();
  });
  await page.locator('.hud .tunnel-btn').click({ timeout: 3000 });
  await sleep(600);
  const tn1 = await page.evaluate(() => ({ open: !!window.__game.state().tunnel, holes: document.querySelectorAll('#page .tn-hole').length }));
  check('Tunel cuts a hole at the player\'s feet', tn1.open && tn1.holes === 1, JSON.stringify(tn1));
  // a second tunnel a little further on closes the first with tape
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.placePlayer(s.tunnel.x - 130, s.tunnel.y);
  });
  await page.locator('.hud .tunnel-btn').click({ timeout: 3000 });
  await sleep(700);
  const tn2 = await page.evaluate(() => ({ holes: document.querySelectorAll('#page .tn-hole').length, tapes: document.querySelectorAll('#page .tn-tape').length }));
  check('a second tunnel tapes the first', tn2.holes === 2 && tn2.tapes === 1, JSON.stringify(tn2));
  await shot('08e-tunnel-open');
  // step off the hole, then walk back onto it with the real step (a target, the loop's own steps)
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.placePlayer(s.tunnel.x + 90, s.tunnel.y);
    s.player.target = { x: s.tunnel.x, y: s.tunnel.y };
  });
  await page.waitForFunction(() => window.__game.screen() === 'baza', null, { timeout: 8000 }).catch(() => undefined);
  await sleep(400);
  const tnHeld = await page.evaluate(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), phase: s?.phase, held: window.__keep.status, other: window.__keep !== s, hole: !!s.tunnel, time: window.__keep.time };
  });
  check('walking onto the hole holds the run and opens the base with the hole in it', tnHeld.screen === 'baza' && tnHeld.phase === 'base' && tnHeld.held === 'paused' && tnHeld.other && tnHeld.hole, JSON.stringify(tnHeld));
  await shot('08f-tunnel-baza');
  await page.evaluate(() => window.__game.station('biurko'));
  await sleep(500);
  const tnLine = await page.locator('.tunnel-wait').textContent().catch(() => '');
  check('the desk shows the return line', /czeka na stronie/.test(tnLine ?? '') && (await page.locator('.tunnel-return').isVisible()), String(tnLine));
  await page.evaluate(() => document.querySelector('.ps-close').click());
  await sleep(700);
  check('the held run stands still while the player is in the base', (await page.evaluate(() => window.__keep.time)) === tnHeld.time);
  // the return, read in the same task: nothing can have stepped between the two snapshots
  const exact = await page.evaluate(() => {
    const snap = () => {
      const s = window.__keep;
      return JSON.stringify({ time: s.time, enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]), player: [s.player.x, s.player.y], pickups: s.pickups.map((k) => [k.id, k.x, k.y]) });
    };
    const before = snap();
    const ok = window.__game.returnFromTunnel();
    // the figures were on the page all along: none of them is being drawn in again
    const redrawn = [...document.querySelectorAll('#world > g[data-kind] path')].filter((p) => p.style.strokeDasharray !== '').length;
    return { ok, before, after: snap(), same: window.__keep === window.__game.state(), redrawn };
  });
  check('returning restores the same enemies, loot and clock, to the unit', exact.ok && exact.same && exact.before === exact.after, exact.before === exact.after ? '' : `${exact.before} vs ${exact.after}`);
  check('on the return the figures stand where they were, not drawn in again', exact.redrawn === 0, `${exact.redrawn} strokes drawing in`);
  await sleep(900);
  const tnBack = await page.evaluate(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), status: s.status, same: window.__keep === s, time: s.time, tunnel: s.tunnel ?? null, tapes: document.querySelectorAll('#page .tn-tape').length };
  });
  check('the run continues from the clock where it stopped', tnBack.screen === 'run' && tnBack.status === 'running' && tnBack.same && tnBack.time > tnHeld.time && tnBack.time - tnHeld.time < 3, `${tnHeld.time.toFixed(2)} -> ${tnBack.time.toFixed(2)}`);
  check('the hole is taped, the earlier tape is back on the page and the tunnel is closed', tnBack.tunnel === null && tnBack.tapes === 2, JSON.stringify({ tapes: tnBack.tapes }));
  await shot('08g-tunnel-taped');

  // ---------- 5. the boss ----------
  await settle();
  const pages = (await runState())?.pages ?? 1;
  await page.evaluate((n) => window.__game.turnTo(n - 1), pages);
  await sleep(1500);
  await settle();
  await shot('09-boss-page');
  const boss = await page.evaluate(() => {
    const b = window.__game.state()?.enemies.find((e) => e.boss);
    return b ? { id: b.id, family: b.family } : null;
  });
  check('the boss spawns on the last page', boss !== null, boss ? boss.family : 'none');

  // ---------- 5a. Spór: the boss argues (DESIGN 5.4) ----------
  if (boss) {
    const sporOpen = async (phase, tries = 60) => {
      for (let i = 0; i < tries; i++) {
        const info = await page.evaluate(() => window.__game.spor.info());
        if (info?.open && info.phase === phase) return info;
        if (phase === 2) {
          // Weryfikacja: stand on a hydrant square; Hipoteza: stand in the outline; Prototyp: knock it below half racja
          await page.evaluate((id) => {
            const s = window.__game.state();
            const b = s?.enemies.find((e) => e.id === id);
            if (!s || !b) return;
            s.player.hp = s.player.hpMax;
            const grid = b.rt?.grid;
            if (grid) {
              const c = grid.cells[0];
              window.__game.placePlayer(grid.cx + ((c % 3) - 1) * 52, grid.cy + (Math.floor(c / 3) - 1) * 52);
            } else if (b.family === 'wygenerowane') window.__game.placePlayer(b.x + 10, b.y + 10);
            else if (b.hp > b.hpMax / 2 + 1) window.__game.enemies.hit(id, 'regulaminowy', 30);
          }, boss.id);
        }
        await sleep(200);
      }
      return null;
    };
    const first = await sporOpen(1, 40);
    check('the boss posts its first comment', first !== null && first.replies.length === 3, first ? first.commentKey : 'none');
    const dom1 = await page.evaluate(() => ({ buttons: document.querySelectorAll('.spor-reply').length, bubble: document.querySelectorAll('.bubble.comment').length }));
    check('three reply buttons and a comment bubble are on the page', dom1.buttons === 3 && dom1.bubble === 1, JSON.stringify(dom1));
    await shot('09a-spor-prompt');
    if (first) {
      const wrong = [0, 1, 2].find((i) => i !== first.correct);
      const hp0 = await page.evaluate(() => {
        const s = window.__game.state();
        s.player.hp = s.player.hpMax;
        return s.player.hpMax;
      });
      await page.click(`.spor-reply[data-reply="${wrong}"]`);
      await sleep(150);
      const after = await page.evaluate(() => ({ hp: window.__game.state().player.hp, open: window.__game.spor.info()?.open, notes: window.__game.notes().map((n) => n.text), struck: document.querySelectorAll('.spor-reply.wrong').length }));
      check('a wrong reply costs racja, closes the prompt and prints the footnote', after.hp < hp0 && after.open === false && after.notes.some((n) => n.includes('nie na temat')), `${hp0} -> ${after.hp}`);
      check('the wrong reply costs 10% of the racja maximum', hp0 - after.hp === Math.round(hp0 * 0.1), `${hp0} -> ${after.hp}`);
      check('the wrong reply is struck where it stands', after.struck === 1);
      await shot('09b-spor-wrong');
      await sleep(1100);
      const gone = await page.evaluate(() => document.querySelectorAll('.spor-reply').length);
      check('the strip is removed after the answer', gone === 0, String(gone));
    }
    const second = await sporOpen(2, 60);
    check('the second comment comes with the boss phase', second !== null, second ? second.commentKey : 'none');
    if (second) {
      await page.evaluate(() => (window.__game.state().player.hp = window.__game.state().player.hpMax));
      await page.click(`.spor-reply[data-reply="${second.correct}"]`);
      await sleep(250);
      const won = await page.evaluate(() => window.__game.spor.info());
      const struck = await page.evaluate(() => document.querySelectorAll('.bubble.comment .strike').length);
      check('the right reply opens the x2 window', won !== null && won.window > 0 && won.open === false, won ? won.window.toFixed(2) : 'none');
      check('the right reply strikes the comment through', struck === 1, String(struck));
      await shot('09c-spor-right');
      await sleep(900);
    }
  }
  let bossDead = false;
  for (let i = 0; i < 60 && boss; i++) {
    const alive = await page.evaluate((id) => {
      const s = window.__game.state();
      const b = s?.enemies.find((e) => e.id === id);
      if (!s || !b) return false;
      window.__game.placePlayer(b.x + 30, b.y);
      for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) window.__game.enemies.hit(id, t, 60);
      return true;
    }, boss.id);
    if (!alive) {
      bossDead = true;
      break;
    }
    await sleep(150);
    await settle();
  }
  check('the boss dies', bossDead);
  await sleep(300);
  await shot('10-boss-dead');
  for (let i = 0; i < 30 && (await screen()) !== 'baza'; i++) {
    await sleep(300);
    await settle();
  }
  check("'baza' is reached after the boss", (await screen()) === 'baza', await screen());
  await shot('11-baza-after-boss');

  // ---------- 6. a death form ----------
  await page.evaluate(() => window.__game.station('biurko'));
  await sleep(500);
  await clickText('Nowe zgłoszenie');
  await sleep(500);
  await clickText('Akceptuję regulamin');
  await sleep(1500);
  await page.evaluate(() => window.__game.walkToExit());
  await sleep(2000);
  await settle();
  await page.evaluate(() => {
    const s = window.__game.state();
    if (s) s.enemies.length = 0;
    window.__game.hurtPlayer(99999);
  });
  await sleep(1400);
  const deathForm = await page.locator('.sheet:not(.hidden)').first().isVisible().catch(() => false);
  check('a death form appears', deathForm);
  await shot('12-death');
  await sleep(7500);
  await shot('13-after-death');
  log('after the death form:', await screen(), JSON.stringify(await runState()));

  // ---------- 6b. landscape with the joystick (DESIGN 2) ----------
  // A second context at 844 x 390: the layout flips by itself, the joystick is the default steering, a thumb on the
  // left half steers while another finger taps a pad, and the figure fights while it walks.
  const lctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await lctx.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const lp = await lctx.newPage();
  lp.on('pageerror', (e) => problems.push(`pageerror (landscape): ${e.message}`));
  lp.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()} (landscape): ${m.text()}`);
  });
  await lp.goto(BASE, { waitUntil: 'load' });
  await lp.waitForFunction(() => window.__game !== undefined);
  await lp.evaluate(() => document.fonts.ready);
  const lcdp = await lctx.newCDPSession(lp);
  const touch = (type, points) => lcdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const lstate = () => lp.evaluate(() => {
    const s = window.__game.state();
    return s && { x: s.player.x, y: s.player.y, enemies: s.enemies.map((e) => ({ hp: e.hp, hpMax: e.hpMax })) };
  });

  // the base in landscape first: a single quick tap on Pauza, and the controls after every sheet of a station (both modes)
  await lp.evaluate(() => window.__game.startBase()); // (the hero stays the default one: the aiming leg below depends on it)
  await sleep(900);
  await pauseTap(lp, 'landscape base');
  await controlsAfterSheets(lp, lctx, 'landscape base');
  await lp.evaluate(() => window.__game.setSteering('joystick'));
  await lp.evaluate(() => window.__game.start(31, { pageCount: 3, lawId: 'grawitacja' }));
  await sleep(1500);
  const ctl = await lp.evaluate(() => ({ ...window.__game.controls(), attr: document.documentElement.dataset.orient, steer: document.documentElement.dataset.steer }));
  check('landscape layout and the joystick by default at 844 x 390', ctl.orient === 'landscape' && ctl.attr === 'landscape' && ctl.steering === 'joystick' && ctl.steer === 'joystick', JSON.stringify(ctl));
  // one target dummy straight above the player, with a lot of racja
  await lp.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9;
    s.hero.pendingLevels = 0;
    g.placePlayer(600, 900);
    const [id] = g.enemies.spawnFamily('urzadzenia', 1);
    const e = s.enemies.find((x) => x.id === id);
    e.hp = e.hpMax = 1e6;
    e.x = e.home.x = 600;
    e.y = e.home.y = 830;
  });
  await sleep(600); // drawn in
  // Sample every frame: an auto-attack while moving shows as attackTimer jumping up while player.moving is true.
  // The position at the very pointerup is kept, to see that the player stops within one step of the release.
  await lp.evaluate(() => {
    const w = window;
    w.__smokeLand = { autoWhileMoving: 0, releasedAt: null };
    let prev = 0;
    const tick = () => {
      const s = w.__game.state();
      if (!s) return;
      const p = s.player;
      if (p.moving && p.attackTimer > prev + 1e-6) w.__smokeLand.autoWhileMoving++;
      prev = p.attackTimer;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.getElementById('stage').addEventListener(
      'pointerup',
      () => {
        const s = w.__game.state();
        if (s && w.__smokeLand.releasedAt === null) w.__smokeLand.releasedAt = { x: s.player.x, y: s.player.y, speed: s.player.speed * s.law.speedMul };
      },
      { capture: true },
    );
  });
  const p0 = await lstate();
  // thumb down on the left half and pushed up; a second finger taps the first skill pad meanwhile.
  // (CDP: touchStart/touchMove list every active point, touchEnd lists the points that are lifted.)
  await touch('touchStart', [{ x: 160, y: 270, id: 1 }]);
  await sleep(100);
  for (let i = 1; i <= 3; i++) {
    await touch('touchMove', [{ x: 160, y: 270 - i * 8, id: 1 }]);
    await sleep(60);
  }
  const padBox = await lp.locator('.pad.s1').boundingBox();
  const padPoint = { x: padBox.x + padBox.width / 2, y: padBox.y + 26, id: 2 };
  const held = { x: 160, y: 246, id: 1 };
  await touch('touchStart', [held, padPoint]);
  await sleep(60);
  await touch('touchEnd', [padPoint]);
  await sleep(120);
  const joyShown = await lp.evaluate(() => !document.querySelector('.joy').classList.contains('hidden'));
  const padCooling = await lp.locator('.pad.s1.cooling').count();
  await lp.screenshot({ path: `${SHOTS}/15-landscape-joystick.png` });
  let last = held;
  for (let i = 1; i <= 12; i++) {
    last = { x: held.x, y: Math.max(200, held.y - i * 6), id: 1 };
    await touch('touchMove', [last]);
    await sleep(90);
  }
  const p1 = await lstate();
  await touch('touchEnd', [last]);
  await sleep(150);
  const joyHidden = await lp.evaluate(() => document.querySelector('.joy').classList.contains('hidden'));
  const p2 = await lstate();
  await sleep(400);
  const p3 = await lstate();
  const moved = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  check('the joystick is drawn under the thumb and hidden on release', joyShown && joyHidden, `shown ${joyShown}, hidden ${joyHidden}`);
  check('the player moved with the joystick', moved > 40, `${moved.toFixed(0)} units`);
  check('a pad tap works while the thumb steers (two touches)', padCooling > 0, `cooling pads ${padCooling}`);
  const land = await lp.evaluate(() => window.__smokeLand);
  const rel = land.releasedAt;
  const afterRelease = rel ? Math.hypot(p3.x - rel.x, p3.y - rel.y) : Infinity;
  const oneStep = rel ? rel.speed / 60 + 0.5 : 0;
  check('the player stops within one step of the release', afterRelease <= oneStep, `${afterRelease.toFixed(2)} units after pointerup (one step ${oneStep.toFixed(2)})`);
  check('the player stays stopped', Math.hypot(p3.x - p2.x, p3.y - p2.y) < 0.5, `${Math.hypot(p3.x - p2.x, p3.y - p2.y).toFixed(2)} units`);
  check('auto-attack fires while steering', land.autoWhileMoving > 0, `${land.autoWhileMoving} attacks while moving`);
  const fought = (p3.enemies[0]?.hp ?? 1) < (p3.enemies[0]?.hpMax ?? 1);
  check('an attack landed on the dummy', fought, `hp ${p3.enemies[0]?.hp}/${p3.enemies[0]?.hpMax}`);
  await lp.screenshot({ path: `${SHOTS}/16-landscape-after.png` });
  // ---------- 6c. aiming (DESIGN 5.6): hold a pad, drag, see the arrow, release; drag back onto the pad cancels ----------
  // The hero is Pralka (skill 3, Odwirowanie, is aimed by direction). One thumb steers on the left half while the other
  // aims on the pad: two pointer ids that must not disturb each other.
  await lp.evaluate(() => {
    const s = window.__game.state();
    s.hero.cd[2] = 0;
    window.__aimSeen = { dash: null };
    const watch = () => {
      const st = window.__game.state();
      if (st && st.hero.dash && !window.__aimSeen.dash) window.__aimSeen.dash = { dx: st.hero.dash.dx, dy: st.hero.dash.dy };
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  const aimPad = await lp.locator('.pad.s3').boundingBox();
  const aimCentre = { x: aimPad.x + aimPad.width / 2, y: aimPad.y + 26 };
  const aimPoint = { x: aimCentre.x - 70, y: aimCentre.y - 50, id: 5 };
  const aimHeld = { x: 160, y: 270, id: 4 };
  await touch('touchStart', [aimHeld]);
  await sleep(80);
  await touch('touchMove', [{ x: 160, y: 250, id: 4 }]);
  await sleep(60);
  await touch('touchStart', [{ x: 160, y: 250, id: 4 }, { ...aimCentre, id: 5 }]);
  await sleep(60);
  const aimBefore = await lstate();
  for (let i = 1; i <= 5; i++) {
    await touch('touchMove', [{ x: 160, y: 250 - i * 3, id: 4 }, { x: aimCentre.x + ((aimPoint.x - aimCentre.x) * i) / 5, y: aimCentre.y + ((aimPoint.y - aimCentre.y) * i) / 5, id: 5 }]);
    await sleep(70);
  }
  await sleep(150);
  const aimDuring = await lp.evaluate(() => {
    const g = document.querySelector('#aim-fx');
    const shaft = g?.querySelector('path');
    const s = window.__game.state();
    return {
      shown: !!g && g.style.opacity === '1',
      arrow: !!shaft && (shaft.getAttribute('d') ?? '').startsWith('M') && shaft.getAttribute('display') !== 'none',
      thick: document.querySelectorAll('.pad.s3 path[stroke-width="2.8"]').length,
      joy: !document.querySelector('.joy').classList.contains('hidden'),
      cd: s.hero.cd[2],
      x: s.player.x,
      y: s.player.y,
    };
  });
  await lp.screenshot({ path: `${SHOTS}/18-landscape-aiming.png` });
  await touch('touchEnd', [{ x: aimPoint.x, y: aimPoint.y, id: 5 }]);
  await sleep(120);
  const aimAfter = await lp.evaluate(() => {
    const s = window.__game.state();
    return { seen: window.__aimSeen.dash, cd: s.hero.cd[2], shown: document.querySelector('#aim-fx').style.opacity === '1' };
  });
  await touch('touchEnd', [{ x: 160, y: 235, id: 4 }]);
  await sleep(150);
  const want = { dx: aimPoint.x - aimCentre.x, dy: aimPoint.y - aimCentre.y };
  const wantLen = Math.hypot(want.dx, want.dy);
  const dot = aimAfter.seen ? (aimAfter.seen.dx * want.dx + aimAfter.seen.dy * want.dy) / wantLen : -1;
  check('aiming: a held pad draws the dotted arrow and its circle goes thicker', aimDuring.shown && aimDuring.arrow && aimDuring.thick > 0, JSON.stringify(aimDuring));
  check('aiming: the cooldown is not spent while held', aimDuring.cd === 0, `cd ${aimDuring.cd}`);
  check('aiming: the other thumb keeps steering during the hold', aimDuring.joy && Math.hypot(aimDuring.x - aimBefore.x, aimDuring.y - aimBefore.y) > 3, `joystick ${aimDuring.joy}, moved ${Math.hypot(aimDuring.x - aimBefore.x, aimDuring.y - aimBefore.y).toFixed(1)}`);
  check('aiming: release fires Odwirowanie in the dragged direction', aimAfter.seen !== null && dot > 0.99, `dash ${JSON.stringify(aimAfter.seen)}, want ${(want.dx / wantLen).toFixed(2)},${(want.dy / wantLen).toFixed(2)}, dot ${dot.toFixed(3)}`);
  check('aiming: the cooldown starts and the arrow is rubbed out', aimAfter.cd > 0 && !aimAfter.shown, JSON.stringify(aimAfter));
  // dragged out, then back onto the pad: nothing fires and no cooldown is spent
  await lp.evaluate(() => {
    const s = window.__game.state();
    s.hero.cd[2] = 0;
    s.hero.dash = null;
    window.__aimSeen.dash = null;
  });
  await touch('touchStart', [{ ...aimCentre, id: 6 }]);
  await sleep(60);
  await touch('touchMove', [{ x: aimCentre.x - 60, y: aimCentre.y - 40, id: 6 }]);
  await sleep(150);
  const outShown = await lp.evaluate(() => document.querySelector('#aim-fx').style.opacity === '1');
  await touch('touchMove', [{ x: aimCentre.x + 2, y: aimCentre.y + 1, id: 6 }]);
  await sleep(100);
  await touch('touchEnd', [{ x: aimCentre.x + 2, y: aimCentre.y + 1, id: 6 }]);
  await sleep(200);
  const cancelled = await lp.evaluate(() => {
    const s = window.__game.state();
    return { cd: s.hero.cd[2], dash: window.__aimSeen.dash, shown: document.querySelector('#aim-fx').style.opacity === '1' };
  });
  check('aiming: dragged back onto the pad cancels, no cooldown, the arrow goes', outShown && cancelled.cd === 0 && cancelled.dash === null && !cancelled.shown, `shown while out ${outShown}, ${JSON.stringify(cancelled)}`);
  // a quick tap is still the auto cast
  await touch('touchStart', [{ ...aimCentre, id: 7 }]);
  await sleep(50);
  await touch('touchEnd', [{ ...aimCentre, id: 7 }]);
  await sleep(150);
  const tapped = await lp.evaluate(() => window.__game.state().hero.cd[2]);
  check('aiming: a quick tap on the pad is the auto cast', tapped > 0, `cd ${tapped}`);
  await lp.evaluate(() => {
    const s = window.__game.state();
    s.hero.cd[2] = 0;
    s.hero.dash = null;
  });
  await sleep(300);

  // the footnote slip lies over the steering half: a thumb that lands on it steers, a quick tap on it opens the history
  const slip = await lp.locator('.foot').boundingBox();
  const onSlip = { x: Math.min(slip.x + 40, 844 / 2 - 30), y: slip.y + slip.height / 2, id: 3 };
  await touch('touchStart', [onSlip]);
  await sleep(80);
  await touch('touchMove', [{ ...onSlip, y: onSlip.y - 30 }]);
  await sleep(200);
  const slipSteer = await lp.evaluate(() => ({ joy: !document.querySelector('.joy').classList.contains('hidden'), history: !!document.querySelector('.pop-history') }));
  await touch('touchEnd', [{ ...onSlip, y: onSlip.y - 30 }]);
  await sleep(150);
  check('joystick mode: a thumb landing on the footnote slip steers', slipSteer.joy && !slipSteer.history, JSON.stringify(slipSteer));
  await touch('touchStart', [onSlip]);
  await sleep(50);
  await touch('touchEnd', [onSlip]);
  await sleep(300);
  const slipTap = await lp.evaluate(() => !!document.querySelector('.pop-history'));
  check('joystick mode: a quick tap on the footnote slip opens the history', slipTap);
  await lp.screenshot({ path: `${SHOTS}/17-landscape-footnote-history.png` });
  await lctx.close();

  // ---------- 6d. the Kartograf's laser and Nalesnik (DESIGN 10) ----------
  await page.evaluate(() => window.__game.start(11, { heroId: 'kartograf' }));
  await sleep(1400);
  const laser = await page.evaluate(async () => {
    const g = window.__game;
    const s = g.state();
    g.enemies.clear();
    g.placePlayer(600, 800);
    s.player.hp = s.player.hpMax = 1e9;
    const [id] = g.enemies.spawnFamily('urzadzenia', 1);
    const e = s.enemies.find((x) => x.id === id);
    e.x = 790;
    e.y = 796;
    e.home = { x: e.x, y: e.y };
    e.hp = e.hpMax = 1e9;
    e.attackTimer = 99;
    await new Promise((r) => setTimeout(r, 700));
    s.projectiles.length = 0;
    g.attack('player');
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const label = [...document.querySelectorAll('#fx text.t-note')].map((n) => n.textContent).find((x) => /^\d+,\d\sm$/.test(x ?? '')) ?? null;
    const lines = document.querySelectorAll('#fx path.attack-ink').length;
    return { projectiles: s.projectiles.length, label, lines };
  });
  check('kartograf: the auto-attack is a hitscan laser: no projectile, a ruled line and a distance label in the fx layer', laser.projectiles === 0 && laser.label !== null && laser.lines >= 1, JSON.stringify(laser));
  await shot('15-kartograf-laser');

  await page.evaluate(() => window.__game.start(12, { heroId: 'nalesnik' }));
  await sleep(1400);
  await settle(); // the regulamin sheet of a fresh run holds the clock until it is accepted
  const nal = await page.evaluate(async () => {
    const g = window.__game;
    const s = g.state();
    const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const disc = () => document.querySelector('#world > g[data-kind="player"] [data-part="disc"]');
    const pores = () => document.querySelector('#world > g[data-kind="player"] [data-part="pores"]');
    g.enemies.clear();
    g.placePlayer(600, 800);
    s.player.hp = s.player.hpMax = 1e9;
    await sleep(300);
    const standing = disc()?.getAttribute('transform') ?? null;
    // walk: edge-on, the craters turn
    s.player.target = { x: 1000, y: 800 };
    const tfs = new Set();
    const rolls = new Set();
    for (let i = 0; i < 40; i++) {
      await raf();
      tfs.add(disc()?.getAttribute('transform'));
      rolls.add(pores()?.getAttribute('transform'));
    }
    const walking = disc()?.getAttribute('transform') ?? null;
    s.player.target = null;
    await sleep(500);
    const flat = disc()?.getAttribute('transform') ?? null;
    // the flip of the auto-attack
    const [id] = g.enemies.spawnFamily('urzadzenia', 1);
    const e = s.enemies.find((x) => x.id === id);
    e.x = s.player.x + 44;
    e.y = s.player.y;
    e.home = { x: e.x, y: e.y };
    e.hp = e.hpMax = 1e9;
    e.attackTimer = 99;
    await sleep(700);
    const flips = [];
    let slap = 0;
    g.attack('player');
    const t0 = performance.now();
    while (performance.now() - t0 < 300) {
      await raf();
      const m = /scale\(([-\d.]+) ([-\d.]+)\)/.exec(disc()?.getAttribute('transform') ?? '');
      if (m) flips.push(Number(m[2]));
      slap = Math.max(slap, document.querySelectorAll('#fx .attack-ink').length);
    }
    return { standing, walking, flat, tfs: tfs.size, rolls: rolls.size, minFlip: Math.min(...flips), maxFlip: Math.max(...flips), slap };
  });
  check('nalesnik: standing it lies flat, the full disc', nal.standing === 'scale(1 1)' && nal.flat === 'scale(1 1)', JSON.stringify(nal));
  check('nalesnik: walking it is edge-on (0.35) and the craters turn', /^scale\(0\.35 1\)$/.test(nal.walking ?? '') && nal.rolls > 5, JSON.stringify(nal));
  check('nalesnik: the auto-attack turns the disc over (vertical scale passes through negative to 1) with an ink slap', nal.minFlip < -0.5 && nal.maxFlip > 0.9 && nal.slap >= 1, JSON.stringify(nal));
  const skills = await page.evaluate(async () => {
    const g = window.__game;
    const s = g.state();
    const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    g.enemies.clear();
    s.page.obstacles.length = 0; // nothing for the roll to bounce off
    g.placePlayer(600, 800);
    const ids = g.enemies.spawnFamily('urzadzenia', 3);
    ids.forEach((id, i) => {
      const e = s.enemies.find((x) => x.id === id);
      e.x = 680 + i * 40;
      e.y = 800 + (i - 1) * 14;
      e.home = { x: e.x, y: e.y };
      e.hp = e.hpMax = 1e9;
    });
    await new Promise((r) => setTimeout(r, 600));
    const out = {};
    out.orbita = g.aimCast(1, { kind: 'kierunek', dx: 1, dy: 0 });
    await new Promise((r) => setTimeout(r, 700));
    out.satellite = s.hero.orbit !== null;
    out.gravity = g.hero.cast(2) && s.hero.gravity !== null;
    await new Promise((r) => setTimeout(r, 300));
    out.flag = g.aimCast(3, { kind: 'wskazanie', x: s.player.x + 100, y: s.player.y }) && s.zones.some((z) => z.variant === 'wniosek');
    await raf();
    await raf();
    out.flagDrawn = document.querySelectorAll('#world .zone-wniosek').length;
    return out;
  });
  check('nalesnik: Orbita rolls and catches a satellite, Grawitacja pulls, Wniosek plants one flag that is drawn', skills.orbita && skills.satellite && skills.gravity && skills.flag && skills.flagDrawn === 1, JSON.stringify(skills));
  await shot('16-nalesnik-skills');

  // ---------- 6e. every hero casts every skill (S1 registry) ----------
  const castAll = {};
  for (const [i, id] of ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'].entries()) {
    await page.evaluate((a) => window.__game.start(30 + a.i, { heroId: a.id }), { i, id });
    await sleep(300);
    // a law may open its banner on the first page: answer it as the player would
    if (await page.evaluate(() => window.__game.state().modal === 'cookies')) await page.locator('.cookie button').last().click({ timeout: 3000 });
    castAll[id] = await page.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
      g.placePlayer(600, 800);
      g.hero.spawn(6);
      const st0 = s.status;
      g.hero.installSkill(3);
      g.hero.installSkill(4);
      const out = { hero: g.hero.info().heroId, cast: [], cd: [], st0, st1: s.status };
      const ids = g.hero.info().skillIds;
      out.para = [];
      // every skill with each of its three paragraphs (S2): the patched cast fires and starts a cooldown too
      for (const n of [1, 2, 3]) {
        for (let k = 0; k < 5; k++) {
          g.hero.assignPad(1, k);
          if (!g.hero.setParagraph(ids[k], n, true)) out.para.push(`${ids[k]}:${n}`);
          for (const e of s.enemies) e.hp = e.hpMax = 1e9;
          s.hero.cd.fill(0); // the previous skill's cooldown is not what is tested
          const ok = g.hero.cast(1);
          if (!ok && !out.why) out.why = { k, n, pend: s.hero.pendingLevels, off: g.hero.info().offer, lvl: s.player.level, t: s.time, status: s.status, modal: s.modal, phase: s.phase, bot: s.law.botTime, cd: [...s.hero.cd], pads: [...s.hero.pads], ranks: [...s.hero.ranks] };
          out.cast.push(ok);
          out.cd.push(g.hero.info().cd[k] > 0);
          g.advance(0.5);
        }
      }
      out.active = g.hero.info().paragraphs;
      return out;
    });
    const r = castAll[id];
    check(`${id}: all five skills cast and start a cooldown with § 1, § 2 and § 3`, r.hero === id && r.cast.length === 15 && r.cast.every(Boolean) && r.cd.every(Boolean) && r.para.length === 0 && r.active.every((n) => n === 3), JSON.stringify(r));
  }
  await shot('16b-every-hero-cast');

  // ---------- 6f. Konfiguracja and the Karta uprawnień (S4): a pad and a column changed at the desk hold in the run and after a reload ----------
  await page.evaluate(() => window.__game.startBase());
  await sleep(700);
  await page.evaluate(() => window.__game.station('biurko'));
  await page.locator('[data-desk=konfiguracja]').click({ timeout: 3000 });
  await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
  const lo0 = await page.evaluate(() => window.__game.loadoutInfo());
  const kfRow = await page.evaluate(() => [...document.querySelectorAll('.kf-sheet .kf-row')].find((r) => !r.classList.contains('off') && !r.querySelector('.kf-pad.on[data-pad="1"]'))?.dataset.skill);
  await page.locator(`.kf-sheet .kf-row[data-skill="${kfRow}"] .kf-pad[data-pad="1"]`).click({ timeout: 3000 });
  if ((await page.locator('.kf-sheet .kf-spec.on').count()) > 0) await page.locator('.kf-sheet .kf-spec.on').click({ timeout: 3000 }); // start from no column
  const kfSpec = await page.evaluate(() => [...document.querySelectorAll('.kf-sheet .kf-spec')].find((b) => parseInt(b.querySelector('.kf-spec-n').textContent, 10) >= 2)?.dataset.spec);
  await page.locator(`.kf-sheet .kf-spec[data-spec="${kfSpec}"]`).click({ timeout: 3000 });
  await sleep(300);
  const lo1 = await page.evaluate(() => window.__game.loadoutInfo());
  const kfShown = await page.evaluate(() => ({
    slot1: document.querySelector('.kf-sheet .kf-slot[data-slot="1"] .kf-slotv')?.textContent,
    row1: document.querySelector('.kf-sheet .kf-row .kf-pad.on[data-pad="1"]')?.closest('.kf-row')?.querySelector('.kf-name')?.textContent,
    granted: !!document.querySelector('.kf-sheet .kf-cap-line i.granted'),
    pressed: document.querySelector('.kf-sheet .kf-spec.on')?.dataset.spec,
  }));
  check(
    'Konfiguracja: a pad and a column changed at the desk; the run state, the slot line and the capstone line agree',
    lo1 !== null && lo1.pads.join() !== lo0.pads.join() && lo1.specialization === kfSpec && lo1.capstone !== null && kfShown.slot1 === kfShown.row1 && kfShown.granted && kfShown.pressed === kfSpec,
    JSON.stringify({ before: lo0, after: lo1, kfRow, kfSpec, kfShown }),
  );
  await shot('19-konfiguracja-loadout');
  await page.locator('.kf-back').click({ timeout: 3000 });
  await sleep(300);
  // the chart from the desk: stamps on what is held, the chosen column's capstone granted
  await page.locator('[data-desk=karta]').click({ timeout: 3000 });
  await page.locator('.kt-sheet .kt-col').first().waitFor({ state: 'visible', timeout: 3000 });
  const kt = await page.evaluate((spec) => ({
    cols: document.querySelectorAll('.kt-sheet .kt-col').length,
    approved: [...document.querySelectorAll('.kt-sheet .kt-node.skill[data-state=granted] .kt-stamp')].filter((n) => /ZATWIERDZONO/.test(n.textContent)).length,
    gated: document.querySelectorAll('.kt-sheet .kt-node[data-state=gated] .kt-gate').length,
    cap: document.querySelector(`.kt-sheet .kt-cap[data-capstone="${spec}"]`)?.classList.contains('granted'),
    caps: document.querySelectorAll('.kt-sheet .kt-cap.granted').length,
    desk: !!document.querySelector('.desk-sheet:not(.hidden)'),
  }), kfSpec);
  check('Karta uprawnień: three columns, ZATWIERDZONO on unlocked skills, one capstone granted (the chosen column), over the hidden desk', kt.cols === 3 && kt.approved >= 3 && kt.cap === true && kt.caps === 1 && !kt.desk, JSON.stringify(kt));
  await shot('20-karta');
  await page.locator('.kt-back').click({ timeout: 3000 });
  await sleep(300);
  check('Wróć from the chart shows the desk again', await page.evaluate(() => !document.querySelector('.kt-sheet') && !!document.querySelector('.desk-sheet:not(.hidden)')));
  await page.locator('.desk-sheet .ps-close').first().click({ timeout: 1500 }).catch(() => undefined);
  await page.evaluate(() => {
    window.__game.acceptTicket();
    window.__game.walkToExit();
  });
  await sleep(1800);
  const lo2 = await page.evaluate(() => ({ phase: window.__game.state().phase, ...window.__game.loadoutInfo() }));
  check('the run starts with the desk loadout: same pads, the capstone in force', lo2.phase === 'run' && lo2.pads.join() === lo1.pads.join() && lo2.capstone === lo1.capstone && lo2.specialization === kfSpec, JSON.stringify(lo2));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => window.__game.startBase());
  await sleep(700);
  const lo3 = await page.evaluate(() => window.__game.loadoutInfo());
  check('after a reload the character keeps the pads and the column', lo3 !== null && lo3.pads.join() === lo1.pads.join() && lo3.specialization === kfSpec && lo3.capstone === lo1.capstone, JSON.stringify(lo3));

  // ---------- 6g. S5: potwierdzenia, damage numbers, text size, export/import ----------
  await page.evaluate(() => window.__game.start(13, { pageCount: 5, lawId: 'grawitacja' }));
  await sleep(1500);
  await settle();
  // damage numbers: off by default, a digit beside the hit when on
  const dmgOff = await page.evaluate(() => {
    window.__game.hitEnemy();
    return [...document.querySelectorAll('.dmg')].filter((n) => n.style.opacity !== '0').length;
  });
  await page.evaluate(() => window.__game.setSettings({ damageNumbers: true }));
  const dmgOn = await page.evaluate(() => {
    window.__game.hitEnemy();
    return [...document.querySelectorAll('.dmg')].filter((n) => n.style.opacity !== '0').map((n) => n.querySelector('.t-dmg')?.textContent ?? '');
  });
  check('damage numbers: none while off; a handwritten digit beside the hit when on', dmgOff === 0 && dmgOn.length === 1 && /^\d+$/.test(dmgOn[0]), JSON.stringify({ dmgOff, dmgOn }));
  await page.evaluate(() => window.__game.setSettings({ damageNumbers: false }));
  // text size: the step sets --ts on the root
  const ts = await page.evaluate(() => {
    const read = () => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim();
    window.__game.setSettings({ textSize: 2 });
    const big = read();
    window.__game.setSettings({ textSize: 0 });
    return { big, normal: read() };
  });
  check('text size: the largest step sets --ts 1.3, the first 1', ts.big === '1.3' && ts.normal === '1', JSON.stringify(ts));
  await page.evaluate(() => {
    const s = window.__game.state();
    s.enemies.length = 0;
    window.__game.setHeldPotwierdzenia(0);
  });
  // drop -> heal: hurt, a slip laid 60 units off is pulled in and restores a quarter
  const rc1 = await page.evaluate(() => {
    const g = window.__game;
    const p = g.state().player;
    g.hurtPlayer(Math.round(p.hpMax * 0.5));
    return { hp: p.hp, max: p.hpMax };
  });
  await page.evaluate(() => window.__game.dropPotwierdzenie(60));
  await sleep(900);
  const rc2 = await page.evaluate(() => ({ hp: window.__game.state().player.hp, left: window.__game.state().pickups.filter((k) => k.potwierdzenie).length, held: window.__game.heldPotwierdzenia() }));
  check('potwierdzenie: a dropped slip is pulled in and heals 25% of racja', rc2.left === 0 && rc2.held === 0 && Math.abs(rc2.hp - rc1.hp - Math.round(rc1.max * 0.25)) < 1.5, JSON.stringify({ rc1, rc2 }));
  // full -> held
  await page.evaluate(() => {
    const p = window.__game.state().player;
    p.hp = p.hpMax;
    window.__game.dropPotwierdzenie(60);
  });
  await sleep(900);
  const held1 = await page.evaluate(() => ({ held: window.__game.heldPotwierdzenia(), slips: document.querySelectorAll('.potw-btn .slip').length }));
  check('potwierdzenie: taken at full racja it is held and drawn on the HUD note', held1.held === 1 && held1.slips === 1, JSON.stringify(held1));
  // tap use
  const tap0 = await page.evaluate(() => {
    const g = window.__game;
    const p = g.state().player;
    g.hurtPlayer(Math.round(p.hpMax * 0.4));
    return p.hp;
  });
  await page.locator('.potw-btn').tap({ timeout: 2000 });
  await sleep(200);
  const tap1 = await page.evaluate(() => ({ hp: window.__game.state().player.hp, held: window.__game.heldPotwierdzenia() }));
  check('potwierdzenie: a tap on the note uses the held slip and heals', tap1.held === 0 && tap1.hp > tap0, JSON.stringify({ tap0, ...tap1 }));
  // auto-use below 15%
  const auto = await page.evaluate(() => {
    const g = window.__game;
    const p = g.state().player;
    p.hp = p.hpMax;
    g.setHeldPotwierdzenia(3);
    const notes0 = g.notes().length;
    g.hurtPlayer(Math.round(p.hpMax * 0.9));
    return { held: g.heldPotwierdzenia(), hp: p.hp, max: p.hpMax, notes: g.notes().length - notes0 };
  });
  await sleep(200);
  const stackShown = await page.evaluate(() => ({ slips: document.querySelectorAll('.potw-btn .slip').length, count: document.querySelector('.potw-btn .count')?.textContent ?? '' }));
  check('potwierdzenie: a blow that would leave under 15% uses one first, with a footnote', auto.held === 2 && auto.hp > 0 && auto.notes >= 1, JSON.stringify(auto));
  check('potwierdzenie: two held read as two drawn slips and a typed count', stackShown.slips === 2 && stackShown.count.includes('2'), JSON.stringify(stackShown));
  await shot('21-potwierdzenia');
  // the bug line on the pause sheet
  await page.evaluate(() => window.__game.pause());
  await sleep(300);
  check('pause: "Zgłoś problem z grą" is on the sheet', (await page.locator('[data-pause=report]').count()) === 1);
  await page.evaluate(() => window.__game.resume());
  // export -> import equality: the archive read back replaces the save and exports the same
  await page.evaluate(() => window.__game.startBase());
  await sleep(700);
  const arch = await page.evaluate(() => {
    const g = window.__game;
    const a = g.exportArchive();
    g.setSettings({ textSize: 1 }); // the save moves on after the export
    const changed = g.meta().settings.textSize;
    const ok = g.importArchive(a);
    const b = g.exportArchive();
    const refused = g.importArchive('{"kind":"other"}');
    const ma = JSON.parse(a).meta;
    const mb = JSON.parse(b).meta;
    const keys = (x, y, pre) => Object.keys({ ...x, ...y }).flatMap((k) => (JSON.stringify(x?.[k]) === JSON.stringify(y?.[k]) ? [] : x?.[k] && typeof x[k] === 'object' && !Array.isArray(x[k]) ? keys(x[k], y?.[k], `${pre}${k}.`) : [`${pre}${k}: ${JSON.stringify(x?.[k])?.slice(0, 60)} -> ${JSON.stringify(y?.[k])?.slice(0, 60)}`]));
    const differ = keys(ma, mb, '');
    return { ok, refused, changed, same: differ.length === 0, differ, screen: g.screen(), ts: g.meta().settings.textSize ?? 0, desk: !!document.querySelector('.desk-sheet') };
  });
  check('archive: export -> import gives back the same save, the base is printed again with the desk open; a foreign file is refused', arch.ok && !arch.refused && arch.same && arch.changed === 1 && arch.ts === 0 && arch.screen === 'baza' && arch.desk, JSON.stringify(arch));
  await page.locator('.desk-sheet .ps-close').first().click({ timeout: 1500 }).catch(() => undefined);

  // ---------- 6h. S6: the roster settles a held run, a second case file keeps its own progress, the archive moves an item ----------
  await page.evaluate(() => window.__game.start(17, { pageCount: 5 }));
  await sleep(1500);
  await settle();
  const r0 = await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    window.__keep = s;
    g.setLevel(4); // a level the new file must not share
    return { level: s.player.level, ticket: s.ticket.number, opened: g.openTunnel() };
  });
  const rHeld = await page.evaluate(() => window.__game.enterTunnel());
  await sleep(500);
  await page.evaluate(() => window.__game.station('biurko'));
  await page.locator('[data-desk=roster]').click({ timeout: 3000 });
  await page.locator('.roster .rs-case').first().waitFor({ state: 'visible', timeout: 3000 });
  const r1 = await page.evaluate(() => {
    const g = window.__game;
    return { screen: g.screen(), state: g.state() === null, bm: g.meta().bookmark?.ticketNumber ?? null, back: g.returnFromTunnel(), files: document.querySelectorAll('.roster .rs-case').length, active: document.querySelector('.roster .rs-case.active')?.dataset.case ?? null };
  });
  check('the roster opens from the desk over a held run: the run is settled with a bookmark, nothing stays live or held', r0.opened && rHeld && r1.screen === 'profile' && r1.state && r1.bm === r0.ticket && !r1.back && r1.files >= 1 && r1.active !== null, JSON.stringify({ r0, rHeld, r1 }));
  await shot('21-roster');
  await page.locator('[data-roster=new]').click({ timeout: 3000 });
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 3000 });
  await page.locator('button.choose').locator('visible=true').last().click({ timeout: 3000 });
  await page.waitForFunction(() => window.__game.screen() === 'baza', null, { timeout: 5000 }).catch(() => undefined);
  await sleep(500);
  const r2 = await page.evaluate(() => {
    const m = window.__game.meta();
    return { screen: window.__game.screen(), files: m.characters.length, active: m.activeCharacterId, level: m.character?.level ?? 0, bag: m.character?.inventory.length ?? -1, bm: !!m.bookmark };
  });
  check('a new case file starts at level 1 with an empty bag and no bookmark, and becomes the active one', r2.screen === 'baza' && r2.files === r1.files + 1 && r2.active !== r1.active && r2.level === 1 && r2.bag === 0 && !r2.bm, JSON.stringify(r2));
  await page.evaluate(() => window.__game.station('biurko'));
  await page.locator('[data-desk=roster]').click({ timeout: 3000 });
  await page.locator(`.roster .rs-case[data-case="${r1.active}"] [data-roster=open]`).click({ timeout: 3000 });
  await page.waitForFunction(() => window.__game.screen() === 'baza', null, { timeout: 5000 }).catch(() => undefined);
  await sleep(500);
  const r3 = await page.evaluate(() => {
    const m = window.__game.meta();
    return { active: m.activeCharacterId, level: m.character?.level ?? 0, bm: m.bookmark?.ticketNumber ?? null, files: m.characters.length };
  });
  check('opening the first file again gives back its level and its bookmark; the new file stays in the roster', r3.active === r1.active && r0.level === 4 && r3.level === r0.level && r3.bm === r0.ticket && r3.files === r2.files, JSON.stringify({ r0, r3 }));
  // the archive: an item of the bag goes to the personal archive and the live bag follows
  await page.evaluate(() => window.__game.giveItem?.());
  await page.evaluate(() => window.__game.station('biurko'));
  await page.locator('[data-desk=archiwum]').click({ timeout: 3000 });
  await page.locator('.ar-sheet').waitFor({ state: 'visible', timeout: 3000 });
  const a0 = await page.evaluate(() => ({ bag: window.__game.state().player.inventory.length, personal: document.querySelectorAll('.ar-sheet .ar-sec[data-place=personal] .ar-cell[data-uid]').length }));
  if (a0.bag > 0) {
    await page.locator('.ar-sheet .ar-sec[data-place=bag] .ar-cell[data-uid]').first().click({ timeout: 3000 });
    await page.locator('.ar-sheet .ar-move[data-to=personal]').click({ timeout: 3000 });
    await sleep(300);
  }
  const a1 = await page.evaluate(() => ({ bag: window.__game.state().player.inventory.length, stored: window.__game.meta().character?.inventory.length ?? -1, personal: document.querySelectorAll('.ar-sheet .ar-sec[data-place=personal] .ar-cell[data-uid]').length }));
  check('Archiwum: an item moved from the bag to the personal archive leaves the live bag and the stored one', a0.bag > 0 && a1.bag === a0.bag - 1 && a1.stored === a1.bag && a1.personal === a0.personal + 1, JSON.stringify({ a0, a1 }));
  await shot('22-archive');
  await page.locator('.ar-sheet .ps-close').first().click({ timeout: 1500 }).catch(() => undefined);
  await sleep(300);
  await page.locator('.desk-sheet .ps-close').first().click({ timeout: 1500 }).catch(() => undefined);

  // ---------- 7. frame time with 40 enemies ----------
  // a fresh run: the death slip of the step above may still hold the old one
  await page.evaluate(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
  await sleep(1500);
  await settle();
  await page.evaluate(() => {
    const g = window.__game;
    const s = g.state();
    if (!s) return;
    g.enemies.clear();
    s.player.hp = s.player.hpMax = 1e9; // stay alive for the whole measurement
    s.hero.pendingLevels = 0;
    for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) g.enemies.spawnFamily(f, f === 'urzadzenia' ? 14 : 13);
    for (const e of s.enemies) e.hp = e.hpMax = 1e9; // nobody dies during the measurement
  });
  await sleep(1500); // let them be drawn in
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const m0 = await metrics();
  const perf = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - t0 < 5000) requestAnimationFrame(tick);
          else resolve({ deltas, enemies: window.__game.state()?.enemies.length ?? 0 });
        };
        requestAnimationFrame(tick);
      }),
  );
  const m1 = await metrics();
  const d = perf.deltas.slice(1).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)] ?? 0;
  const frames = d.length;
  const per = (k) => (((m1[k] ?? 0) - (m0[k] ?? 0)) * 1000) / frames;
  console.log(
    `PERF ${perf.enemies} enemies: frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${frames} frames; main thread per frame: task ${per('TaskDuration').toFixed(2)} ms (script ${per('ScriptDuration').toFixed(2)}, layout ${per('LayoutDuration').toFixed(2)}, style ${per('RecalcStyleDuration').toFixed(2)})`,
  );
  await shot('14-forty-enemies');
  check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
  if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 15)) console.log(' -', p.slice(0, 300));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'SMOKE PASSED' : `SMOKE FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
