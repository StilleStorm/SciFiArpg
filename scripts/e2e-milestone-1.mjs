// Milestone 1 (Systems core, slices S1-S5) end-to-end gate. For each of the five heroes, in portrait and in landscape:
// title -> profile (roster) -> base -> desk Konfiguracja (a pad, a specialization column, a paragraph) -> accept a ticket ->
// two page turns -> level 12 (hook) -> Argument meter filled by rebuttals -> the ultimate cast with a real tap -> potwierdzenia
// (drop -> heal, full -> held, tap use, auto-use) -> pause -> resume -> tunnel round trip -> boss -> base -> reload: the
// loadout, the capstone, the paragraphs and the held slips must have survived. Then the 40-enemy frame time, once per orientation.
// Usage: npm run e2e:m1 (builds into dist-m1 first). Env: M1_PORT (4177), M1_OUT (dist-m1), M1_DIR (shots-m1),
// M1_ONLY ("pralka" or "pralka:landscape" to run one leg), PERF_MAX_MS (fail above this average frame time).
// Exits non-zero on any failed check or page/console error. Pictures go to shots-m1/.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.M1_PORT ?? 4177);
const OUT = process.env.M1_OUT ?? 'dist-m1';
const SHOTS = process.env.M1_DIR ?? 'shots-m1';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const ONLY = process.env.M1_ONLY ?? '';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const HEROES = ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'];
const ORIENTS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

