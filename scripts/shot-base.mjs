// The walkable base page (DESIGN 4.1): the three layouts in both orientations (and a wide overview), a station label on
// permanently under each station, the desk, the ticket, the Sklep and the notice board as sheets (tapping a station opens it
// at once, in both steering modes), the locked and the open dog-ear, the held run's hole
// on the base, the walk through the exit into the run and the way back through the tunnel; plus the checks that go with them.
// Usage: SHOT_PORT=4189 SHOT_OUT=dist-base SHOT_DIR=shots-base vite build --outDir dist-base && node scripts/shot-base.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.SHOT_PORT ?? 4189);
const OUT = process.env.SHOT_OUT ?? 'dist-base';
const SHOTS = process.env.SHOT_DIR ?? 'shots-base';
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

const HISTORY = [
  { number: 48213, planet: 'Planeta Dwudziesta Trzecia (Nieprzyjemna)', clause: 'parzystosc', outcome: 'ukonczono', kills: 61, pages: 5, total: 5 },
  { number: 48214, planet: 'Planeta Siódma (Domniemana)', clause: 'godziny-konsultanta', outcome: 'zgloszenie', kills: 14, pages: 2, total: 4, rewritten: true },
  { number: 48215, planet: 'Planeta Trzynasta (Sporna)', clause: 'oplata-serwisowa', outcome: 'zgloszenie', kills: 9, pages: 3, total: 6, rewritten: true },
  { number: 48216, planet: 'Planeta Dziewiąta (Zaległa)', clause: 'ciasteczka', outcome: 'ukonczono', kills: 33, pages: 4, total: 4 },
];

