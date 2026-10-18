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

  /** Take whatever holds the run: a law sheet, the update form (opened from the HUD line). Returns how many things it closed. */
  async function settle() {
    let closed = 0;
    for (let k = 0; k < 8; k++) {
      const st = await runState();
      if (!st) return closed;
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
  // a real tap on the desk: the player walks there and the desk sheet opens
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
  check('tapping the desk walks there and opens its sheet', await page.evaluate(() => document.querySelector('.desk-sheet') !== null));
  await sleep(500);
  await shot('02b-desk');
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
  await shot('06-update-available');
  await page.locator('.hud .upd').click();
  await page.locator('.sheet:not(.hidden) .entry').first().waitFor({ state: 'visible', timeout: 3000 });
  await sleep(500);
  await shot('07-update-form');
  const closedForms = await settle();
  const afterUpdate = await runState();
  check('the update form closes after installing', closedForms > 0 && afterUpdate?.status === 'running' && afterUpdate.pending === 0, `status ${afterUpdate?.status}, pending ${afterUpdate?.pending}`);

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
