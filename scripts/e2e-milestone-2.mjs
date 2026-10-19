// Milestone 2 (Campaign frame, slices S6-S10) end-to-end gate, in portrait and in landscape, on a fresh profile each:
// title -> roster (the first case file is created with a hero pick) -> opening card skipped -> a second case file on the roster
// and back to the first (separate progress) -> for each of the nine planets in sequence at priority Niski: the chapter card
// skipped with one tap, the ticket sheet (priority picker, its own planet), accept, run, a teczka opened for an item, a pack and a
// named elite on three planets (item level read off the drops), a side ticket from the board, the planet closed (victory) ->
// the return ticket to planet 1 (finale) -> the case closed -> nine planets offered for free travel, a real tap on one ->
// reload: the campaign is kept per character -> 40 enemies, 5 s of frame times.
// Usage: npm run e2e:m2 (builds into dist-m2 first). Env: M2_PORT (4192), M2_OUT (dist-m2), M2_DIR (shots-m2),
// M2_ONLY ("portrait" or "landscape"), PERF_MAX_MS (fail above this average frame time).
// Exits non-zero on any failed check or page/console error. Pictures go to shots-m2/.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.M2_PORT ?? 4192);
const OUT = process.env.M2_OUT ?? 'dist-m2';
const SHOTS = process.env.M2_DIR ?? 'shots-m2';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const ONLY = process.env.M2_ONLY ?? '';
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ORIENTS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The roster of case files: close a sheet over the base, then Pauza and Wyjdź. */
async function toRoster(page) {
  await page.locator('.ps-close').locator('visible=true').first().click({ timeout: 800 }).catch(() => undefined);
  await page.evaluate(() => window.__game.pause());
  await page.locator('[data-pause=exit]').click({ timeout: 3000 });
}

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

