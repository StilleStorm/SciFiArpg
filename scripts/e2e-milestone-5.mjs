// Milestone 5 (Akt II, slices S22-S24, planets 4-6) end-to-end gate: from a fresh profile, in portrait and in landscape, for two heroes
// (Konsultant, Naleslnik). Title -> roster (hero picked with the arrows) -> a case file whose campaign closed planet 3 at the old
// CAMPAIGN_LAST (an archive read back, as a player's old save is): the red "Sprawe wznowiono" card (kind `reopened`, WZNOWIONO stamp) shows
// once, ahead of the planet 4 chapter card, and not again after a reload -> planets 4, 5, 6 entered through the case file with the ticket
// sheet, each played page by page to its boss and closed (planet 5: the parcels wall held by the named elite Doreczyciel, lifted by his
// death; planet 6: the hatched band held by the Archiwista until the key teczka, the nagranie, is opened; the planet 5 boss with its
// shopping-cart grid; the planet 6 Ankieta with its row of five squares, both outcomes (a 1 and a 5) and the fight to the end) -> the return
// ticket after planet 6 (CAMPAIGN_LAST) -> the Anomalia skipped to the stamp, the case closed -> free travel lists planets 1..6, a reload keeps
// the campaign -> the two Akt II elite affixes (oddzwaniajacy, dwuetapowy) on every one of planets 4-6 and never on a boss -> 40 enemies on an
// Akt II page, 5 s of frame times. Cards are skipped, never read to the end; their text is only checked for keys and placeholders.
// Usage: npm run e2e:m5 (builds into dist-m5 first). Env: M5_PORT (4195), M5_OUT (dist-m5), M5_DIR (shots-m5),
// M5_ONLY ("portrait", "landscape", "konsultant" or "nalesnik"), PERF_MAX_MS. Exits non-zero on any failed check or page/console error.
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath, launchArgs } from './browser.mjs';
import { pathWalk } from './pathwalk.mjs';

