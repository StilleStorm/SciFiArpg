// Milestone 3 (Akt I, slices S11-S15) end-to-end gate: the whole of Akt I from a fresh profile, in portrait and in landscape,
// for two heroes (Pralka, Kartograf). Title -> roster (hero picked with the arrows) -> opening card skipped -> planets 1-3 at
// priority Niski: the chapter card skipped with one tap, the clerk, the ticket sheet, accept, the run page by page through its
// gates (planet 2 parcel wall lifted by its key teczka, planet 3 turnstile lifted by the named elite; a held gate must stop the
// walk) to the boss (variant line, Spor comment), the boss killed, the case moved on -> the return card -> the final ticket:
// the Anomalia in its three phases (form, the hero's face, existence), the stamp, the case closed -> 40 enemies, 5 s of
// frame times. Cards are skipped, never read to the end; their text is only checked for keys and placeholders.
// Usage: npm run e2e:m3 (builds into dist-m3 first). Env: M3_PORT (4189), M3_OUT (dist-m3), M3_DIR (shots-m3),
// M3_ONLY ("portrait", "landscape", "pralka" or "kartograf"), PERF_MAX_MS. Exits non-zero on any failed check or page/console error.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';

const PORT = Number(process.env.M3_PORT ?? 4189);
const OUT = process.env.M3_OUT ?? 'dist-m3';
const SHOTS = process.env.M3_DIR ?? 'shots-m3';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const ONLY = process.env.M3_ONLY ?? '';
const HEROES = { pralka: 0, kartograf: 3 }; // index on the profile screen (src/heroes/registry.ts)
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ORIENTS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const LAST = 3; // CAMPAIGN_LAST in src/world/campaign.ts
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