async function leg(browser, orient) {
  tag = orient;
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
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${orient}-${name}.png` });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const screen = () => ev(() => window.__game.screen());
  const waitScreen = (name, ms = 8000) => page.waitForFunction((n) => window.__game.screen() === n, name, { timeout: ms }).then(() => true, () => false);

  /** Take whatever holds the run (a law sheet, the update form, a modal). */
  async function settle() {
    for (let k = 0; k < 8; k++) {
      const st = await ev(() => {
        const s = window.__game.state();
        return s && { modal: s.modal };
      });
      if (!st) return;
      const later = page.locator('.sheet.assigning:not(.hidden) .report.later');
      if (await later.isVisible().catch(() => false)) {
        await later.click({ timeout: 2000 });
        await sleep(300);
        continue;
      }
      if (await page.locator('.sheet:not(.hidden) .entry').first().isVisible().catch(() => false)) {
        await page.locator('.sheet:not(.hidden) .entry:not(.locked)').first().click({ timeout: 2000 });
        await page.locator('.sheet:not(.hidden) .install').click({ timeout: 2000 });
        await sleep(1300);
        continue;
      }
      if (st.modal) {
        await page.locator('.pop-wrap .form-btn, .pop-wrap button').locator('visible=true').first().click({ timeout: 2000 }).catch(() => undefined);
        await sleep(400);
        continue;
      }
      return;
    }
  }

  /** The card layer of the base, skipped with one tap; returns its kind or null. */
  async function skipCard(wait = 1500) {
    const layer = page.locator('.card-layer');
    const shown = await layer.first().waitFor({ state: 'visible', timeout: wait }).then(() => true, () => false);
    if (!shown) return null;
    const kind = await ev(() => document.querySelector('.card-layer')?.dataset.card ?? null);
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await page.waitForFunction(() => !document.querySelector('.card-layer'), null, { timeout: 4000 }).catch(() => undefined);
    return kind;
  }

  /** Ticket sheet -> Niski -> accept -> walk to the exit -> in the run. Returns the planet line and the plan seen on the run. */
  async function takeTicket(final = false) {
    await ev(() => window.__game.go('ticket'));
    await page.locator('.ticket-sheet').waitFor({ state: 'visible', timeout: 4000 });
    const form = await ev(() => ({
      planet: document.querySelector('.ticket-sheet .tform .trow .tval')?.textContent ?? '',
      prios: [...document.querySelectorAll('.ticket-sheet .tk-prio')].map((b) => b.dataset.priority),
    }));
    await page.locator('.ticket-sheet .tk-prio[data-priority=niski]').click({ timeout: 2000 });
    const on = await ev(() => document.querySelector('.ticket-sheet .tk-prio.on')?.dataset.priority ?? '');
    await page.locator('.ticket-sheet button.start').click({ timeout: 2000 });
    await page.waitForFunction(() => window.__game.state()?.base?.accepted === true, null, { timeout: 6000 }).catch(() => undefined);
    await ev(() => window.__game.walkToExit());
    const inRun = await waitScreen('run', 8000);
    await sleep(500);
    await settle();
    const plan = await ev(() => window.__game.state()?.plan ?? null);
    return { form, on, inRun, plan, final };
  }

  /** In the run: stay alive, open a teczka for its item, optionally fight a pack and a named elite; returns item levels seen. */
  async function playRun(withElites) {
    return ev(async (withElites) => {
      const g = window.__game;
      const s = g.state();
      const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const nap = (ms) => new Promise((r) => setTimeout(r, ms));
      g.enemies.clear();
      s.pickups.length = 0;
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
      const out = { teczka: 0, objects: 0, pack: 0, named: 0, affixes: 0, levels: [], tiers: [], page: s.pageIndex };
      const folder = g.content.put('teczka', { dist: 140 });
      await raf();
      out.objects = g.content.list().length;
      g.content.tap(folder);
      let opened = false;
      for (let i = 0; i < 40 && !opened; i++) {
        await nap(100);
        opened = g.content.list().some((c) => c.id === folder && c.state === 'opened');
      }
      const items = () => s.pickups.filter((k) => k.item);
      out.teczka = opened ? items().length : 0;
      for (const k of items()) out.levels.push(k.item.level);
      if (withElites) {
        s.pickups.length = 0;
        const pack = g.enemies.spawnPack('powiadomienia', 'pilny');
        const id = g.enemies.spawnNamed('urzadzenia', 'pilny');
        await raf();
        await raf();
        const listed = g.enemies.list();
        out.pack = listed.filter((e) => pack.includes(e.id)).length;
        const named = listed.find((e) => e.id === id);
        out.named = named?.named ? 1 : 0;
        out.affixes = named?.affixes.length ?? 0;
        const kill = (i) => {
          for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) g.enemies.hit(i, t, 1e7);
        };
        for (const m of pack) kill(m);
        kill(id);
        for (const k of items()) {
          out.levels.push(k.item.level);
          out.tiers.push(k.item.tier);
        }
        g.enemies.clear();
      }
      return out;
    }, withElites);
  }

  async function closeInRun() {
    await ev(() => {
      const s = window.__game.state();
      s.victoryAt = s.time;
    });
    return waitScreen('baza', 12000);
  }

  // ---- title -> roster: the first case file ----
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await ev(() => document.fonts.ready);
  const orientAttr = await ev(() => document.documentElement.dataset.orient ?? '');
  check('the layout follows the screen shape', orientAttr === orient, orientAttr);
  await sleep(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 5000 });
  await shot('01-roster-new');
  await page.locator('button.choose').locator('visible=true').first().click();
  check('the first case file leads to the base', await waitScreen('baza'), await screen());
  await sleep(600);
  const c1 = await ev(() => {
    const m = window.__game.meta();
    return { files: m.characters.length, active: m.activeCharacterId, level: m.character?.level ?? 0, plan: window.__game.state()?.plan ?? null, seen: m.character?.campaign?.cards ?? null };
  });
  check('one case file on the roster, level 1, the desk holds the planet 1 campaign ticket, the opening card counted as seen', c1.files === 1 && c1.level === 1 && c1.plan?.kind === 'campaign' && c1.plan?.planet === 0 && c1.seen?.opening === true, JSON.stringify(c1));
  const opening = await skipCard();
  check('the opening card shows and one tap skips it', opening === 'opening', String(opening));
  await shot('02-base-planet1');

  // ---- a second case file, separate progress, back to the first ----
  await ev(() => window.__game.station('biurko'));
  await toRoster(page);
  await page.locator('.roster .rs-case').first().waitFor({ state: 'visible', timeout: 3000 });
  await shot('03-roster-list');
  await page.locator('[data-roster=new]').click({ timeout: 3000 });
  await page.locator('button.choose').locator('visible=true').last().waitFor({ timeout: 3000 });
  await page.locator('button.choose').locator('visible=true').last().click({ timeout: 3000 });
  await waitScreen('baza');
  await sleep(500);
  const c2 = await ev(() => {
    const m = window.__game.meta();
    return { files: m.characters.length, active: m.activeCharacterId, level: m.character?.level ?? 0, closed: m.character?.campaign?.closed?.length ?? 0 };
  });
  check('a second case file joins the roster at level 1, nothing closed, and becomes active', c2.files === 2 && c2.active !== c1.active && c2.level === 1 && c2.closed === 0, JSON.stringify(c2));
  await skipCard(800);
  await ev(() => window.__game.station('biurko'));
  await toRoster(page);
  await page.locator(`.roster .rs-case[data-case="${c1.active}"] [data-roster=open]`).click({ timeout: 3000 });
  await waitScreen('baza');
  await sleep(500);
  const c3 = await ev(() => ({ active: window.__game.meta().activeCharacterId, plan: window.__game.state()?.plan ?? null }));
  check('the first file is open again on planet 1', c3.active === c1.active && c3.plan?.planet === 0, JSON.stringify(c3));
  await skipCard(800);

  // ---- nine planets in sequence at Niski ----
  const planets = [];
  const levelsByPlanet = [];
  let chapterSkips = 0;
  let sideDone = 0;
  const ELITE_ON = new Set([2, 5, 8]);
  for (let p = 0; p < 9; p++) {
    tag = `${orient} planet ${p + 1}`;
    if (p > 0) {
      const kind = await skipCard();
      check('a chapter card shows on arrival and one tap skips it', kind === 'chapter', String(kind));
      if (kind === 'chapter') chapterSkips++;
    }
    const base = await ev(() => ({ screen: window.__game.screen(), plan: window.__game.state()?.plan ?? null, layer: !!document.querySelector('.card-layer'), offers: window.__game.quests.offers().length }));
    check('the base holds the campaign ticket of this planet, no card in the way, the board has side tickets', base.screen === 'baza' && base.plan?.kind === 'campaign' && base.plan?.planet === p && !base.layer && base.offers >= 1, JSON.stringify(base));
    if (p === 0 || p === 5) {
      const q = await ev(() => {
        const g = window.__game;
        const s = g.state();
        const stars0 = s.player.gwiazdki;
        const id = g.quests.accept(g.quests.offers()[0]?.id ?? 'kill');
        if (id) g.quests.finish(id);
        const reported = id ? g.quests.report(id) : false;
        return { id, reported, done: g.quests.done(), stars: s.player.gwiazdki - stars0 };
      });
      check('a side ticket from the board is taken, finished, reported and pays stars', q.id !== null && q.reported && q.stars > 0, JSON.stringify(q));
      if (q.reported) sideDone++;
    }
    const tk = await takeTicket();
    if (p === 0) await shot('04-ticket-planet1');
    planets.push(tk.form.planet);
    check('the ticket form lists four priorities, Niski picks, and the run carries Niski on this planet', tk.form.prios.length === 4 && tk.on === 'niski' && tk.inRun && tk.plan?.priority === 'niski' && tk.plan?.planet === p && tk.plan?.kind === 'campaign', JSON.stringify(tk));
    const run = await playRun(ELITE_ON.has(p));
    check('page content: a teczka is drawn, a tap walks the hero there, it opens and leaves exactly one item', run.objects >= 1 && run.teczka === 1, JSON.stringify(run));
    if (ELITE_ON.has(p)) {
      check('a pack of 3+ and a named elite with 2-3 affixes appear; the named kill leaves a nietypowy+ item', run.pack >= 3 && run.named === 1 && run.affixes >= 2 && run.affixes <= 3 && run.tiers.some((x) => x !== 'zwykly'), JSON.stringify(run));
    }
    levelsByPlanet.push(Math.max(...run.levels, 0));
    if (p === 4) await shot('05-run-planet5');
    const closed = await closeInRun();
    const after = await ev(() => {
      const m = window.__game.meta();
      return { screen: window.__game.screen(), campaign: m.character?.campaign ?? null, plan: window.__game.state()?.plan ?? null, history: m.history.length };
    });
    if (p < 8) {
      check('the ticket closes this planet once; the save holds it; the next planet is the next ticket', closed && after.campaign?.closed?.join() === Array.from({ length: p + 1 }, (_, i) => i).join() && after.campaign?.current === p + 1 && after.plan?.planet === p + 1 && after.history === p + 1, JSON.stringify(after));
    } else {
      check('planet 9 closed: the return ticket to planet 1 is on the desk (finale)', closed && after.campaign?.closed?.length === 9 && after.campaign?.finalTicket === true && !after.campaign?.caseClosed && after.plan?.kind === 'final' && after.plan?.planet === 0, JSON.stringify(after));
    }
  }
  tag = orient;
  check('nine different planets were on the ticket forms', new Set(planets).size === 9, planets.join(' | '));
  check('every chapter card (planets 2-9) was skipped by a tap', chapterSkips === 8, String(chapterSkips));
  check('items scale: the item level on the last planet is above the first', levelsByPlanet[8] > levelsByPlanet[0] && levelsByPlanet[0] > 0, levelsByPlanet.join(','));
  check('both side tickets paid', sideDone === 2, String(sideDone));

  // ---- the return ticket, the case closed, free travel ----
  tag = `${orient} final`;
  const card = await skipCard();
  console.log(`  card before the return ticket: ${card}`);
  const fin = await takeTicket(true);
  check('the return ticket takes the player to planet 1 again as the final ticket', fin.inRun && fin.plan?.kind === 'final' && fin.plan?.planet === 0, JSON.stringify(fin.plan));
  await playRun(false);
  const closedFinal = await closeInRun();
  await sleep(500);
  const done = await ev(() => {
    const c = window.__game.meta().character?.campaign ?? null;
    return { c, screen: window.__game.screen() };
  });
  check('the final ticket closes the case: caseClosed set, final ticket gone', closedFinal && done.c?.caseClosed === true && done.c?.finalTicket === false, JSON.stringify(done));
  const cardAfter = await ev(() => ({ plan: window.__game.state()?.plan ?? null }));
  const kindAfter = await skipCard(1500);
  console.log(`  after the case: plan ${JSON.stringify(cardAfter.plan)}, card ${kindAfter}`);
  check('after the case the desk holds a zgłoszenie dodatkowe (extra) and its card is the rewritten one', cardAfter.plan?.kind === 'extra' && kindAfter === 'rewritten', JSON.stringify({ plan: cardAfter.plan, kindAfter }));
  await ev(() => window.__game.go('ticket'));
  await page.locator('.ticket-sheet .tk-travel').waitFor({ state: 'visible', timeout: 4000 });
  const rows = await ev(() => document.querySelectorAll('.ticket-sheet .tk-travel-row[data-planet]').length);
  await shot('06-free-travel');
  await page.locator('.ticket-sheet .tk-travel-row[data-planet="4"] button').click({ timeout: 3000 });
  await sleep(1000);
  const trav = await ev(() => {
    const s = window.__game.state();
    return { screen: window.__game.screen(), plan: s?.plan ?? null, accepted: s?.base?.accepted ?? false, sheet: !!document.querySelector('.ticket-sheet') };
  });
  await skipCard(1200);
  check('free travel offers nine planets; a tap on planet 5 accepts a travel ticket there', rows === 9 && trav.plan?.kind === 'travel' && trav.plan?.planet === 4 && trav.accepted && !trav.sheet, JSON.stringify({ rows, trav }));
  await ev(() => window.__game.walkToExit());
  check('the travel ticket runs', await waitScreen('run', 8000));
  await sleep(500);
  await settle();
  const trun = await playRun(false);
  check('travel on planet 5 keeps the same content: a teczka opens for an item', trun.teczka === 1, JSON.stringify(trun));
  check('the travel ticket closes without touching the campaign', (await closeInRun()) && (await ev(() => window.__game.meta().character?.campaign?.caseClosed === true)));
  await sleep(500);

  // ---- reload: the roster keeps both files, each with its own campaign ----
  tag = `${orient} reload`;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await sleep(800);
  const saved = await ev(() => {
    const m = window.__game.meta();
    return m.characters.map((c) => ({ id: c.id, closed: c.character?.campaign?.closed?.length ?? -1, caseClosed: c.character?.campaign?.caseClosed ?? null }));
  });
  const first = saved.find((c) => c.id === c1.active);
  const second = saved.find((c) => c.id !== c1.active);
  check('after a reload: two files, the first has all nine planets and the case closed, the second is untouched', saved.length === 2 && first?.closed === 9 && first?.caseClosed === true && second?.closed === 0 && second?.caseClosed === false, JSON.stringify(saved));

  // ---- 40 enemies, 5 s of frame times ----
  tag = orient;
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
  await shot('07-forty-enemies');
  check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
  if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
  console.log(`  leg ${orient}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
}

let browser;
try {
  await waitForServer(BASE);
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  for (const orient of Object.keys(ORIENTS)) {
    if (ONLY && ONLY !== orient) continue;
    try {
      await leg(browser, orient);
    } catch (e) {
      check('leg ran to the end', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
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
console.log(failed.length === 0 ? 'M2 E2E PASSED' : `M2 E2E FAILED (${failed.length}): ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