const problems = [];
const checks = [];
let tag = '';
const check = (name, ok, detail = '') => {
  checks.push({ name: `[${tag}] ${name}`, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${tag}] ${name}${detail ? ` (${detail})` : ''}`);
};

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

/** One hero in one orientation, start to finish. Returns the page so the caller can measure frame time on it. */
async function leg(browser, heroId, orient, measure) {
  tag = `${heroId} ${orient}`;
  const t0 = Date.now();
  const ctx = await browser.newContext({
    viewport: ORIENTS[orient],
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(() => {
    Math.random = () => 0.4242;
    Date.now = () => 1.75e12;
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('Service Worker registration blocked')) return;
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${tag}] console.${m.type()}: ${m.text()}`);
  });
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${heroId}-${orient}-${name}.png` });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const screen = () => ev(() => window.__game.screen());
  const runState = () =>
    ev(() => {
      const s = window.__game.state();
      return s && { status: s.status, modal: s.modal, hp: s.player.hp, level: s.player.level, pending: s.hero.pendingLevels, page: s.pageIndex, pages: s.pageCount, victoryAt: s.victoryAt, boss: s.enemies.some((e) => e.boss), phase: s.phase, time: s.time };
    });
  const clickText = (txt) => page.locator('#ui').getByText(txt, { exact: false }).locator('visible=true').first().click({ timeout: 5000 });

  /** Take whatever holds the run (a law sheet, the update form). */
  async function settle() {
    let closed = 0;
    for (let k = 0; k < 8; k++) {
      const st = await runState();
      if (!st) return closed;
      const later = page.locator('.sheet.assigning:not(.hidden) .report.later');
      if (await later.isVisible().catch(() => false)) {
        await later.click({ timeout: 2000 });
        await sleep(300);
        closed++;
        continue;
      }
      const form = page.locator('.sheet:not(.hidden) .entry').first();
      if (await form.isVisible().catch(() => false)) {
        await page.locator('.sheet:not(.hidden) .entry:not(.locked)').first().click({ timeout: 2000 });
        await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 });
        await sleep(1300);
        closed++;
        continue;
      }
      if (st.modal) {
        await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
        await sleep(400);
        closed++;
        continue;
      }
      return closed;
    }
    return closed;
  }

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await ev(() => document.fonts.ready);
  const orientAttr = await ev(() => document.documentElement.dataset.orient ?? '');
  check('the layout follows the screen shape', orientAttr === orient, orientAttr);

  // ---- title -> roster/profile -> base ----
  await sleep(1200);
  await clickText('Rozpocznij');
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 5000 });
  const idx = HEROES.indexOf(heroId);
  for (let i = 0; i < idx; i++) {
    await page.locator('button.arrow').locator('visible=true').last().click({ timeout: 3000 });
    await sleep(120);
  }
  await sleep(500);
  const prof = await ev(() => {
    const b = document.querySelector('button.choose')?.getBoundingClientRect();
    return { name: document.querySelector('.profile .name')?.textContent ?? '', counter: document.querySelector('.profile .head span:last-child')?.textContent ?? '', inside: !!b && b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth };
  });
  check('the roster shows the hero and the choose button is on screen', prof.name.length > 0 && prof.inside, JSON.stringify(prof));
  await shot('01-profile');
  await page.locator('button.choose').locator('visible=true').first().click();
  await page.waitForFunction(() => window.__game.screen() === 'baza', null, { timeout: 8000 }).catch(() => undefined);
  await sleep(700);
  await page.locator('.card-layer .card-skip').click({ timeout: 2500 }).catch(() => undefined); // the opening page of the first base
  await sleep(400);
  const base0 = await ev(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), phase: s?.phase, hero: s?.player.heroId, open: s?.pageIndex === 0 && document.querySelector('#page [data-exit-base]') !== null && !document.querySelector('#page .base-exit-note') };
  });
  check('the chosen hero stands in the base, the exit is open', base0.screen === 'baza' && base0.phase === 'base' && base0.hero === heroId && base0.open, JSON.stringify(base0));

  // ---- desk Konfiguracja: a pad, a column, a paragraph ----
  await ev(() => window.__game.setSteering('tap'));
  await ev(() => {
    const g = window.__game;
    g.hero.installSkill(3);
    g.hero.installSkill(4);
    g.setLevel(12);
    g.state().hero.pendingLevels = 0;
  });
  await sleep(300);
  await ev(() => {
    const g = window.__game;
    const s = g.state();
    const st = s.page.base.stations.find((x) => x.id === 'biurko');
    g.placePlayer(st.x, st.y + 110);
  });
  await sleep(1300);
  const desk = await ev(() => {
    const st = window.__game.state().page.base.stations.find((x) => x.id === 'biurko');
    const m = document.getElementById('stage').getScreenCTM();
    return { x: m.a * st.x + m.e, y: m.d * st.y + m.f };
  });
  await page.touchscreen.tap(desk.x, desk.y);
  await page.waitForFunction(() => document.querySelector('.desk-sheet') !== null, null, { timeout: 8000 }).catch(() => undefined);
  check('a real tap on the desk opens its sheet', await ev(() => document.querySelector('.desk-sheet') !== null));
  await page.locator('[data-desk=konfiguracja]').click({ timeout: 3000 });
  await page.locator('.kf-sheet .kf-row').first().waitFor({ state: 'visible', timeout: 3000 });
  const lo0 = await ev(() => window.__game.loadoutInfo());
  const para0 = await ev(() => window.__game.hero.info().paragraphs);
  const kfRow = await ev(() => [...document.querySelectorAll('.kf-sheet .kf-row')].find((r) => !r.classList.contains('off') && !r.querySelector('.kf-pad.on[data-pad="1"]'))?.dataset.skill);
  await page.locator(`.kf-sheet .kf-row[data-skill="${kfRow}"] .kf-pad[data-pad="1"]`).click({ timeout: 3000 });
  if ((await page.locator('.kf-sheet .kf-spec.on').count()) > 0) await page.locator('.kf-sheet .kf-spec.on').click({ timeout: 3000 });
  const kfSpec = await ev(() => [...document.querySelectorAll('.kf-sheet .kf-spec')].find((b) => parseInt(b.querySelector('.kf-spec-n').textContent, 10) >= 2)?.dataset.spec);
  check('a specialization column with two skills on the pads exists', typeof kfSpec === 'string', String(kfSpec));
  if (kfSpec) await page.locator(`.kf-sheet .kf-spec[data-spec="${kfSpec}"]`).click({ timeout: 3000 });
  // a paragraph: the first open box of an installed skill (not the active one)
  const openBox = page.locator('.kf-sheet .kf-row:not(.off) .kf-box.open').first();
  const hadOpenBox = (await openBox.count()) > 0;
  check('at level 12 a paragraph box is open on some skill', hadOpenBox);
  if (hadOpenBox) {
    await openBox.scrollIntoViewIfNeeded();
    await openBox.click({ timeout: 3000 });
  }
  // the ultimate's paragraph, when one box is open
  const ultBox = page.locator('.kf-sheet .kf-ultrow .kf-box.open').first();
  const hadUltBox = (await ultBox.count()) > 0;
  if (hadUltBox) {
    await ultBox.scrollIntoViewIfNeeded();
    await ultBox.click({ timeout: 3000 });
  }
  await sleep(300);
  const lo1 = await ev(() => window.__game.loadoutInfo());
  const para1 = await ev(() => window.__game.hero.info().paragraphs);
  const ult1 = await ev(() => window.__game.ultimateInfo());
  const kfShown = await ev(() => ({
    slot1: document.querySelector('.kf-sheet .kf-slot[data-slot="1"] .kf-slotv')?.textContent,
    row1: document.querySelector('.kf-sheet .kf-row .kf-pad.on[data-pad="1"]')?.closest('.kf-row')?.querySelector('.kf-name')?.textContent,
    granted: !!document.querySelector('.kf-sheet .kf-cap-line i.granted'),
    pressed: document.querySelector('.kf-sheet .kf-spec.on')?.dataset.spec,
  }));
  check('Konfiguracja: pad moved, column chosen, capstone granted, slot line agrees', lo1.pads.join() !== lo0.pads.join() && lo1.specialization === kfSpec && lo1.capstone !== null && kfShown.slot1 === kfShown.row1 && kfShown.granted && kfShown.pressed === kfSpec, JSON.stringify({ lo0, lo1, kfShown }));
  check('Konfiguracja: the chosen paragraph is active in the state', hadOpenBox && para1.join() !== para0.join(), JSON.stringify({ para0, para1 }));
  if (hadUltBox) check('Konfiguracja: the ultimate paragraph is active', ult1.paragraph > 1, JSON.stringify(ult1));
  else console.log(`  note: [${tag}] no open ultimate paragraph box at level 12`);
  await shot('02-konfiguracja');
  await page.locator('.kf-back').click({ timeout: 3000 });
  await sleep(300);
  await clickText('Nowe zgłoszenie');
  await sleep(600);
  await clickText('Zatwierdź zmiany');
  await sleep(1800);
  check('the ticket form re-accepts the plan, the exit stays open', (await screen()) === 'baza' && (await ev(() => window.__game.state().phase === 'base' && !document.querySelector('.ticket-sheet'))));
  await ev(() => window.__game.walkToExit());
  await sleep(1800);
  await settle();

  // ---- the run: loadout in force, two pages ----
  const run0 = await ev(() => ({ phase: window.__game.state().phase, screen: window.__game.screen(), level: window.__game.state().player.level, ...window.__game.loadoutInfo(), paragraphs: window.__game.hero.info().paragraphs, pad: window.__game.ultimatePad() }));
  check('the run starts with the desk loadout, paragraphs, capstone and level 12; the ultimate pad is shown', run0.phase === 'run' && run0.screen === 'run' && run0.pads.join() === lo1.pads.join() && run0.specialization === kfSpec && run0.capstone === lo1.capstone && run0.paragraphs.join() === para1.join() && run0.level >= 12 && run0.pad?.hidden === false, JSON.stringify(run0));
  await shot('03-run');
  const pageCount = (await runState()).pages;
  check('the ticket has at least three pages', pageCount >= 3, String(pageCount));
  for (const n of [1, 2]) {
    if (n >= pageCount) break;
    await ev((i) => window.__game.turnTo(i), n);
    await sleep(1500);
    await settle();
    const p = await runState();
    check(`page ${n + 1} reached`, p.page === n && p.status === 'running', JSON.stringify(p));
  }
  await ev(() => {
    const g = window.__game;
    g.enemies.clear();
    g.state().hero.pendingLevels = 0;
  });
  await settle();
  await shot('04-page3');

  // ---- the Argument meter by rebuttals, the ultimate by a real tap ----
  await ev(() => window.__game.fillMeter(0));
  let rebuttals = 0;
  for (let k = 0; k < 20; k++) {
    const r = await ev(() => {
      const g = window.__game;
      g.enemies.clear();
      g.enemies.spawnFamily('urzadzenia', 6);
      let n = 0;
      for (const e of g.state().enemies) {
        e.hp = e.hpMax = 1e6;
        if (e.claim && !e.claim.struck && g.enemies.hit(e.id, e.claim.type, 1)) n++;
      }
      return { n, meter: g.ultimateInfo().meter };
    });
    rebuttals += r.n;
    if (r.meter >= 1) break;
  }
  await sleep(300);
  const full = await ev(() => ({ info: window.__game.ultimateInfo(), pad: window.__game.ultimatePad(), arg: document.querySelector('.hud .arg')?.classList.contains('full') ?? false }));
  check('rebuttals fill the Argument meter: pad ready, HUD line full', full.info.ready && full.pad?.ready === true && full.arg, JSON.stringify({ rebuttals, ...full }));
  await shot('05-ultimate-ready');
  const stamps0 = await ev(() => document.querySelectorAll('#fx .stamp-frame').length);
  await page.locator('.pad.ult').tap({ timeout: 3000 });
  await sleep(350);
  const cast = await ev(() => ({ info: window.__game.ultimateInfo(), pad: window.__game.ultimatePad(), stamps: document.querySelectorAll('#fx .stamp-frame').length, area: document.querySelectorAll('#fx .ult-area').length }));
  check('a real tap on the stamp pad casts: stamp lands, meter empty, pad off, an ultimate running', cast.stamps > stamps0 && cast.info.meter === 0 && cast.info.active.length >= 1 && cast.pad?.off === true, JSON.stringify({ stamps0, ...cast }));
  await shot('06-ultimate-cast');
  const castAt = await ev(() => window.__game.state().time);
  await ev(() => window.__game.enemies.clear());
  await page.waitForFunction(() => window.__game.ultimateInfo().active.length === 0, null, { timeout: 12000, polling: 100 }).catch(() => undefined);
  const ultEnd = await ev((t) => ({ active: window.__game.ultimateInfo().active.length, secs: window.__game.state().time - t }), castAt);
  await sleep(400);
  const areaGone = await ev(() => document.querySelectorAll('#fx .ult-area').length);
  check('the ultimate ends within 8 s of game time (its paragraph sets the length) and its outline is rubbed out', ultEnd.active === 0 && ultEnd.secs <= 8.2 && areaGone === 0, JSON.stringify({ ...ultEnd, areaGone }));
  await ev(() => window.__game.enemies.clear());
  await settle();

  // ---- potwierdzenia ----
  await ev(() => window.__game.setHeldPotwierdzenia(0));
  const hurt = await ev(() => {
    const g = window.__game;
    const p = g.state().player;
    g.hurtPlayer(Math.round(p.hpMax * 0.5));
    return { hp: p.hp, max: p.hpMax };
  });
  await ev(() => window.__game.dropPotwierdzenie(60));
  await sleep(900);
  const healed = await ev(() => ({ hp: window.__game.state().player.hp, left: window.__game.state().pickups.filter((k) => k.potwierdzenie).length, held: window.__game.heldPotwierdzenia() }));
  check('potwierdzenie: a dropped slip is pulled in and heals a quarter', healed.left === 0 && healed.held === 0 && Math.abs(healed.hp - hurt.hp - Math.round(hurt.max * 0.25)) < 1.5, JSON.stringify({ hurt, healed }));
  await ev(() => {
    window.__game.state().player.hp = window.__game.state().player.hpMax;
    window.__game.dropPotwierdzenie(60);
  });
  await sleep(900);
  const held1 = await ev(() => ({ held: window.__game.heldPotwierdzenia(), slips: document.querySelectorAll('.potw-btn .slip').length }));
  check('potwierdzenie: at full racja it is held and drawn on the HUD note', held1.held === 1 && held1.slips === 1, JSON.stringify(held1));
  const tap0 = await ev(() => {
    const g = window.__game;
    g.hurtPlayer(Math.round(g.state().player.hpMax * 0.4));
    return g.state().player.hp;
  });
  await page.locator('.potw-btn').tap({ timeout: 2000 });
  await sleep(200);
  const tap1 = await ev(() => ({ hp: window.__game.state().player.hp, held: window.__game.heldPotwierdzenia() }));
  check('potwierdzenie: a tap on the note uses the held slip', tap1.held === 0 && tap1.hp > tap0, JSON.stringify({ tap0, ...tap1 }));
  const auto = await ev(() => {
    const g = window.__game;
    const p = g.state().player;
    p.hp = p.hpMax;
    g.setHeldPotwierdzenia(3);
    const n0 = g.notes().length;
    g.hurtPlayer(Math.round(p.hpMax * 0.9));
    return { held: g.heldPotwierdzenia(), hp: p.hp, notes: g.notes().length - n0 };
  });
  check('potwierdzenie: a blow that would leave under 15% uses one first, with a footnote', auto.held === 2 && auto.hp > 0 && auto.notes >= 1, JSON.stringify(auto));
  await ev(() => (window.__game.state().player.hp = window.__game.state().player.hpMax));
  await shot('07-potwierdzenia');

  // ---- pause -> resume ----
  const pz0 = await runState();
  await page.locator('.hud .pause-btn').tap({ timeout: 3000 });
  await sleep(500);
  const pz1 = await ev(() => ({ status: window.__game.state().status, time: window.__game.state().time, sheet: !!document.querySelector('.pause-sheet') }));
  check('Pauza holds the run and opens the pause sheet', pz1.status === 'paused' && pz1.sheet && pz1.time >= pz0.time, JSON.stringify(pz1));
  await sleep(500);
  check('the clock stands still while paused', (await ev(() => window.__game.state().time)) === pz1.time);
  await shot('08-pause');
  await page.locator('[data-pause=resume]').tap({ timeout: 3000 });
  await sleep(600);
  const pz2 = await ev(() => ({ status: window.__game.state().status, time: window.__game.state().time, held: window.__game.heldPotwierdzenia(), sheet: !!document.querySelector('.pause-sheet:not(.hidden)') }));
  check('Wznów continues: running, the clock moves, held slips kept, sheet gone', pz2.status === 'running' && pz2.time > pz1.time && pz2.held === 2 && !pz2.sheet, JSON.stringify(pz2));

  // ---- tunnel round trip ----
  await ev(() => {
    const g = window.__game;
    g.enemies.clear();
    g.enemies.spawnFamily('urzadzenia', 3);
    window.__keep = g.state();
    window.__keepIds = g.state().enemies.map((e) => e.id).sort().join();
    g.state().player.hp = g.state().player.hpMax;
  });
  await page.locator('.hud .tunnel-btn').tap({ timeout: 3000 });
  await sleep(600);
  check('Tunel cuts a hole', await ev(() => !!window.__game.state().tunnel && document.querySelectorAll('#page .tn-hole').length === 1));
  await ev(() => {
    const g = window.__game;
    const s = g.state();
    g.placePlayer(s.tunnel.x + 90, s.tunnel.y);
    s.player.target = { x: s.tunnel.x, y: s.tunnel.y };
  });
  await page.waitForFunction(() => window.__game.screen() === 'baza', null, { timeout: 8000 }).catch(() => undefined);
  await sleep(400);
  // the enemies to keep are those standing when the run was held (the hero's copies may have felled some on the way to the hole)
  await ev(() => {
    window.__keepIds = window.__keep.enemies.map((e) => e.id).sort().join();
    window.__keepKills = window.__keep.kills;
  });
  const inBase = await ev(() => ({ screen: window.__game.screen(), phase: window.__game.state()?.phase, held: window.__keep.status, other: window.__keep !== window.__game.state(), time: window.__keep.time }));
  check('walking onto the hole holds the run and opens the base', inBase.screen === 'baza' && inBase.phase === 'base' && inBase.held === 'paused' && inBase.other, JSON.stringify(inBase));
  await ev(() => window.__game.station('biurko'));
  await sleep(500);
  await page.locator('.tunnel-return').tap({ timeout: 3000 });
  await sleep(1400);
  // a copy of the hero may fell one of the held enemies in the 1.4 s since the return: the kills account for it
  const back = await ev(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), status: s.status, same: window.__keep === s, time: s.time, tunnel: s.tunnel ?? null, held: window.__game.heldPotwierdzenia(), level: s.player.level, spec: s.hero.spec ?? null, enemies: s.enemies.length };
  });
  check('the return button puts the same run back: clock moves on, hole closed, slips, level and enemies kept', back.screen === 'run' && back.status === 'running' && back.same && back.time > inBase.time && back.time - inBase.time < 3 && back.tunnel === null && back.held === 2 && back.level >= 12 && back.spec === kfSpec && (await ev(() => { const s = window.__game.state(); const gone = window.__keepIds.split(',').filter((id) => !s.enemies.some((e) => String(e.id) === id)).length; return gone <= s.kills - window.__keepKills; })), JSON.stringify({ ...back, was: inBase.time }));
  await shot('09-tunnel-back');

  // ---- boss -> base ----
  await ev(() => window.__game.enemies.clear());
  await settle();
  await ev((n) => window.__game.turnTo(n - 1), pageCount);
  await sleep(1500);
  await settle();
  const boss = await ev(() => {
    const b = window.__game.state()?.enemies.find((e) => e.boss);
    return b ? { id: b.id, family: b.family } : null;
  });
  check('the boss spawns on the last page', boss !== null, boss ? boss.family : 'none');
  await shot('10-boss');
  let bossDead = false;
  for (let i = 0; i < 90 && boss; i++) {
    const sp = await ev(() => window.__game.spor.info());
    if (sp?.open) {
      await page.click(`.spor-reply[data-reply="${sp.correct}"]`, { timeout: 2000 }).catch(() => undefined);
      await sleep(200);
    }
    const alive = await ev((id) => {
      const g = window.__game;
      const s = g.state();
      const b = s?.enemies.find((e) => e.id === id);
      if (!s || !b) return false;
      s.player.hp = s.player.hpMax;
      g.placePlayer(b.x + 30, b.y);
      for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) g.enemies.hit(id, t, 60);
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
  for (let i = 0; i < 40 && (await screen()) !== 'baza'; i++) {
    await sleep(300);
    await settle();
  }
  check('the base is reached after the boss', (await screen()) === 'baza', await screen());
  await sleep(800);
  const atBase = await ev(() => ({ held: window.__game.heldPotwierdzenia(), saved: window.__game.character() }));
  check('the character was saved at the end of the ticket with the slips, column and paragraphs', atBase.saved !== null && atBase.saved.heroId === heroId && atBase.saved.specialization === kfSpec && (atBase.saved.potwierdzenia ?? 0) === atBase.held && atBase.held >= 1 && Object.keys(atBase.saved.paragraphs ?? {}).length >= 1, JSON.stringify({ held: atBase.held, spec: atBase.saved?.specialization, para: atBase.saved?.paragraphs, pot: atBase.saved?.potwierdzenia }));
  await shot('11-base-after-boss');

  // ---- reload: everything survives ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await ev(() => window.__game.startBase());
  await sleep(800);
  const after = await ev(() => ({
    lo: window.__game.loadoutInfo(),
    paragraphs: window.__game.hero.info().paragraphs,
    ult: window.__game.ultimateInfo(),
    held: window.__game.heldPotwierdzenia(),
    level: window.__game.state().player.level,
    hero: window.__game.state().player.heroId,
    padUlt: window.__game.ultimatePad(),
  }));
  check('after a reload: hero, level, pads, column and capstone are kept', after.hero === heroId && after.level >= 12 && after.lo.pads.join() === lo1.pads.join() && after.lo.specialization === kfSpec && after.lo.capstone === lo1.capstone, JSON.stringify({ after: after.lo, level: after.level, lo1 }));
  check('after a reload: the paragraphs are kept', after.paragraphs.join() === para1.join() && after.ult.paragraph === ult1.paragraph, JSON.stringify({ was: para1, now: after.paragraphs, ult: [ult1.paragraph, after.ult.paragraph] }));
  check('after a reload: the held slips are kept', after.held === atBase.held, JSON.stringify({ was: atBase.held, now: after.held }));
  await shot('12-after-reload');

  if (measure) {
    // ---- 40 enemies, 5 s of frame times ----
    await ev(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja' }));
    await sleep(1500);
    await settle();
    await ev(() => {
      const g = window.__game;
      const s = g.state();
      g.enemies.clear();
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
      for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) g.enemies.spawnFamily(f, f === 'urzadzenia' ? 14 : 13);
      for (const e of s.enemies) e.hp = e.hpMax = 1e9;
    });
    await sleep(1500);
    const perf = await ev(
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
    const d = perf.deltas.slice(1).sort((a, b) => a - b);
    const avg = d.reduce((a, b) => a + b, 0) / d.length;
    const p95 = d[Math.floor(d.length * 0.95)] ?? 0;
    console.log(`PERF ${orient}: ${perf.enemies} enemies, frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${d.length} frames`);
    await shot('13-forty-enemies');
    check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
    if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
  }
  console.log(`  leg ${tag}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
}

let browser;
try {
  await waitForServer(BASE);
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  for (const orient of Object.keys(ORIENTS)) {
    for (const heroId of HEROES) {
      if (ONLY && !`${heroId}:${orient}`.startsWith(ONLY)) continue;
      try {
        await leg(browser, heroId, orient, heroId === HEROES[HEROES.length - 1] || (ONLY !== '' && heroId === ONLY.split(':')[0]));
      } catch (e) {
        check('leg ran to the end', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
      }
    }
  }
} catch (e) {
  problems.push(`script: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser?.close();
  stop();
}

tag = 'all';
check('no page or console errors', problems.length === 0);
for (const p of problems.slice(0, 20)) console.log(' -', p.slice(0, 300));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'M1 E2E PASSED' : `M1 E2E FAILED (${failed.length}): ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