async function leg(browser, orient, heroKey) {
  tag = `${orient} ${heroKey}`;
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
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${orient}-${heroKey}-${name}.png` });
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

  /** The card layer of the base, skipped with one tap; returns { kind, text } or null. */
  async function skipCard(wait = 1500) {
    const layer = page.locator('.card-layer');
    const shown = await layer.first().waitFor({ state: 'visible', timeout: wait }).then(() => true, () => false);
    if (!shown) return null;
    const got = await ev(() => ({ kind: document.querySelector('.card-layer')?.dataset.card ?? null, text: document.querySelector('.card-layer')?.textContent ?? '' }));
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await page.waitForFunction(() => !document.querySelector('.card-layer'), null, { timeout: 4000 }).catch(() => undefined);
    return got;
  }
  const clean = (text) => text.length > 60 && !/story\.|screens\.cards|\[brak/i.test(text);

  /** Ticket sheet -> Niski -> accept -> walk to the exit -> in the run. */
  async function takeTicket() {
    await ev(() => window.__game.go('ticket'));
    await page.locator('.ticket-sheet').waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('.ticket-sheet .tk-prio[data-priority=niski]').click({ timeout: 2000 });
    await page.locator('.ticket-sheet button.start').click({ timeout: 2000 });
    await page.waitForFunction(() => !document.querySelector('.ticket-sheet'), null, { timeout: 6000 }).catch(() => undefined);
    await ev(() => window.__game.walkToExit());
    const inRun = await waitScreen('run', 8000);
    await sleep(500);
    await settle();
    const plan = await ev(() => window.__game.state()?.plan ?? null);
    return { inRun, plan };
  }

  async function immortal() {
    await ev(() => {
      const s = window.__game.state();
      s.player.hp = s.player.hpMax = 1e9;
      s.hero.pendingLevels = 0;
    });
  }

  /** Walk one page to its exit with the gate pushed against (it must hold while it holds); returns what the gate did. */
  async function leavePage() {
    const log = { gate: null, heldTurned: null, lifted: false, turned: false };
    await immortal();
    const gi = await ev(() => window.__game.gate.info());
    if (gi) {
      log.gate = { kind: gi.kind, look: gi.look, holds: gi.holds };
      if (gi.holds) {
        // walk at the exit corner for 3 s with the page's enemies left alone (the gate elite must stay alive)
        const held = await ev(() => {
          const h = window.__game;
          const s = h.state();
          const e = s.page.exit;
          const from = s.pageIndex;
          const k = 200 / Math.SQRT2;
          h.placePlayer(e.x + (e.corner[1] === 'l' ? k : -k), e.y + (e.corner[0] === 't' ? k : -k));
          s.player.target = { x: e.x, y: e.y };
          h.advance(3);
          return { turned: s.pageIndex !== from || s.turning, dist: Math.hypot(s.player.x - e.x, s.player.y - e.y) };
        });
        log.heldTurned = held.turned;
        log.heldDist = Math.round(held.dist);
        await shot(`gate-${gi.kind}-held`);
        // the condition: the key teczka opened, or the named elite slain
        await ev(() => {
          const h = window.__game;
          const g = h.gate.info();
          if (g.kind === 'teczka') {
            const key = h.content.list().find((c) => c.key);
            if (key) h.content.open(key.id);
          } else if (g.kind === 'elite' && g.elite !== null) {
            for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) h.enemies.hit(g.elite, t, 1e7);
          }
          h.advance(0.3);
        });
        await sleep(400);
        await settle();
        await ev(() => window.__game.advance(0.3));
        log.lifted = await page.waitForFunction(() => window.__game.gate.info() === null, null, { timeout: 6000 }).then(() => true, () => false);
        // the wall draws away over a few seconds of game time
        await ev(() => window.__game.advance(3.2));
      } else log.lifted = true;
    }
    const from = await ev(() => window.__game.state().pageIndex);
    await ev(() => window.__game.gate.push(40));
    log.turned = await page.waitForFunction((k) => window.__game.state()?.pageIndex === k + 1 && !window.__game.state().turning, from, { timeout: 8000 }).then(() => true, () => false);
    await sleep(300);
    await settle();
    return log;
  }

  /** The boss on the last page: its variant line, the Spor comment key; then kill it. */
  async function bossPage() {
    await page.waitForFunction(() => window.__game.state()?.enemies.some((e) => e.boss), null, { timeout: 8000 }).catch(() => undefined);
    await sleep(500);
    await settle();
    await immortal();
    const boss = await ev(() => {
      const b = window.__game.state().enemies.find((e) => e.boss);
      const v = document.querySelector('[data-part=variant]');
      return b ? { id: b.id, hp: b.hpMax, variant: v?.textContent ?? null, loc: window.__game.state().page.location } : null;
    });
    let first = null;
    for (let i = 0; i < 40 && boss && !first; i++) {
      const info = await ev(() => window.__game.spor.info());
      if (info?.open && info.phase === 1) first = info;
      else await sleep(200);
    }
    const bubble = await ev(() => document.querySelector('.bubble.comment')?.textContent ?? '');
    return { boss, spor: first && { key: first.commentKey, replies: first.replies.length }, bubble };
  }

  async function killBoss() {
    for (let i = 0; i < 30; i++) {
      const left = await ev(() => {
        const h = window.__game;
        const b = h.enemies.list().find((e) => e.boss);
        if (!b) return 0;
        for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) h.enemies.hit(b.id, t, 1e7);
        h.advance(0.4);
        return h.enemies.list().filter((e) => e.boss).length;
      });
      await settle();
      if (left === 0) break;
    }
    await ev(() => window.__game.advance(3.5));
    return waitScreen('baza', 12000);
  }

  // ---- title -> roster: a hero picked with the arrows ----
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await ev(() => document.fonts.ready);
  const orientAttr = await ev(() => document.documentElement.dataset.orient ?? '');
  check('the layout follows the screen shape', orientAttr === orient, orientAttr);
  await sleep(1200);
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 });
  await page.locator('button.choose').locator('visible=true').first().waitFor({ timeout: 5000 });
  for (let k = 0; k < HEROES[heroKey]; k++) {
    await page.locator('.nav .arrow').locator('visible=true').last().click({ timeout: 3000 });
    await sleep(150);
  }
  await shot('01-profile');
  await page.locator('button.choose').locator('visible=true').first().click();
  check('the case file leads to the base', await waitScreen('baza'), await screen());
  await sleep(600);
  const c1 = await ev(() => {
    const m = window.__game.meta();
    return { hero: m.character?.heroId ?? null, files: m.characters.length, plan: window.__game.state()?.plan ?? null };
  });
  check(`the hero picked on the profile screen is ${heroKey}, planet 1 ticket on the desk`, c1.hero === heroKey && c1.files === 1 && c1.plan?.kind === 'campaign' && c1.plan?.planet === 0, JSON.stringify(c1));
  const opening = await skipCard();
  check('the opening card shows story text without keys and one tap skips it', opening?.kind === 'opening' && clean(opening.text), JSON.stringify(opening && { kind: opening.kind, len: opening.text.length }));

  // ---- planets 1-3 ----
  const EXPECT = [
    { loc: ['przedmiescie', 'magazyn'], hp: 260, variant: /^Prototyp, seria 1/, spor: 'story.p1.boss.spor1.comment', clerk: null, gate: null },
    { loc: ['magazyn', 'serwerownia'], hp: 360, variant: /^Prototyp, seria 2/, spor: 'story.p2.boss.spor1.comment', clerk: /Zaległości/, gate: 'teczka' },
    { loc: ['biuro', 'serwerownia'], hp: null, variant: /^Prototyp, seria 3/, spor: 'story.p3.boss.spor1.comment', clerk: /Aktualizacji/, gate: 'elite' },
  ];
  const levels = [];
  let chapterSkips = 0;
  for (let p = 0; p < LAST; p++) {
    tag = `${orient} ${heroKey} planet ${p + 1}`;
    const ex = EXPECT[p];
    if (p > 0) {
      const card = await skipCard();
      check('a chapter card with story text shows on arrival and one tap skips it', card?.kind === 'chapter' && clean(card.text), JSON.stringify(card && { kind: card.kind, len: card.text.length, head: card.text.slice(0, 60) }));
      if (card?.kind === 'chapter') chapterSkips++;
    }
    const base = await ev(() => ({ screen: window.__game.screen(), plan: window.__game.state()?.plan ?? null, layer: !!document.querySelector('.card-layer'), clerk: document.querySelectorAll('[data-station=urzednik]').length, offers: window.__game.quests.offers().map((o) => o.id) }));
    check('the base holds the campaign ticket of this planet, the clerk is drawn, the board has this planet side tickets', base.screen === 'baza' && base.plan?.planet === p && !base.layer && base.clerk === 1 && base.offers.filter((id) => id.startsWith(`h:p${p + 1}:`)).length === 3, JSON.stringify(base));
    await ev(() => window.__game.station('urzednik'));
    await page.locator('.npc-sheet').waitFor({ state: 'visible', timeout: 3000 });
    const clerk = await ev(() => ({ lines: document.querySelectorAll('.npc-sheet .npc-line').length, text: document.querySelector('.npc-sheet')?.textContent ?? '' }));
    check('the clerk sheet shows three story lines without keys', clerk.lines === 3 && !/story\.p\d/.test(clerk.text) && clerk.text.length > 80 && (ex.clerk === null || ex.clerk.test(clerk.text)), JSON.stringify({ lines: clerk.lines, head: clerk.text.slice(0, 80) }));
    await page.locator('.npc-sheet .ps-close').first().click().catch(() => undefined);
    await sleep(200);
    const tk = await takeTicket();
    check('the ticket sheet takes Niski and the run is this planet campaign ticket', tk.inRun && tk.plan?.priority === 'niski' && tk.plan?.planet === p && tk.plan?.kind === 'campaign', JSON.stringify(tk.plan));
    const info = await ev(() => {
      const s = window.__game.state();
      return { pages: s.pages.length, locs: s.pages.map((q) => q.location ?? null), gates: s.pages.map((q) => q.gate?.kind ?? null) };
    });
    check('the run has pages of this planet locations and the gate this planet carries (none on 1, parcels on 2, turnstile on 3)', info.pages >= 4 && ex.loc.every((l) => info.locs.includes(l)) && (ex.gate === null ? info.gates.every((g) => g === null) : info.gates.filter((g) => g === ex.gate).length === 1), JSON.stringify(info));
    // page by page through the real exit walk, gates held until their condition is met
    const gatesSeen = [];
    for (let i = 0; i < info.pages - 1; i++) {
      const lg = await leavePage();
      if (lg.gate) gatesSeen.push(lg);
      check(`page ${i + 1} is left through its exit${lg.gate ? ` (${lg.gate.kind} gate)` : ''}`, lg.turned && (lg.gate === null || (lg.gate.holds ? lg.heldTurned === false && lg.lifted : true)), JSON.stringify(lg));
    }
    check('the gate of the planet stopped the walk while it held, then lifted', ex.gate === null ? gatesSeen.length === 0 : gatesSeen.length === 1 && gatesSeen[0].gate.kind === ex.gate && gatesSeen[0].heldTurned === false && gatesSeen[0].lifted, JSON.stringify(gatesSeen));
    const bp = await bossPage();
    await shot(`planet${p + 1}-boss`);
    check('the boss stands on the last page with its variant line under the name', bp.boss !== null && (ex.hp === null || bp.boss.hp === ex.hp) && ex.variant.test(bp.boss.variant ?? '') && ex.loc.includes(bp.boss.loc), JSON.stringify(bp.boss));
    check('the boss posts the Spor comment of the planet as text with three replies', bp.spor?.key === ex.spor && bp.spor.replies === 3 && bp.bubble.length > 10 && !/story\./.test(bp.bubble), JSON.stringify({ spor: bp.spor, bubble: bp.bubble.slice(0, 40) }));
    levels.push(await ev(() => window.__game.state().hero.level));
    const down = await killBoss();
    const after = await ev(() => {
      const m = window.__game.meta();
      return { screen: window.__game.screen(), campaign: m.character?.campaign ?? null, plan: window.__game.state()?.plan ?? null, history: m.history.length };
    });
    if (p < LAST - 1) {
      check('boss down: back on the base, this planet closed once in the save, the next planet is the next ticket', down && after.campaign?.closed?.join() === Array.from({ length: p + 1 }, (_, i) => i).join() && after.campaign?.current === p + 1 && after.plan?.planet === p + 1 && after.history === p + 1, JSON.stringify(after));
    } else {
      check('boss down on planet 3: the return ticket to planet 1 is on the desk (finale)', down && after.campaign?.closed?.length === LAST && after.campaign?.finalTicket === true && !after.campaign?.caseClosed && after.plan?.kind === 'final' && after.plan?.planet === 0, JSON.stringify(after));
    }
  }
  tag = `${orient} ${heroKey}`;
  check('both chapter cards were skipped by a tap', chapterSkips === LAST - 1, String(chapterSkips));

  // ---- the finale: the Anomalia ----
  tag = `${orient} ${heroKey} finale`;
  const rc = await skipCard();
  check('the return card (finale, red) shows story text and one tap skips it', rc?.kind === 'finale' && clean(rc.text), JSON.stringify(rc && { kind: rc.kind, len: rc.text.length }));
  const fin = await takeTicket();
  check('the final ticket runs as one page with the Anomalia at the desk in its first form', fin.inRun && fin.plan?.kind === 'final' && (await ev(() => window.__game.finale.info()?.stage)) === 'form', JSON.stringify(fin.plan));
  await immortal();
  await ev(() => window.__game.advance(4));
  await sleep(250);
  const p1 = await ev(() => ({ key: window.__game.spor.info()?.commentKey ?? null, bubble: [...document.querySelectorAll('.bubble.comment')].map((b) => b.textContent ?? '').join(' ') }));
  check('phase 1: the Anomalia argues (Spor comment, no placeholder left)', p1.key === 'story.finale.phase1.spor.comment' && p1.bubble.length > 10 && !p1.bubble.includes('{'), JSON.stringify(p1));
  const face = await ev(() => {
    const h = window.__game;
    const ok = h.finale.skipTo('face');
    h.advance(2);
    return { ok, info: h.finale.info() };
  });
  check('phase 2: it wears the hero own face', face.ok && face.info?.stage === 'face' && face.info.heroId === heroKey, JSON.stringify(face.info));
  await shot('finale-face');
  const last = await ev(() => {
    const h = window.__game;
    const ok = h.finale.skipTo('last');
    h.advance(1);
    return { ok, info: h.finale.info() };
  });
  check('phase 3: the existence finish', last.ok && last.info?.stage === 'last' && typeof last.info.existence === 'number', JSON.stringify(last.info));
  const end = await ev(() => {
    const h = window.__game;
    return { ok: h.finale.skipTo('end'), info: h.finale.info() };
  });
  await sleep(150);
  const stamped = await ev(() => [...document.querySelectorAll('text, div, span')].some((x) => x.childElementCount === 0 && /SPRAWĘ ZAMKNIĘTO/.test(x.textContent ?? '')));
  check('the stamp SPRAWĘ ZAMKNIĘTO falls', end.ok && end.info?.stage === 'done' && stamped, JSON.stringify({ ok: end.ok, stage: end.info?.stage, stamped }));
  await shot('finale-stamp');
  await ev(() => window.__game.advance(3.5));
  check('the finale closes on the base', await waitScreen('baza', 6000), await screen());
  await sleep(400);
  const closed = await ev(() => {
    const m = window.__game.meta();
    const c = m.character?.campaign ?? null;
    return { c, history: m.history.length, last: window.__game.notes().slice(-1)[0]?.text ?? '', plan: window.__game.state()?.plan?.kind ?? null };
  });
  check('the case is closed in the save (3 planets, no final ticket), the closing footnote is printed, extras open on the desk', closed.c?.caseClosed === true && closed.c.finalTicket === false && [0, 1, 2].every((n) => closed.c.closed.includes(n)) && /^Sprawę zamknięto/.test(closed.last) && closed.plan === 'extra', JSON.stringify({ c: closed.c && { closed: closed.c.closed, ft: closed.c.finalTicket, cc: closed.c.caseClosed }, last: closed.last.slice(0, 40), plan: closed.plan }));
  await shot('base-case-closed');
  await skipCard(1200);
  // reload keeps it
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await sleep(800);
  const saved = await ev(() => window.__game.meta().characters.map((c) => ({ hero: c.character?.heroId, caseClosed: c.character?.campaign?.caseClosed ?? null, closed: c.character?.campaign?.closed?.length ?? -1 })));
  check('after a reload the case file keeps the hero and the closed case', saved.length === 1 && saved[0].hero === heroKey && saved[0].caseClosed === true && saved[0].closed === LAST, JSON.stringify(saved));

  // ---- 40 enemies, 5 s of frame times ----
  tag = `${orient} ${heroKey}`;
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
  console.log(`PERF ${orient} ${heroKey}: ${perf.enemies} enemies, frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${d.length} frames`);
  await shot('forty-enemies');
  check('40 enemies on the page for the measurement', perf.enemies >= 40, String(perf.enemies));
  if (PERF_MAX !== null) check(`average frame under ${PERF_MAX} ms`, avg <= PERF_MAX, `${avg.toFixed(2)} ms`);
  console.log(`  leg ${orient} ${heroKey}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ctx.close();
}

let browser;
try {
  await waitForServer(BASE);
  const extra = process.env.SMOKE_UNCAPPED ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  browser = await chromium.launch({ executablePath: chromiumPath(), args: [...launchArgs, ...extra] });
  for (const orient of Object.keys(ORIENTS)) {
    for (const heroKey of Object.keys(HEROES)) {
      if (ONLY && ONLY !== orient && ONLY !== heroKey) continue;
      try {
        await leg(browser, orient, heroKey);
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
console.log(failed.length === 0 ? 'M3 E2E PASSED' : `M3 E2E FAILED (${failed.length}): ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