/** Show the whole base page: the camera only ever shows 520 units of height, so the view box is set by hand for the overview. */
async function overview(page) {
  await page.evaluate(() => {
    document.getElementById('stage').setAttribute('viewBox', '-30 -20 960 740');
    const f = document.getElementById('wobble');
    f.setAttribute('x', '-30');
    f.setAttribute('y', '-20');
    f.setAttribute('width', '960');
    f.setAttribute('height', '740');
    for (const sel of ['.hud', '.foot', '.pads']) document.querySelector(sel)?.classList.add('hidden');
  });
  await sleep(300);
}

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ executablePath: chromiumPath(), args: launchArgs });

  async function open(viewport, mobile = true) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, userAgent: UA, colorScheme: 'light', serviceWorkers: 'block' });
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
    await page.evaluate((history) => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, heroId: 'konsultant', runsCompleted: 4, history });
    }, HISTORY);
    return { ctx, page };
  }

  /** Seeds that give each of the three layouts. */
  const layoutSeeds = {};
  {
    const { ctx, page } = await open({ width: 390, height: 844 });
    for (let seed = 1; seed < 40 && Object.keys(layoutSeeds).length < 3; seed++) {
      const layout = await page.evaluate((sd) => window.__game.startBase(sd).base.layout, seed);
      if (!(layout in layoutSeeds)) layoutSeeds[layout] = seed;
    }
    await ctx.close();
  }
  console.log('layouts', JSON.stringify(layoutSeeds));
  check('three layouts are found among the first seeds', Object.keys(layoutSeeds).length === 3);

  /** One orientation: every layout, a label, the sheets, the exit, the held hole. */
  async function leg(prefix, viewport, mobile = true) {
    const { ctx, page } = await open(viewport, mobile);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${prefix}-${name}.png` });
    const state = () =>
      page.evaluate(() => {
        const s = window.__game.state();
        return s && { screen: window.__game.screen(), phase: s.phase, status: s.status, enemies: s.enemies.length, time: s.time, x: s.player.x, y: s.player.y, layout: s.base?.layout ?? null, pageIndex: s.pageIndex, locked: s.base ? !s.base.accepted : null };
      });
    const overflow = () =>
      page.evaluate(() => {
        const sheet = document.querySelector('.ps:not(.hidden), .screen:not(.hidden) .frame');
        if (!sheet) return null;
        const b = sheet.getBoundingClientRect();
        const actions = [...document.querySelectorAll('.ps .start, .ps .ps-close, .ticket .start, .ps .link-btn')].map((n) => n.getBoundingClientRect());
        return { top: b.top, bottom: b.bottom, h: window.innerHeight, w: window.innerWidth, right: b.right, buttons: actions.map((a) => ({ top: a.top, bottom: a.bottom, w: a.width, h: a.height })) };
      });

    // ---- the three layouts at the landing spot ----
    for (const [layout, seed] of Object.entries(layoutSeeds)) {
      await page.evaluate((sd) => window.__game.startBase(sd), seed);
      await sleep(1700);
      const st = await state();
      check(`${prefix}: ${layout}: the base is up, no enemies, the clock stands, the exit is locked`, st.screen === 'baza' && st.phase === 'base' && st.enemies === 0 && st.time === 0 && st.locked === true, JSON.stringify(st));
      const hud = await page.evaluate(() => ({ label: document.querySelector('.hud-row + .hud-row .field:last-child label')?.textContent, value: document.querySelector('.hud-row + .hud-row .field:last-child .val')?.textContent, tunnelHidden: document.querySelector('.tunnel-btn')?.classList.contains('hidden'), padsHidden: ['s1', 's2', 's3'].every((c) => getComputedStyle(document.querySelector(`.pad.${c}`)).display === 'none'), inv: getComputedStyle(document.querySelector('.pad.inv')).display !== 'none' }));
      check(`${prefix}: ${layout}: the HUD says Baza and the kind of place, the Tunel note and the skill pads are put away`, hud.label === 'Baza' && hud.value === { ladowisko: 'lądowisko', wioska: 'wioska', miasteczko: 'miasteczko' }[layout] && hud.tunnelHidden && hud.padsHidden && hud.inv, JSON.stringify(hud));
      await shot(layout);
    }

    // ---- the labels are always there: Space Mono capitals, 12 px on the screen, an underline, clear of each other ----
    const seed0 = layoutSeeds.wioska ?? 1;
    await page.evaluate((sd) => window.__game.startBase(sd), seed0);
    await sleep(1400);
    const labels = await page.evaluate(() => {
      const s = window.__game.state();
      return [...document.querySelectorAll('.base-label')]
        .filter((g) => g.dataset.label !== 'tunel')
        .map((g) => {
          const text = g.querySelector('text');
          const r = text.getBoundingClientRect();
          const u = g.querySelector('path').getBoundingClientRect();
          const scale = g.getScreenCTM().a;
          return { id: g.dataset.label, shown: getComputedStyle(g).display !== 'none' && Number(g.style.opacity || 1) === 1, text: text.textContent, family: getComputedStyle(text).fontFamily, px: Number(text.getAttribute('font-size')) * scale, upper: text.textContent === text.textContent.toLocaleUpperCase('pl-PL'), r: { l: r.left, t: r.top, rr: r.right, b: r.bottom }, under: u.top >= r.bottom - 6 && u.width > 20, px0: s.player.x };
        });
    });
    check(`${prefix}: all four labels are shown at once, in Space Mono capitals at 12 px, each with an underline`, labels.length === 4 && labels.every((l) => l.shown && /Space Mono/i.test(l.family) && Math.abs(l.px - 12) < 0.6 && l.upper && l.under), JSON.stringify(labels.map((l) => [l.id, l.text, l.px])));
    const overlap = labels.some((a, i) => labels.some((b, j) => i < j && a.r.l < b.r.rr && b.r.l < a.r.rr && a.r.t < b.r.b && b.r.t < a.r.b));
    check(`${prefix}: the labels do not overlap each other`, !overlap);
    await shot('label');

    // ---- a real tap on a station opens it at once, wherever the player stands; in both steering modes; walking into one is harmless ----
    const seed1 = seed0;
    for (const mode of ['tap', 'joystick']) {
      await page.evaluate((m) => window.__game.setSteering(m), mode);
      await page.evaluate((sd) => window.__game.startBase(sd), seed1);
      await sleep(900);
      const tapAt = await page.evaluate(() => {
        const s = window.__game.state();
        const st = s.page.base.stations.find((x) => x.id === 'biurko');
        const svg = document.getElementById('stage');
        const m = svg.getScreenCTM();
        return { x: m.a * st.x + m.e, y: m.d * st.y + m.f, px: s.player.x, py: s.player.y };
      });
      if (mobile) await page.touchscreen.tap(tapAt.x, tapAt.y);
      else await page.mouse.click(tapAt.x, tapAt.y);
      await sleep(400);
      const deskOpened = await page.evaluate(() => document.querySelector('.desk-sheet') !== null);
      const stood = await state();
      check(`${prefix}: ${mode}: tapping the desk from afar opens its sheet at once, the player stays where he stood`, deskOpened && Math.hypot(stood.x - tapAt.px, stood.y - tapAt.py) < 1, JSON.stringify({ deskOpened, dx: stood.x - tapAt.px }));
      if (mode === 'tap') {
        await sleep(300);
        const frozen = await state();
        await sleep(300);
        const frozen2 = await state();
        check(`${prefix}: the base holds still under the sheet`, frozen.status === 'paused' && frozen2.x === frozen.x && frozen2.y === frozen.y, frozen.status);
      }
      await page.evaluate(() => document.querySelector('.ps-close').click());
      await sleep(300);
      const back = await state();
      check(`${prefix}: ${mode}: closing the sheet gives the base back (running)`, back.status === 'running' && (await page.evaluate(() => document.querySelector('.ps') === null)));
    }
    // walking into a station opens nothing
    await page.evaluate(() => {
      const s = window.__game.state();
      const st = s.page.base.stations.find((x) => x.id === 'kiosk');
      window.__game.placePlayer(st.x, st.y + 90);
      s.player.target = { x: st.x, y: st.y };
    });
    await sleep(1500);
    check(`${prefix}: walking into a station is harmless: nothing opens`, (await page.evaluate(() => document.querySelector('.ps') === null)) && (await state()).status === 'running');
    await page.evaluate(() => window.__game.setSteering('tap'));

    // ---- the desk: no history any more ----
    await page.evaluate(() => {
      const m = window.__game.meta();
      window.__game.setMeta({ ...m, bookmark: { version: 1, ticketNumber: 48217, seed: 4, pageIndex: 2, lawId: 'ciasteczka', clockS: 61.5, planetName: 'Planeta Piąta (Wstępna)', pageCount: 5 } });
    });
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(500);
    await shot('desk');
    check(`${prefix}: the desk offers Nowe zgłoszenie, Wznów zgłoszenie and Zmień profil, and carries no history`, await page.evaluate(() => {
      const d = document.querySelector('.desk-sheet');
      const txt = d?.textContent ?? '';
      return !!d && txt.includes('Nowe zgłoszenie') && txt.includes('Wznów zgłoszenie') && txt.includes('Zmień profil') && d.querySelector('.hist-entry') === null && !txt.includes('Historia zgłoszeń');
    }));
    const ov = await overflow();
    check(`${prefix}: the desk sheet fits the screen, its buttons are on the page and at least 44 px tall`, ov && ov.bottom <= ov.h + 1 && ov.right <= ov.w + 1 && ov.buttons.every((b) => b.bottom <= ov.h && b.top >= 0 && b.h >= 43), JSON.stringify(ov));
    const scrolls = await page.evaluate(() => {
      const sc = document.querySelector('.ps-scroll');
      return sc ? { client: sc.clientHeight, scroll: sc.scrollHeight, over: getComputedStyle(sc).overflowY } : null;
    });
    check(`${prefix}: the desk scrolls in its own area`, scrolls && scrolls.over === 'auto');
    await page.evaluate(() => document.querySelector('.ps-close').click());
    await sleep(300);
    const closed = await state();
    check(`${prefix}: closing the sheet gives the base back`, closed.status === 'running' && (await page.evaluate(() => document.querySelector('.ps') === null)));

    // ---- the ticket, the locked dog-ear, the accept, the open dog-ear ----
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(300);
    await page.getByText('Nowe zgłoszenie', { exact: false }).locator('visible=true').first().click();
    await sleep(900);
    check(`${prefix}: Nowe zgłoszenie opens the ticket form as a sheet`, await page.evaluate(() => document.querySelector('.ticket-sheet') !== null));
    await shot('ticket');
    const ov2 = await overflow();
    check(`${prefix}: the ticket sheet fits the screen`, ov2 && ov2.bottom <= ov2.h + 1 && ov2.right <= ov2.w + 1, JSON.stringify(ov2));
    await page.locator('.ticket-sheet .link-btn').click();
    await sleep(500);
    check(`${prefix}: declining shows the note and keeps the exit locked`, (await page.evaluate(() => document.querySelector('.ticket-sheet .declined')?.textContent ?? '')).includes('zaakceptuj') && (await state()).locked === true);
    await page.evaluate(() => document.querySelector('.ps-close').click()); // Zamknij on the ticket goes back to the desk
    await sleep(300);
    check(`${prefix}: Zamknij on the ticket returns to the desk`, await page.evaluate(() => document.querySelector('.desk-sheet') !== null));
    await page.evaluate(() => document.querySelector('.ps-close').click());
    await sleep(300);
    // stand beside the exit and look at the dashed dog-ear
    await page.evaluate(() => {
      const e = window.__game.state().page.exit;
      window.__game.placePlayer(e.x + (e.corner[1] === 'l' ? 170 : -170), e.y - 120);
    });
    await sleep(1300);
    await shot('exit-locked');
    const lockedTurn = await page.evaluate(() => window.__game.walkToExit());
    await sleep(300);
    check(`${prefix}: walking into the locked exit does not turn the page`, lockedTurn === false && (await state()).phase === 'base');
    await shot('exit-locked-note');
    // the ticket is accepted at the desk, as in play: the clause header is printed where the player is looking (portrait)
    await page.evaluate(() => {
      const st = window.__game.state().page.base.stations.find((x) => x.id === 'biurko');
      window.__game.placePlayer(st.x + 40, st.y + 90);
    });
    await sleep(700);
    await page.evaluate(() => window.__game.station('biurko'));
    await sleep(300);
    await page.getByText('Nowe zgłoszenie', { exact: false }).locator('visible=true').first().click();
    await sleep(500);
    await page.getByText('Akceptuję regulamin', { exact: false }).locator('visible=true').first().click();
    await sleep(350);
    await shot('ticket-stamp');
    await sleep(1900);
    const acc = await page.evaluate(() => ({ sheet: document.querySelector('.ps') !== null, accepted: window.__game.state().base.accepted, header: document.querySelector('#page .base-header')?.textContent ?? '', solid: document.querySelector('#page .base-exit g:nth-child(2)')?.style.display ?? 'x' }));
    check(`${prefix}: accepting stamps, opens the exit and prints the clause header on the base page`, !acc.sheet && acc.accepted && acc.header.includes('Zgłoszenie nr') && acc.solid === '', JSON.stringify(acc));
    await shot('header');
    await page.evaluate(() => {
      const e = window.__game.state().page.exit;
      window.__game.placePlayer(e.x + (e.corner[1] === 'l' ? 170 : -170), e.y - 120);
    });
    await sleep(900);
    await shot('exit-open');

    // ---- through the exit: the run proper begins ----
    const turned = await page.evaluate(() => window.__game.walkToExit());
    await sleep(250);
    await shot('sweep');
    await sleep(2200);
    const run = await state();
    check(`${prefix}: walking through the open exit turns to page 1 and the run proper starts`, turned && run.screen === 'run' && run.phase === 'run' && run.pageIndex === 0, JSON.stringify(run));
    const hud2 = await page.evaluate(() => ({ label: document.querySelector('.hud-row + .hud-row .field:last-child label')?.textContent, tunnelShown: !document.querySelector('.tunnel-btn')?.classList.contains('hidden'), pads: getComputedStyle(document.querySelector('.pad.s1')).display !== 'none' }));
    check(`${prefix}: in the run the HUD says Strona again, with the Tunel note and the pads`, hud2.label === 'Strona' && hud2.tunnelShown && hud2.pads, JSON.stringify(hud2));
    await shot('run-page-1');

    // ---- the held run: tunnel, the base with the hole, the walk back ----
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      g.enemies.spawnFamily('urzadzenia', 3);
      window.__keep = s;
      g.openTunnel();
    });
    await sleep(700);
    await page.evaluate(() => {
      const s = window.__game.state();
      window.__game.placePlayer(s.tunnel.x + 90, s.tunnel.y);
    });
    await sleep(300);
    const entered = await page.evaluate(() => window.__game.enterTunnel());
    await sleep(1800);
    const held = await page.evaluate(() => {
      const s = window.__game.state();
      return { screen: window.__game.screen(), phase: s.phase, hole: !!s.tunnel, holes: document.querySelectorAll('#page .tn-hole').length, held: window.__keep !== s, heldTime: window.__keep.time, heldEnemies: window.__keep.enemies.length, seedSame: window.__keep.seed === s.seed, hud: document.querySelector('.tunnel-btn')?.classList.contains('hidden') };
    });
    check(`${prefix}: walking into the run's hole opens the base of the same planet with the hole drawn`, entered && held.screen === 'baza' && held.phase === 'base' && held.hole && held.holes === 1 && held.held && held.seedSame && held.hud, JSON.stringify(held));
    await shot('hole');
    await page.evaluate(() => {
      const s = window.__game.state();
      window.__game.placePlayer(s.tunnel.x - 60, s.tunnel.y + 25);
    });
    await sleep(1300);
    const holeLabel = await page.evaluate(() => {
      const g = document.querySelector('.base-label[data-label="tunel"]');
      const s = window.__game.state();
      const m = g.getAttribute('transform') ?? '';
      return { shown: getComputedStyle(g).display !== 'none', text: g.textContent, at: m, hole: [Math.round(s.tunnel.x), Math.round(s.tunnel.y)] };
    });
    check(`${prefix}: the open hole has its label under it`, holeLabel.shown && holeLabel.text === 'TUNEL' && Math.abs(Number(/translate\(([-\d.]+)/.exec(holeLabel.at)?.[1]) - holeLabel.hole[0]) < 1, JSON.stringify(holeLabel));
    await shot('hole-label');
    const t0 = await page.evaluate(() => window.__keep.time);
    await page.evaluate(() => {
      const s = window.__game.state();
      s.player.target = { x: s.tunnel.x, y: s.tunnel.y };
    });
    await page.waitForFunction(() => window.__game.screen() === 'run', null, { timeout: 8000 }).catch(() => undefined);
    await sleep(900);
    const back = await page.evaluate((t) => {
      const s = window.__game.state();
      return { screen: window.__game.screen(), same: window.__keep === s, phase: s.phase, status: s.status, timeOk: s.time >= t && s.time - t < 3, enemies: s.enemies.length, tapes: document.querySelectorAll('#page .tn-tape').length };
    }, t0);
    check(`${prefix}: walking into the base's hole returns to the same run, enemies and clock as they were, the hole taped`, back.screen === 'run' && back.same && back.phase === 'run' && back.status === 'running' && back.timeOk && back.enemies === 3 && back.tapes === 1, JSON.stringify(back));
    await shot('returned');

    // ---- the Sklep and the notice board as sheets of the base ----
    await page.evaluate((sd) => window.__game.startBase(sd), layoutSeeds.miasteczko ?? 1);
    await sleep(900);
    await page.evaluate(() => window.__game.station('kiosk'));
    await sleep(700);
    await shot('kiosk');
    const ov3 = await overflow();
    check(`${prefix}: the Sklep sheet fits the screen`, ov3 && ov3.bottom <= ov3.h + 1, JSON.stringify(ov3));
    await page.evaluate(() => document.querySelector('.ps-close').click());
    await sleep(300);
    await page.evaluate(() => window.__game.station('tablica'));
    await sleep(600);
    await shot('board');
    const boardInfo = await page.evaluate(() => ({ sheet: !!document.querySelector('.board-sheet'), notices: document.querySelectorAll('.board-notice').length, history: document.querySelectorAll('.board .hist-entry').length, heading: [...document.querySelectorAll('.board .group')].map((n) => n.textContent), settings: document.querySelector('.set-grid') !== null }));
    check(`${prefix}: the notice board opens three announcements over the Historia zgłoszeń, and no settings`, boardInfo.sheet && boardInfo.notices === 3 && boardInfo.history === HISTORY.length && boardInfo.heading.includes('Historia zgłoszeń') && !boardInfo.settings, JSON.stringify(boardInfo));
    const ovb = await overflow();
    check(`${prefix}: the notice board sheet fits the screen`, ovb && ovb.bottom <= ovb.h + 1 && ovb.right <= ovb.w + 1, JSON.stringify(ovb));
    await page.evaluate(() => document.querySelector('.ps-close').click());
    await sleep(300);
    check(`${prefix}: Zamknij closes the notice board and gives the base back`, (await state()).status === 'running' && (await page.evaluate(() => document.querySelector('.ps') === null)));
    const before = await page.evaluate(() => window.__game.notes().map((n) => n.text).join(' '));
    await page.evaluate(() => window.__game.station('paczkomat'));
    await sleep(500);
    const after = await page.evaluate(() => window.__game.notes().map((n) => n.text).join(' '));
    check(`${prefix}: the paczkomat answers with a footnote`, after.replace(/\u00a0/g, ' ').includes('Paczkomat nieczynny. Przesyłki w drodze.') && after !== before, after.slice(-80));
    await shot('paczkomat');

    // ---- the pause sheet in the base: no Zakończ ----
    await page.evaluate(() => window.__game.pause());
    await sleep(400);
    const pz = await page.evaluate(() => ({ sheet: !!document.querySelector('.pause-sheet'), end: !!document.querySelector('[data-pause=end]'), resume: !!document.querySelector('[data-pause=resume]') }));
    check(`${prefix}: Pauza works in the base and offers no Zakończ`, pz.sheet && pz.resume && !pz.end, JSON.stringify(pz));
    await shot('pause');
    await page.evaluate(() => window.__game.resume());
    await ctx.close();
  }

  await leg('portrait', { width: 390, height: 844 });
  await leg('land', { width: 844, height: 390 });

  // ---- a wide overview of every layout (a desktop-sized window shows the whole page) ----
  {
    const { ctx, page } = await open({ width: 1100, height: 860 }, false);
    for (const [layout, seed] of Object.entries(layoutSeeds)) {
      await page.evaluate((sd) => window.__game.startBase(sd), seed);
      await sleep(1700);
      await overview(page);
      await page.screenshot({ path: `${SHOTS}/wide-${layout}.png` });
    }
    await page.evaluate(() => window.__game.setTheme('night'));
    await page.evaluate((sd) => window.__game.startBase(sd), layoutSeeds.ladowisko ?? 1);
    await sleep(1700);
    await overview(page);
    await page.screenshot({ path: `${SHOTS}/wide-night.png` });
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
console.log(failed.length === 0 ? `BASE SHOTS PASSED, pictures in ${SHOTS}/` : `BASE SHOTS FAILED: ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