const PORT = Number(process.env.M5_PORT ?? 4195);
const OUT = process.env.M5_OUT ?? 'dist-m5';
const SHOTS = process.env.M5_DIR ?? 'shots-m5';
const PERF_MAX = process.env.PERF_MAX_MS ? Number(process.env.PERF_MAX_MS) : null;
const ONLY = process.env.M5_ONLY ?? '';
const HEROES = { konsultant: 1, nalesnik: 4 }; // index on the profile screen (src/heroes/registry.ts)
const BASE = `http://127.0.0.1:${PORT}/SciFiArpg/`;
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ORIENTS = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const LAST = 6; // CAMPAIGN_LAST in src/world/campaign.ts
const FIRST_AKT2 = 3; // planet index 3 = planet 4
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
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${tag}] ${name}${ok || !detail ? '' : ` (${detail})`}`);
};

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // node:http, not fetch: undici refuses some ports as "bad ports" of the fetch standard
    const ok = await new Promise((res) => {
      get(url, (r) => {
        r.resume();
        res(r.statusCode === 200);
      }).on('error', () => res(false));
    });
    if (ok) return;
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
  const clean = (text) => text.length > 60 && !/story\.|screens\.cards|\[brak/i.test(text);

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

  /** The card layer of the base, skipped with one tap; returns { kind, text, ... } or null. */
  async function skipCard(wait = 1500) {
    const layer = page.locator('.card-layer');
    const shown = await layer.first().waitFor({ state: 'visible', timeout: wait }).then(() => true, () => false);
    if (!shown) return null;
    const got = await ev(() => {
      const l = document.querySelector('.card-layer');
      return { kind: l?.dataset.card ?? null, text: l?.textContent ?? '', red: l?.classList.contains('rewritten') ?? false, stamp: l?.querySelector('.card-stamp')?.textContent ?? '', hero: !!l?.querySelector('.card-hero') };
    });
    await page.locator('.card-layer .card-skip').click({ timeout: 3000 });
    await page.waitForFunction(() => !document.querySelector('.card-layer'), null, { timeout: 4000 }).catch(() => undefined);
    return got;
  }

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
    const log = { gate: null, heldTurned: null, lifted: false, turned: false, snap: null, note: null };
    await immortal();
    const gi = await ev(() => window.__game.gate.info());
    if (gi) {
      log.gate = { kind: gi.kind, look: gi.look, holds: gi.holds };
      if (gi.holds) {
        log.snap = await ev(() => {
          const h = window.__game;
          const s = h.state();
          return {
            info: h.gate.info(),
            loc: s.page.location,
            wall: document.querySelectorAll('#page [data-obstacle=gate]').length,
            parcels: document.querySelectorAll('#page [data-obstacle=gate][data-gate-look=parcels]').length,
            figure: document.querySelectorAll('#page [data-gate-figure]').length,
            named: h.enemies.list().filter((e) => e.named).map((e) => e.named),
            namedIds: h.enemies.list().filter((e) => e.named).map((e) => e.id),
            keys: h.content.list().filter((c) => c.key).length,
            props: document.querySelectorAll('#page [data-obstacle="prop"]').length,
            drawn: [...document.querySelectorAll('#page [data-obstacle="prop"]')].filter((n) => n.childElementCount > 0).length,
          };
        });
        // the wrong thing does not lift it: another enemy dying does not, a folder without the key does not (checked by the walk below)
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
        // gate.approach() empties the page of enemies: right for the folder gate (the Archiwista is a figure), wrong for the one that waits for an elite's death
        if (gi.kind === 'teczka') await ev(() => window.__game.gate.approach());
        await sleep(400);
        log.note = await ev(() => window.__game.notes().map((n) => n.text));
        await shot(`gate-${gi.kind}-held`);
        // the real condition: the key teczka opened, or the named elite slain
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
        log.liftNote = await ev(() => window.__game.notes().slice(-4).map((n) => n.text));
        // the wall draws away over a few seconds of game time
        await ev(() => window.__game.advance(3.2));
      } else log.lifted = true;
    }
    const from = await ev(() => window.__game.state().pageIndex);
    let walked = null;
    for (let k = 0; k < 6; k++) {
      walked = await page.evaluate(pathWalk, 40);
      if (walked.turned || !walked.modal) break;
      await settle(); // a sheet of the law (the code of Weryfikacja dwuetapowa) holds the run: take it, walk on
      const now = await ev(() => ({ i: window.__game.state().pageIndex, t: window.__game.state().turning }));
      if (now.i !== from || now.t) break; // the walk had reached the exit: the page turns once the sheet is put away
    }
    log.turned = await page.waitForFunction((k) => window.__game.state()?.pageIndex === k + 1 && !window.__game.state().turning, from, { timeout: 8000 }).then(() => true, () => false);
    log.walk = walked && { ...walked };
    await sleep(300);
    await settle();
    return log;
  }

  /** The boss on the last page: its variant line, the Spor comment key. */
  async function bossPage() {
    await page.waitForFunction(() => window.__game.state()?.enemies.some((e) => e.boss), null, { timeout: 8000 }).catch(() => undefined);
    await sleep(500);
    await settle();
    await immortal();
    const boss = await ev(() => {
      const h = window.__game;
      const b = h.state().enemies.find((e) => e.boss);
      const v = document.querySelector('[data-part=variant]');
      const l = h.enemies.list().find((e) => e.boss);
      return b
        ? {
            id: b.id,
            hp: b.hpMax,
            variant: v?.textContent ?? null,
            loc: h.state().page.location,
            elite: l?.elite ?? null,
            affixes: l?.affixes ?? [],
            carts: document.querySelectorAll('[data-part=koszyk]').length,
            hydrants: document.querySelectorAll('[data-part=grid] path[d*="M-4 8L-4-4"]').length,
            ankieta: [...document.querySelectorAll('text')].some((x) => /^\s*ANKIETA\s*$/.test(x.textContent ?? '')),
            props: document.querySelectorAll('#page [data-obstacle="prop"]').length,
            drawn: [...document.querySelectorAll('#page [data-obstacle="prop"]')].filter((n) => n.childElementCount > 0).length,
          }
        : null;
    });
    let first = null;
    for (let i = 0; i < 40 && boss && !first; i++) {
      const info = await ev(() => window.__game.spor.info());
      if (info?.open && info.phase === 1) first = info;
      else await sleep(200);
    }
    const bubble = await ev(() => document.querySelector('.bubble.comment')?.textContent ?? '');
    return { boss, spor: first && { key: first.commentKey, replies: first.replies.length, right: first.replies[first.correct]?.textKey ?? null }, bubble };
  }

  /** The Ankieta's survey row: a 1 (the boss is held, filed) and a 5 (the boss is thanked, healed). */
  async function ankietaOutcomes() {
    // wait for a row, bounded; returns its geometry or null
    const row = () =>
      ev(() => {
        const h = window.__game;
        const b = h.state().enemies.find((e) => e.boss);
        const sv = b?.rt?.survey;
        return sv ? { on: sv.on, cx: sv.cx, cy: sv.cy } : null;
      });
    const standOn = (cell) =>
      ev((c) => {
        const h = window.__game;
        const s = h.state();
        const b = s.enemies.find((e) => e.boss);
        const sv = b.rt.survey;
        s.player.suspended = false;
        const cellW = 52; // GRID_CELL
        const px = sv.cx + (c - 2) * cellW;
        const out = { held: false, hp0: b.hp, max: b.hpMax };
        s.player.attackTimer = 1e6; // the hero's own blows must not move the Ankieta's racja while the outcome is read
        for (let i = 0; i < 40 && sv.on; i++) {
          h.placePlayer(px, sv.cy);
          s.player.hp = s.player.hpMax = 1e9;
          h.advance(0.1);
        }
        out.hp1 = b.hp;
        out.blocked = b.statuses.some((x) => x.kind === 'zablokowany');
        out.rowOff = !sv.on;
        out.notes = h.notes().slice(-3).map((n) => n.text);
        return out;
      }, cell);
    const out = { cells: 0, rowDom: 0 };
    // phase 1: after the first 4 s a row is drawn
    await ev(() => {
      const h = window.__game;
      const b = h.state().enemies.find((e) => e.boss);
      h.state().player.suspended = false;
      h.placePlayer(b.x, b.y + 220);
      for (let i = 0; i < 80 && !b.rt?.survey?.on; i++) h.advance(0.1);
    });
    const r0 = await row();
    out.row0 = r0 && r0.on;
    await sleep(500);
    out.rowDom = await ev(() => document.querySelectorAll('[data-part=survey] > g').length);
    await shot('ankieta-row');
    // outcome 1: stand on the one-star square 1.5 s
    out.one = r0?.on ? await standOn(0) : null;
    // let the boss recover from the hold and wait for the next row (8 s)
    await ev(() => {
      const h = window.__game;
      const b = h.state().enemies.find((e) => e.boss);
      for (let i = 0; i < 160 && !b.rt.survey.on; i++) {
        h.state().player.hp = h.state().player.hpMax = 1e9;
        h.advance(0.1);
      }
      b.hp = Math.round(b.hpMax * 0.7); // measurable heal, still above the half-racja phase
    });
    const r1 = await row();
    out.row1 = r1 && r1.on;
    out.five = r1?.on ? await standOn(4) : null;
    return out;
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

  /** The two Akt II affixes on this planet's run (page 1): behaviour as the player sees it. */
  async function affixes(planet) {
    await ev(() => {
      const g = window.__game;
      const s = g.state();
      s.player.suspended = true;
      s.player.level = Math.max(s.player.level, 25); // a kill must not print the update form that holds the run
      s.hero.pendingLevels = 0;
      s.player.attackTimer = 1e6; // the hero's own auto-attack must not land a rebuttal of its own: only the hook's blows count here
      g.enemies.clear();
      g.enemies.spawnFamily('urzadzenia', 1, { elite: 'dwuetapowy' });
    });
    await sleep(500);
    const d0 = await ev(() => {
      const e = window.__game.enemies.list()[0];
      const st = window.__game.state().enemies[0];
      return { claim: e?.claim ?? null, type: st?.claim?.type ?? null, affixes: e?.affixes ?? [], bubble: [...document.querySelectorAll('#world g[data-kind="enemy"] .bubble')].map((b) => b.textContent ?? '') };
    });
    check(`planet ${planet}: dwuetapowy, the elite's claim reads (1/2)`, /claimStep\.urzadzenia\..+\.1$/.test(d0.claim ?? '') && d0.bubble.some((x) => /\(1\/2\)/.test(x)), JSON.stringify(d0));
    await ev((ty) => {
      const g = window.__game;
      g.state().enemies[0].hp = g.state().enemies[0].hpMax = 9999;
      g.enemies.hit(g.enemies.list()[0].id, ty, 5);
    }, d0.type);
    await sleep(600);
    const d1 = await ev(() => ({ struck: window.__game.state().enemies[0]?.claim?.struck ?? false, claim: window.__game.enemies.list()[0]?.claim ?? null, bubble: [...document.querySelectorAll('#world g[data-kind="enemy"] .bubble')].map((b) => b.textContent ?? '') }));
    check(`planet ${planet}: dwuetapowy, the first rebuttal does not break the claim, it moves to (2/2)`, !d1.struck && /\.2$/.test(d1.claim ?? '') && d1.bubble.some((x) => /\(2\/2\)/.test(x)), JSON.stringify(d1));
    await ev((ty) => {
      const g = window.__game;
      g.advance(0.6);
      g.enemies.hit(g.enemies.list()[0].id, ty, 5);
    }, d0.type);
    const d2 = await ev(() => ({ struck: window.__game.state().enemies[0]?.claim?.struck ?? false }));
    check(`planet ${planet}: dwuetapowy, the second rebuttal breaks it`, d2.struck === true, JSON.stringify(d2));

    await ev(() => {
      const g = window.__game;
      g.enemies.clear();
      g.enemies.spawnFamily('urzadzenia', 1, { elite: 'oddzwaniajacy' });
    });
    await sleep(400);
    const o0 = await ev(() => {
      const g = window.__game;
      const e = g.state().enemies[0];
      g.enemies.hit(e.id, 'mechaniczny', 99999);
      return { gone: g.state().enemies.length === 0 };
    });
    await ev(() => window.__game.advance(3.0));
    const oMid = await ev(() => window.__game.enemies.list().length);
    await ev(() => window.__game.advance(1.4));
    await sleep(600);
    const o2 = await ev(() => {
      const g = window.__game;
      const e = g.state().enemies[0];
      return { n: g.state().enemies.length, hp: e?.hp ?? 0, max: e?.hpMax ?? 0, claim: e?.claim?.textKey ?? null, affix: e?.elite?.affix ?? null, restrike: document.querySelectorAll('#fx .restrike').length, bubble: [...document.querySelectorAll('#world g[data-kind="enemy"] .bubble')].map((b) => b.textContent ?? '') };
    });
    check(`planet ${planet}: oddzwaniajacy, struck, it is gone for ~4 s, then returns at 30% racja with the claim "Oddzwaniam"`, o0.gone && oMid === 0 && o2.n === 1 && o2.affix === 'oddzwaniajacy' && Math.abs(o2.hp / o2.max - 0.3) < 0.05 && o2.claim === 'enemies.claim.oddzwaniam' && o2.bubble.some((x) => /Oddzwaniam/.test(x)) && o2.restrike === 1, JSON.stringify({ o0, oMid, o2 }));
    // struck a second time it stays gone
    await ev(() => {
      const g = window.__game;
      const id = g.state().enemies.find((e) => e.elite?.affix === 'oddzwaniajacy')?.id;
      for (const t of ['regulaminowy', 'mechaniczny', 'egzystencjalny']) g.enemies.hit(id, t, 99999);
      g.advance(6);
    });
    const o3 = await ev(() => window.__game.enemies.list().filter((e) => e.affixes.includes('oddzwaniajacy')).length);
    check(`planet ${planet}: oddzwaniajacy returns once only`, o3 === 0, String(o3));
    await ev(() => {
      const g = window.__game;
      g.enemies.clear();
      g.state().player.suspended = false;
      g.state().player.attackTimer = 0;
    });
    await shot(`affixes-planet${planet}`);
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
  await page.locator('button.choose').locator('visible=true').first().click();
  check('the case file leads to the base', await waitScreen('baza'), await screen());
  await sleep(600);
  const opening = await skipCard();
  check('a fresh case file: the opening card, skipped', opening?.kind === 'opening', JSON.stringify(opening && opening.kind));
  const hero0 = await ev(() => window.__game.meta().character?.heroId ?? null);
  check(`the hero picked on the profile screen is ${heroKey}`, hero0 === heroKey, String(hero0));

  // ---- 1. a case file closed at planet 3 (the MVP-era CAMPAIGN_LAST) is reopened: the red card once ----
  tag = `${orient} ${heroKey} reopened`;
  const oldSave = { current: 0, closed: [0, 1, 2], finalTicket: false, caseClosed: true, extras: 0, cards: { opening: true, chapters: [0, 1, 2, -1, -2, -3], finale: true } };
  const imported = await ev((camp) => {
    const g = window.__game;
    const a = JSON.parse(g.exportArchive());
    const c = a.meta.characters.find((x) => x.id === a.meta.activeCharacterId);
    c.character.campaign = camp;
    delete c.bookmark;
    return g.importArchive(JSON.stringify(a));
  }, oldSave);
  await sleep(700);
  await page.locator('.desk-sheet .ps-close').first().click({ timeout: 1500 }).catch(() => undefined); // an import opens the desk over the base
  await sleep(900);
  const red = await ev(() => {
    const l = document.querySelector('.card-layer');
    const camp = window.__game.meta().character?.campaign;
    return { kind: l?.dataset.card ?? null, red: l?.classList.contains('rewritten') ?? false, text: l?.textContent ?? '', stamp: l?.querySelector('.card-stamp')?.textContent ?? '', hero: !!l?.querySelector('.card-hero'), lines: l?.querySelectorAll('.card-line').length ?? 0, flag: camp?.reopened ?? null, current: camp?.current ?? null, closed: camp?.closed ?? null };
  });
  check('a case file closed at planet 3 shows the red "Sprawę wznowiono" card (kind reopened, WZNOWIONO stamp, story lines, no key) and the flag is taken', imported === true && red.kind === 'reopened' && red.red && red.stamp === 'WZNOWIONO' && /Sprawę wznowiono/.test(red.text) && red.lines >= 3 && clean(red.text) && red.flag === null && red.current === FIRST_AKT2 && red.closed?.join() === '0,1,2', JSON.stringify({ imported, kind: red.kind, stamp: red.stamp, lines: red.lines, flag: red.flag, current: red.current, closed: red.closed, text: red.text.slice(0, 60) }));
  await shot('reopened-card');
  await page.locator('.card-layer .card-skip').click({ timeout: 3000 }).catch(() => undefined);
  await sleep(900);
  const chapter4 = await skipCard(2500);
  const plan4 = await ev(() => window.__game.state()?.plan ?? null);
  check('the planet 4 chapter card follows the reopened card, with story text', chapter4?.kind === 'chapter' && clean(chapter4.text) && plan4?.planet === FIRST_AKT2 && plan4?.kind === 'campaign', JSON.stringify({ kind: chapter4?.kind, plan: plan4 }));
  // a reload and back into the case file: the reopened card does not come again
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await sleep(900);
  const afterReload = await ev(() => {
    const c = window.__game.meta().characters.find((x) => x.id === window.__game.meta().activeCharacterId);
    return { reopened: c?.character?.campaign?.reopened ?? null, closed: c?.character?.campaign?.closed ?? null, current: c?.character?.campaign?.current ?? null, id: c?.id ?? null };
  });
  await page.locator('#ui').getByText('Rozpocznij', { exact: false }).locator('visible=true').first().click({ timeout: 5000 }).catch(() => undefined);
  const openBtn = page.locator(`.roster .rs-case[data-case="${afterReload.id}"] [data-roster=open]`);
  const sawRoster = await openBtn.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (sawRoster) await openBtn.click({ timeout: 3000 });
  const backOnBase = await waitScreen('baza', 6000);
  await sleep(900);
  const again = await ev(() => ({ kind: document.querySelector('.card-layer')?.dataset.card ?? null }));
  check('after a reload the case file opens again: no reopened card, the flag is not saved, the campaign is kept', backOnBase && again.kind !== 'reopened' && afterReload.reopened === null && afterReload.closed?.join() === '0,1,2' && afterReload.current === FIRST_AKT2, JSON.stringify({ backOnBase, again, afterReload }));
  await page.locator('.card-layer .card-skip').click({ timeout: 1500 }).catch(() => undefined);
  await sleep(400);

  // ---- 2. planets 4, 5, 6 through the case file ----
  const EXPECT = {
    3: { loc: ['miasto', 'biuro'], hp: 260, variant: /^Weryfikacja, instancja druga, formularz\s+rozszerzony$/, spor: 'story.p4.boss.spor1.comment', right: 'regulaminowy', clerk: /Eskalacji/, gate: null },
    4: { loc: ['miasto', 'centrum'], hp: null, variant: /^Weryfikacja, wersja sklepowa, w\s+promocji$/, spor: 'story.p5.boss.spor1.comment', right: 'egzystencjalny', clerk: /Doręcze/, gate: 'elite' },
    5: { loc: ['centrum', 'serwerownia', 'archiwum'], hp: 300, variant: null, spor: 'story.p6.boss.spor1.comment', right: 'regulaminowy', clerk: /Infolinii/, gate: 'teczka' },
  };
  let chapterSkips = 0;
  for (let p = FIRST_AKT2; p < LAST; p++) {
    tag = `${orient} ${heroKey} planet ${p + 1}`;
    const ex = EXPECT[p];
    if (p > FIRST_AKT2) {
      const card = await skipCard();
      check('a chapter card with story text shows on arrival and one tap skips it', card?.kind === 'chapter' && clean(card.text), JSON.stringify(card && { kind: card.kind, len: card.text.length, head: card.text.slice(0, 60) }));
      if (card?.kind === 'chapter') chapterSkips++;
    }
    const base = await ev(() => ({ screen: window.__game.screen(), plan: window.__game.state()?.plan ?? null, layer: !!document.querySelector('.card-layer'), clerk: document.querySelectorAll('[data-station=urzednik]').length, offers: window.__game.quests.offers().map((o) => o.id) }));
    check('the base holds the campaign ticket of this planet, the clerk is drawn, the board has this planet side tickets', base.screen === 'baza' && base.plan?.planet === p && base.plan?.kind === 'campaign' && !base.layer && base.clerk === 1 && base.offers.filter((id) => id.startsWith(`h:p${p + 1}:`)).length === 3, JSON.stringify(base));
    await ev(() => window.__game.station('urzednik'));
    await page.locator('.npc-sheet').waitFor({ state: 'visible', timeout: 3000 });
    const clerk = await ev(() => ({ lines: document.querySelectorAll('.npc-sheet .npc-line').length, text: document.querySelector('.npc-sheet')?.textContent ?? '' }));
    check('the clerk sheet shows three story lines without keys', clerk.lines === 3 && !/story\.p\d/.test(clerk.text) && clerk.text.length > 80 && ex.clerk.test(clerk.text), JSON.stringify({ lines: clerk.lines, head: clerk.text.slice(0, 80) }));
    await page.locator('.npc-sheet .ps-close').first().click().catch(() => undefined);
    await sleep(200);
    const tk = await takeTicket();
    check('the ticket sheet takes Niski and the run is this planet campaign ticket', tk.inRun && tk.plan?.priority === 'niski' && tk.plan?.planet === p && tk.plan?.kind === 'campaign', JSON.stringify(tk.plan));
    const info = await ev(() => {
      const s = window.__game.state();
      return { pages: s.pages.length, locs: s.pages.map((q) => q.location ?? null), gates: s.pages.map((q) => q.gate?.kind ?? null), gateAt: s.pages.findIndex((q) => q.gate) };
    });
    check('the run has pages of this planet locations and exactly the gate this planet carries', info.pages >= 4 && ex.loc.every((l) => info.locs.includes(l)) && (ex.gate === null ? info.gates.every((g) => g === null) : info.gates.filter((g) => g === ex.gate).length === 1 && info.gateAt === (p === 4 ? 2 : 3)), JSON.stringify(info));
    // the two Akt II affixes on page 1 of this planet
    await immortal();
    await affixes(p + 1);
    await immortal();
    // page by page through the real exit walk, gates held until their condition is met
    const gatesSeen = [];
    for (let i = 0; i < info.pages - 1; i++) {
      const lg = await leavePage();
      if (lg.gate) gatesSeen.push(lg);
      check(`page ${i + 1} is left through its exit${lg.gate ? ` (${lg.gate.kind} gate)` : ''}`, lg.turned && (lg.gate === null || (lg.gate.holds ? lg.heldTurned === false && lg.lifted : true)), JSON.stringify({ ...lg, snap: undefined }));
    }
    check('the gate of the planet stopped the walk while it held, then lifted', ex.gate === null ? gatesSeen.length === 0 : gatesSeen.length === 1 && gatesSeen[0].gate.kind === ex.gate && gatesSeen[0].heldTurned === false && gatesSeen[0].lifted, JSON.stringify(gatesSeen.map((x) => ({ ...x, snap: undefined }))));
    if (p === 4) {
      const g = gatesSeen[0];
      const sn = g?.snap;
      check('planet 5 gate: page 3 is a wall of parcels held by a Dyspozytor and exactly one named elite, Doręczyciel, who is the gate elite', sn?.info?.kind === 'elite' && sn.info.look === 'parcels' && sn.parcels === 1 && sn.figure === 1 && sn.named.length === 1 && sn.named[0] === 'Doręczyciel' && sn.namedIds[0] === sn.info.elite && sn.loc === 'miasto', JSON.stringify(sn));
      check('planet 5 gate: his death lifts it with the planet own footnote ("skreślono z grafiku")', (g?.liftNote ?? []).some((x) => /skreślono\s+z\s+grafiku/.test(x)), JSON.stringify(g?.liftNote));
    }
    if (p === 5) {
      const g = gatesSeen[0];
      const sn = g?.snap;
      check('planet 6 gate: page 4 is an archiwum with every prop drawn, the hatched band (no look), an Archiwista and exactly one key teczka', sn?.loc === 'archiwum' && sn.info?.kind === 'teczka' && !sn.info.look && sn.info.keyTeczka && sn.wall === 1 && sn.figure === 1 && sn.keys === 1 && sn.props >= 6 && sn.props === sn.drawn, JSON.stringify(sn));
      check('planet 6 gate: at the blocked corner the Asystent names the condition (the nagranie, in a folder)', (g?.note ?? []).some((x) => /Wyjście\s+z\s+archiwum\s+wymaga\s+okazania\s+nagrania/.test(x)), JSON.stringify((g?.note ?? []).slice(-3)));
      check('planet 6 gate: opening the nagranie lifts it with the planet own footnote ("Nagranie okazano")', (g?.liftNote ?? []).some((x) => /Nagranie\s+okazano/.test(x)), JSON.stringify(g?.liftNote));
    }
    const bp = await bossPage();
    await shot(`planet${p + 1}-boss`);
    check('the boss stands on the last page: right place, hp, variant line (none for the Ankieta), no elite affix on it', bp.boss !== null && (ex.hp === null || bp.boss.hp === ex.hp) && (ex.variant === null ? bp.boss.ankieta : ex.variant.test(bp.boss.variant ?? '')) && ex.loc.includes(bp.boss.loc) && bp.boss.elite === null && bp.boss.affixes.length === 0 && bp.boss.props >= 4 && bp.boss.props === bp.boss.drawn, JSON.stringify(bp.boss));
    check('the boss posts the Spor comment of the planet as text with three replies, the right one being the expected damage type', bp.spor?.key === ex.spor && bp.spor.replies === 3 && bp.spor.right?.endsWith(`.${ex.right}`) && bp.bubble.length > 10 && !/story\./.test(bp.bubble), JSON.stringify({ spor: bp.spor, bubble: bp.bubble.slice(0, 40) }));
    if (p === 4) {
      check('planet 5 boss: the Weryfikacja grid is drawn as two shopping carts (no hydrants)', bp.boss?.carts === 2 && bp.boss.hydrants === 0, JSON.stringify({ carts: bp.boss?.carts, hydrants: bp.boss?.hydrants }));
      const hint = await ev(() => {
        const b = window.__game.state().enemies.find((e) => e.boss);
        if (b) window.__game.placePlayer(b.x, b.y + 120);
        window.__game.advance(0.3);
        return window.__game.notes().map((n) => n.text);
      });
      check('planet 5 boss: the captcha hint is the planet own (kratki z koszykami)', hint.some((x) => /kratki\s+z\s+koszykami/.test(x)), JSON.stringify(hint.slice(-2)));
    }
    if (p === 5) {
      const o = await ankietaOutcomes();
      check('planet 6 boss: after 4 s a survey row of five squares is drawn and the hint is written', o.row0 === true && o.rowDom === 5, JSON.stringify({ row0: o.row0, dom: o.rowDom }));
      check('planet 6 boss: standing on the 1 for 1.5 s files the complaint: the Ankieta is held (zablokowany) and the row is gone', o.one?.blocked === true && o.one.rowOff && o.one.notes.some((x) => /Złożono ocenę negatywną/.test(x)), JSON.stringify(o.one));
      check('planet 6 boss: standing on the 5 thanks it: the Ankieta heals a tenth of its racja and the row is gone', o.five !== null && o.five.rowOff && o.five.hp1 - o.five.hp0 >= o.five.max * 0.09 && o.five.notes.some((x) => /Dziękujemy za ocenę/.test(x)), JSON.stringify(o.five));
    }
    const down = await killBoss();
    const after = await ev(() => {
      const m = window.__game.meta();
      return { screen: window.__game.screen(), campaign: m.character?.campaign ?? null, plan: window.__game.state()?.plan ?? null, history: m.history.length };
    });
    if (p < LAST - 1) {
      check('boss down: back on the base, this planet closed once in the save, the next planet is the next ticket', down && after.campaign?.closed?.join() === Array.from({ length: p + 1 }, (_, i) => i).join() && after.campaign?.current === p + 1 && after.plan?.planet === p + 1, JSON.stringify(after));
    } else {
      check(`boss down on planet ${LAST}: six planets closed, the return ticket to planet 1 is on the desk (finale)`, down && after.campaign?.closed?.join() === '0,1,2,3,4,5' && after.campaign?.finalTicket === true && !after.campaign?.caseClosed && after.plan?.kind === 'final' && after.plan?.planet === 0, JSON.stringify(after));
    }
  }
  tag = `${orient} ${heroKey}`;
  check('the chapter cards of planets 5 and 6 were skipped by a tap', chapterSkips === LAST - 1 - FIRST_AKT2, String(chapterSkips));

  // ---- the return ticket and the finale, up to the stamp ----
  tag = `${orient} ${heroKey} finale`;
  // this case file closed the old campaign, so its save already holds cards.finale (the return card is shown once per character, CardsSeen.finale)
  const rc = await skipCard(2500);
  const seen = await ev(() => window.__game.meta().character?.campaign?.cards?.finale ?? null);
  check('the return ticket of an old case file (finale card already seen) shows no second return card', rc === null && seen === true, JSON.stringify({ kind: rc?.kind ?? null, seen }));
  const fin = await takeTicket();
  check('the final ticket runs as one page with the Anomalia at the desk', fin.inRun && fin.plan?.kind === 'final' && (await ev(() => window.__game.finale.info()?.stage)) === 'form', JSON.stringify(fin.plan));
  await immortal();
  await ev(() => {
    const h = window.__game;
    h.advance(2);
    h.finale.skipTo('end');
  });
  await sleep(150);
  await ev(() => window.__game.advance(3.5));
  check('the finale closes on the base', await waitScreen('baza', 8000), await screen());
  await sleep(400);
  const closed = await ev(() => {
    const m = window.__game.meta();
    return { c: m.character?.campaign ?? null, plan: window.__game.state()?.plan?.kind ?? null };
  });
  check('the case is closed in the save (six planets, no final ticket) and extras open on the desk', closed.c?.caseClosed === true && closed.c.finalTicket === false && closed.c.closed.length === LAST && closed.plan === 'extra', JSON.stringify({ c: closed.c && { closed: closed.c.closed, ft: closed.c.finalTicket, cc: closed.c.caseClosed }, plan: closed.plan }));
  await skipCard(1200);

  // ---- 4. free travel lists planets 1..6, a reload keeps the campaign ----
  tag = `${orient} ${heroKey} travel`;
  await ev(() => window.__game.go('ticket'));
  await page.locator('.ticket-sheet .tk-travel').waitFor({ state: 'visible', timeout: 4000 });
  const rows = await ev(() => [...document.querySelectorAll('.ticket-sheet .tk-travel-row[data-planet]')].map((r) => Number(r.getAttribute('data-planet'))));
  await shot('free-travel');
  check('free travel lists planets 1..6, no more', rows.join() === '0,1,2,3,4,5', rows.join());
  await page.locator('.ticket-sheet .tk-travel-row[data-planet="4"] button').click({ timeout: 3000 });
  await sleep(1000);
  const trav = await ev(() => ({ plan: window.__game.state()?.plan ?? null, sheet: !!document.querySelector('.ticket-sheet') }));
  await skipCard(1200);
  check('a tap on planet 5 accepts a travel ticket there without touching the campaign', trav.plan?.kind === 'travel' && trav.plan?.planet === 4 && !trav.sheet, JSON.stringify(trav));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await sleep(800);
  const saved = await ev(() => window.__game.meta().characters.map((c) => ({ hero: c.character?.heroId, caseClosed: c.character?.campaign?.caseClosed ?? null, closed: c.character?.campaign?.closed ?? [], ft: c.character?.campaign?.finalTicket ?? null })));
  check('after a reload the case file keeps the hero, six closed planets and the closed case', saved.length === 1 && saved[0].hero === heroKey && saved[0].caseClosed === true && saved[0].closed.join() === '0,1,2,3,4,5' && saved[0].ft === false, JSON.stringify(saved));

  // ---- 5. 40 enemies on an Akt II page, 5 s of frame times ----
  tag = `${orient} ${heroKey}`;
  await ev(() => window.__game.start(11, { pageCount: 5, lawId: 'grawitacja', plan: { kind: 'campaign', planet: 4, priority: 'niski', lawId: 'grawitacja' } }));
  await sleep(1500);
  await settle();
  const planet = await ev(() => ({ loc: window.__game.state().page.location, planet: window.__game.state().plan?.planet ?? null }));
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
        const t1 = last;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - t1 < 5000) requestAnimationFrame(tick);
          else resolve({ deltas, enemies: window.__game.state()?.enemies.length ?? 0 });
        };
        requestAnimationFrame(tick);
      }),
  );
  const d = perf.deltas.slice(1).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)] ?? 0;
  console.log(`PERF ${orient} ${heroKey}: ${perf.enemies} enemies on ${planet.loc} (planet ${planet.planet === null ? '?' : planet.planet + 1}), frame ${avg.toFixed(2)} ms avg, ${p95.toFixed(1)} ms p95 over ${d.length} frames`);
  await shot('forty-enemies');
  check('40 enemies on an Akt II page for the measurement', perf.enemies >= 40 && planet.planet === 4, JSON.stringify({ n: perf.enemies, planet }));
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
console.log(failed.length === 0 ? 'M5 E2E PASSED' : `M5 E2E FAILED (${failed.length}): ${failed.map((c) => c.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
